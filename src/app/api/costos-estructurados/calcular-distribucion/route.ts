// app/api/costos-estructurados/calcular-distribucion/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { EQUIVALENCIAS_UG } from '@/lib/ugCalculator'

/**
 * GET - Calcular distribución actual de hectáreas según UG en potreros
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 1. Obtener todos los lotes con animales
    const lotes = await prisma.lote.findMany({
      where: { campoId: session.user.campoId },
      include: {
        animalesLote: true  // ✅ Sin incluir animal (categoria está directo)
      }
    })

    let totalHectareas = 0
    let ugVacunos = 0
    let ugOvinos = 0
    let ugEquinos = 0

    // 2. Calcular UG por tipo de animal
    for (const lote of lotes) {
      totalHectareas += lote.hectareas

      for (const animalLote of lote.animalesLote) {
        const categoria = animalLote.categoria  // ✅ Directo desde animalLote
        const cantidad = animalLote.cantidad
        const equivalencia = EQUIVALENCIAS_UG[categoria] || 0
        const ugTotales = cantidad * equivalencia

        // Clasificar por tipo
        const catLower = categoria.toLowerCase()
        if (catLower.includes('oveja') || 
            catLower.includes('cordero') ||
            catLower.includes('carnero') ||
            catLower.includes('borrega') ||
            catLower.includes('capón')) {
          ugOvinos += ugTotales
        } else if (catLower.includes('yegua') || 
                   catLower.includes('caballo') ||
                   catLower.includes('potrillo') ||
                   catLower.includes('equino') ||
                   catLower.includes('potro')) {
          ugEquinos += ugTotales
        } else {
          // Por defecto: vacunos
          ugVacunos += ugTotales
        }
      }
    }

    const ugTotales = ugVacunos + ugOvinos + ugEquinos

    // 3. Calcular hectáreas proporcionales a las UG
    const hectareasVacuno = ugTotales > 0 
      ? (ugVacunos / ugTotales) * totalHectareas 
      : 0
    
    const hectareasOvino = ugTotales > 0 
      ? (ugOvinos / ugTotales) * totalHectareas 
      : 0
    
    const hectareasEquino = ugTotales > 0 
      ? (ugEquinos / ugTotales) * totalHectareas 
      : 0

    // 4. Calcular porcentajes
    const porcentajes = {
      vacuno: totalHectareas > 0 ? (hectareasVacuno / totalHectareas) * 100 : 0,
      ovino: totalHectareas > 0 ? (hectareasOvino / totalHectareas) * 100 : 0,
      equino: totalHectareas > 0 ? (hectareasEquino / totalHectareas) * 100 : 0,
    }

    return NextResponse.json({
      totalHectareas,
      hectareasVacuno: Math.round(hectareasVacuno * 100) / 100,
      hectareasOvino: Math.round(hectareasOvino * 100) / 100,
      hectareasEquino: Math.round(hectareasEquino * 100) / 100,
      hectareasDesperdicios: 0, // Por ahora en 0
      ug: {
        vacuno: ugVacunos,
        ovino: ugOvinos,
        equino: ugEquinos,
        total: ugTotales,
      },
      porcentajes,
      cargaGlobal: totalHectareas > 0 ? ugTotales / totalHectareas : 0,
    })
  } catch (error) {
    console.error('Error calculando distribución:', error)
    return NextResponse.json(
      { error: 'Error al calcular distribución' },
      { status: 500 }
    )
  }
}