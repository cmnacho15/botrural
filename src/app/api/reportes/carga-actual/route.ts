// src/app/api/reportes/carga-actual/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { EQUIVALENCIAS_UG } from '@/lib/ugCalculator'

export const dynamic = 'force-dynamic'

interface AnimalPorCategoria {
  categoria: string
  cantidad: number
}

interface PotreroConAnimales {
  nombre: string
  hectareas: number
  animales: AnimalPorCategoria[]
}

// Obtener equivalencia UG de una categoría
function getEquivalenciaUG(categoria: string): number {
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
      include: {
        campo: true
      }
    })

    if (!usuario?.campoId || !usuario.campo) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // Obtener todos los potreros con animales
    const lotes = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        animalesLote: true
      },
      orderBy: { nombre: 'asc' }
    })

    // Obtener todas las categorías activas para las columnas
    const categoriasDB = await prisma.categoriaAnimal.findMany({
      where: { 
        campoId: usuario.campoId,
        activo: true 
      },
      orderBy: [
        { tipoAnimal: 'asc' },
        { nombreSingular: 'asc' }
      ]
    })

    // Separar categorías por tipo
    const categoriasBovinas = categoriasDB
      .filter(c => c.tipoAnimal === 'BOVINO')
      .map(c => ({
        nombre: c.nombreSingular,
        equivalenciaUG: getEquivalenciaUG(c.nombreSingular)
      }))

    const categoriasOvinas = categoriasDB
      .filter(c => c.tipoAnimal === 'OVINO')
      .map(c => ({
        nombre: c.nombreSingular,
        equivalenciaUG: getEquivalenciaUG(c.nombreSingular)
      }))

    const categoriasEquinas = categoriasDB
      .filter(c => c.tipoAnimal === 'EQUINO')
      .map(c => ({
        nombre: c.nombreSingular,
        equivalenciaUG: getEquivalenciaUG(c.nombreSingular)
      }))

    // Construir los datos de la tabla
    const potreros = lotes.map(lote => {
      const animalesPorCategoria: Record<string, number> = {}
      
      // Inicializar todas las categorías en 0
      categoriasDB.forEach(cat => {
        animalesPorCategoria[cat.nombreSingular] = 0
      })
      
      // Llenar con los animales del potrero
      lote.animalesLote.forEach(animal => {
        if (animalesPorCategoria[animal.categoria] !== undefined) {
          animalesPorCategoria[animal.categoria] += animal.cantidad
        } else {
          // Categoría no definida en el sistema
          animalesPorCategoria[animal.categoria] = animal.cantidad
        }
      })

      // Calcular UG y vacunos/ovinos totales del potrero
      let ugTotales = 0
      let vacunosTotales = 0
      let ovinosTotales = 0

      for (const [categoria, cantidad] of Object.entries(animalesPorCategoria)) {
        const eq = getEquivalenciaUG(categoria)
        ugTotales += cantidad * eq
        
        // Verificar tipo de animal
        const catDB = categoriasDB.find(c => c.nombreSingular === categoria)
        if (catDB?.tipoAnimal === 'BOVINO') {
          vacunosTotales += cantidad
        } else if (catDB?.tipoAnimal === 'OVINO') {
          ovinosTotales += cantidad
        }
      }

      const ugPorHa = lote.hectareas > 0 ? ugTotales / lote.hectareas : 0

      return {
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        animalesPorCategoria,
        ugPorHa,
        vacunosTotales,
        ovinosTotales
      }
    })

    // Calcular totales
    const totales = {
      hectareas: potreros.reduce((sum, p) => sum + p.hectareas, 0),
      porCategoria: {} as Record<string, number>,
      ugTotales: 0,
      vacunosTotales: 0,
      ovinosTotales: 0
    }

    // Inicializar totales por categoría
    categoriasDB.forEach(cat => {
      totales.porCategoria[cat.nombreSingular] = 0
    })

    // Sumar totales
    potreros.forEach(p => {
      for (const [categoria, cantidad] of Object.entries(p.animalesPorCategoria)) {
        if (totales.porCategoria[categoria] !== undefined) {
          totales.porCategoria[categoria] += cantidad
        }
      }
      totales.ugTotales += p.ugPorHa * p.hectareas
      totales.vacunosTotales += p.vacunosTotales
      totales.ovinosTotales += p.ovinosTotales
    })

    const ugPorHaGlobal = totales.hectareas > 0 ? totales.ugTotales / totales.hectareas : 0

    // Devolver JSON con los datos para generar el PDF en el cliente
    return NextResponse.json({
      campo: {
        nombre: usuario.campo.nombre,
        hectareasTotal: totales.hectareas
      },
      categorias: {
        bovinas: categoriasBovinas,
        ovinas: categoriasOvinas,
        equinas: categoriasEquinas
      },
      potreros,
      totales: {
        ...totales,
        ugPorHa: ugPorHaGlobal
      },
      fecha: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generando reporte:', error)
    return NextResponse.json(
      { error: 'Error generando reporte' },
      { status: 500 }
    )
  }
}