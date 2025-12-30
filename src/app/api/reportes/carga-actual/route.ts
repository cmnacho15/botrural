// src/app/api/reportes/carga-actual/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { EQUIVALENCIAS_UG, PESOS_DEFAULT, PESO_REFERENCIA_UG } from '@/lib/ugCalculator'
import { getEquivalenciasUG } from '@/lib/getEquivalenciasUG'

export const dynamic = 'force-dynamic'

// Esta función ahora recibe los pesos personalizados
function getEquivalenciaUG(categoria: string, pesos?: Record<string, number>): number {
  if (pesos && pesos[categoria] !== undefined) {
    return pesos[categoria] / 380
  }
  return EQUIVALENCIAS_UG[categoria] || 0
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true }
    })

    if (!usuario?.campoId || !usuario.campo) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }
    

    // Obtener equivalencias personalizadas del campo
    const pesosPersonalizados = await getEquivalenciasUG(usuario.campoId)

    // Obtener categorías activas
    const categoriasDB = await prisma.categoriaAnimal.findMany({
      where: { campoId: usuario.campoId, activo: true },
      orderBy: [{ tipoAnimal: 'asc' }, { nombreSingular: 'asc' }]
    })

    const categoriasBovinas = categoriasDB
      .filter(c => c.tipoAnimal === 'BOVINO')
      .map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUG(c.nombreSingular, pesosPersonalizados) }))

    const categoriasOvinas = categoriasDB
      .filter(c => c.tipoAnimal === 'OVINO')
      .map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUG(c.nombreSingular, pesosPersonalizados) }))

    const categoriasEquinas = categoriasDB
      .filter(c => c.tipoAnimal === 'EQUINO')
      .map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUG(c.nombreSingular, pesosPersonalizados) }))

    // Función para procesar un potrero (usa pesosPersonalizados del closure)
    function procesarPotrero(lote: any) {
      const animalesPorCategoria: Record<string, number> = {}
      categoriasDB.forEach(cat => { animalesPorCategoria[cat.nombreSingular] = 0 })

      let ugTotales = 0
      let vacunosTotales = 0
      let ovinosTotales = 0
      let equinosTotales = 0

      lote.animalesLote.forEach((animal: any) => {
        if (animalesPorCategoria[animal.categoria] !== undefined) {
          animalesPorCategoria[animal.categoria] += animal.cantidad
        }
        const eq = getEquivalenciaUG(animal.categoria, pesosPersonalizados)
        ugTotales += animal.cantidad * eq

        const catDB = categoriasDB.find(c => c.nombreSingular === animal.categoria)
        if (catDB?.tipoAnimal === 'BOVINO') vacunosTotales += animal.cantidad
        else if (catDB?.tipoAnimal === 'OVINO') ovinosTotales += animal.cantidad
        else if (catDB?.tipoAnimal === 'EQUINO') equinosTotales += animal.cantidad
      })

      const ugPorHa = lote.hectareas > 0 ? ugTotales / lote.hectareas : 0
      const tieneAnimales = vacunosTotales + ovinosTotales + equinosTotales > 0

      return {
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        animalesPorCategoria,
        ugPorHa,
        ugTotales,
        vacunosTotales,
        ovinosTotales,
        equinosTotales,
        tieneAnimales
      }
    }

    // Verificar si hay módulos de pastoreo con potreros asignados
    const modulos = await prisma.moduloPastoreo.findMany({
      where: { campoId: usuario.campoId },
      include: {
        lotes: {
          include: { animalesLote: true },
          orderBy: { nombre: 'asc' }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    const modulosConPotreros = modulos.filter(m => m.lotes.length > 0)
    const hayModulosActivos = modulosConPotreros.length > 0

    if (hayModulosActivos) {
      // ========== FORMATO NUEVO: POR MÓDULOS ==========
      
      // Potreros pastoreables sin módulo
      const potrerosSinModulo = await prisma.lote.findMany({
        where: {
          campoId: usuario.campoId,
          esPastoreable: true,
          moduloPastoreoId: null
        },
        include: { animalesLote: true },
        orderBy: { nombre: 'asc' }
      })

      // Procesar módulos
      const modulosData = modulosConPotreros.map(modulo => {
  const potrerosProcesados = modulo.lotes.map(procesarPotrero)
  const potrerosConAnimales = potrerosProcesados.filter(p => p.tieneAnimales)
  const hectareasModulo = potrerosProcesados.reduce((sum, p) => sum + p.hectareas, 0)
  const ugModulo = potrerosProcesados.reduce((sum, p) => sum + p.ugTotales, 0)
  const ugPorHaModulo = hectareasModulo > 0 ? ugModulo / hectareasModulo : 0

  return {
    id: modulo.id,
    nombre: modulo.nombre,
    hectareas: hectareasModulo,
    ugPorHa: ugPorHaModulo,
    cantidadPotreros: modulo.lotes.length, // 👈 TOTAL REAL DE POTREROS
    potreros: potrerosConAnimales
  }
}).filter(m => m.potreros.length > 0)

      // Procesar "Resto del campo"
const potrerosRestoProcesados = potrerosSinModulo.map(procesarPotrero)

let restoDelCampo = null
if (potrerosRestoProcesados.length > 0) {
  const hectareasResto = potrerosRestoProcesados.reduce((sum, p) => sum + p.hectareas, 0)
  const ugResto = potrerosRestoProcesados.reduce((sum, p) => sum + p.ugTotales, 0)
  const ugPorHaResto = hectareasResto > 0 ? ugResto / hectareasResto : 0

  restoDelCampo = {
    id: 'resto-del-campo',
    nombre: 'Resto del campo',
    descripcion: 'Potreros sin módulo de pastoreo asignado',
    hectareas: hectareasResto,
    ugPorHa: ugPorHaResto,
    cantidadPotreros: potrerosSinModulo.length, // 👈 TOTAL REAL DE POTREROS
    potreros: potrerosRestoProcesados // 👈 TODOS LOS POTREROS (vacíos y con animales)
  }
}

      // Totales globales - 🔥 INCLUIR TODOS LOS POTREROS (no solo los que tienen animales)
const todosLosPotrerosPastoreables = [
  ...modulosConPotreros.flatMap(m => m.lotes.map(procesarPotrero)),
  ...potrerosRestoProcesados
]

const todosLosPotreros = [
  ...modulosData.flatMap(m => m.potreros),
  ...(restoDelCampo?.potreros || [])
]

const totales = {
  hectareas: todosLosPotrerosPastoreables.reduce((sum, p) => sum + p.hectareas, 0),
  porCategoria: {} as Record<string, number>,
  ugTotales: todosLosPotrerosPastoreables.reduce((sum, p) => sum + p.ugTotales, 0),
        vacunosTotales: todosLosPotreros.reduce((sum, p) => sum + p.vacunosTotales, 0),
        ovinosTotales: todosLosPotreros.reduce((sum, p) => sum + p.ovinosTotales, 0),
        equinosTotales: todosLosPotreros.reduce((sum, p) => sum + p.equinosTotales, 0),
        ugPorHa: 0
      }

      categoriasDB.forEach(cat => { totales.porCategoria[cat.nombreSingular] = 0 })
      todosLosPotreros.forEach(p => {
        for (const [categoria, cantidad] of Object.entries(p.animalesPorCategoria)) {
          if (totales.porCategoria[categoria] !== undefined) {
            totales.porCategoria[categoria] += cantidad as number
          }
        }
      })
      totales.ugPorHa = totales.hectareas > 0 ? totales.ugTotales / totales.hectareas : 0

      return NextResponse.json({
        campo: { nombre: usuario.campo.nombre, hectareasTotal: totales.hectareas },
        categorias: { bovinas: categoriasBovinas, ovinas: categoriasOvinas, equinas: categoriasEquinas },
        modulos: modulosData,
        restoDelCampo,
        totales,
        fecha: new Date().toISOString()
      })

    } else {
      // ========== FORMATO ORIGINAL: SIN MÓDULOS ==========
      
      

const lotes = await prisma.lote.findMany({
  where: { campoId: usuario.campoId, esPastoreable: true },
  include: { animalesLote: true },
  orderBy: { nombre: 'asc' }
})

      const potreros = lotes.map(procesarPotrero)

      const totales = {
        hectareas: potreros.reduce((sum, p) => sum + p.hectareas, 0),
        porCategoria: {} as Record<string, number>,
        ugTotales: potreros.reduce((sum, p) => sum + p.ugTotales, 0),
        vacunosTotales: potreros.reduce((sum, p) => sum + p.vacunosTotales, 0),
        ovinosTotales: potreros.reduce((sum, p) => sum + p.ovinosTotales, 0),
        equinosTotales: potreros.reduce((sum, p) => sum + p.equinosTotales, 0),
        ugPorHa: 0
      }

      categoriasDB.forEach(cat => { totales.porCategoria[cat.nombreSingular] = 0 })
      potreros.forEach(p => {
        for (const [categoria, cantidad] of Object.entries(p.animalesPorCategoria)) {
          if (totales.porCategoria[categoria] !== undefined) {
            totales.porCategoria[categoria] += cantidad as number
          }
        }
      })
      totales.ugPorHa = totales.hectareas > 0 ? totales.ugTotales / totales.hectareas : 0

      return NextResponse.json({
        campo: { nombre: usuario.campo.nombre, hectareasTotal: totales.hectareas },
        categorias: { bovinas: categoriasBovinas, ovinas: categoriasOvinas, equinas: categoriasEquinas },
        potreros,
        totales,
        fecha: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Error generando reporte:', error)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}