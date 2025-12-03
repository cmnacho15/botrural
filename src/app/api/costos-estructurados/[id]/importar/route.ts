import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * POST - Importar gastos del mes y distribuirlos según mapeo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params

    // Verificar que el mes existe
    const costoMensual = await prisma.costoMensual.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
      include: {
        renglones: true,
      },
    })

    if (!costoMensual) {
      return NextResponse.json(
        { error: 'Costo mensual no encontrado' },
        { status: 404 }
      )
    }

    if (costoMensual.bloqueado) {
      return NextResponse.json(
        { error: 'Este mes está bloqueado y no se puede importar' },
        { status: 400 }
      )
    }

    // 1. Obtener todas las categorías con mapeo activo
    const categoriasMapeadas = await prisma.categoriaGasto.findMany({
      where: {
        campoId: session.user.campoId,
        mapeadaACostos: true,
        activo: true,
      },
    })

    if (categoriasMapeadas.length === 0) {
      return NextResponse.json(
        { error: 'No hay categorías mapeadas. Configure el mapeo primero.' },
        { status: 400 }
      )
    }

    // 2. Obtener todos los gastos del mes/año
    const fechaInicio = new Date(costoMensual.anio, costoMensual.mes - 1, 1)
    const fechaFin = new Date(costoMensual.anio, costoMensual.mes, 0, 23, 59, 59)

    const gastosDelMes = await prisma.gasto.findMany({
      where: {
        campoId: session.user.campoId,
        tipo: 'GASTO',
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
      },
    })

    // 3. Mapear y acumular montos por renglón
    const acumuladores: Record<string, {
      total: number
      vacuno: number
      ovino: number
      equino: number
      desperdicios: number
    }> = {}

    for (const gasto of gastosDelMes) {
      // Buscar si esta categoría tiene mapeo
      const categoriaConfig = categoriasMapeadas.find(
        (c) => c.nombre === gasto.categoria
      )

      if (!categoriaConfig) continue

      // Obtener monto en USD (siempre trabajamos en USD)
      let montoUSD = gasto.montoEnUYU || gasto.monto || 0

      // Si el gasto original era en USD, usar ese monto
      if (gasto.moneda === 'USD' && gasto.montoOriginal) {
        montoUSD = gasto.montoOriginal
      } else {
        // Convertir UYU a USD (usando tasa del gasto o tasa promedio)
        const tasa = gasto.tasaCambio || 40
        montoUSD = montoUSD / tasa
      }

      // Construir clave del renglón
      const claveRenglon = `${categoriaConfig.categoriaCostoEstructurado}_${categoriaConfig.subcategoriaCosto}`

      if (!acumuladores[claveRenglon]) {
        acumuladores[claveRenglon] = {
          total: 0,
          vacuno: 0,
          ovino: 0,
          equino: 0,
          desperdicios: 0,
        }
      }

      // Distribuir según porcentajes
      acumuladores[claveRenglon].total += montoUSD
      acumuladores[claveRenglon].vacuno +=
        (montoUSD * categoriaConfig.porcentajeVacuno) / 100
      acumuladores[claveRenglon].ovino +=
        (montoUSD * categoriaConfig.porcentajeOvino) / 100
      acumuladores[claveRenglon].equino +=
        (montoUSD * categoriaConfig.porcentajeEquino) / 100
      acumuladores[claveRenglon].desperdicios +=
        (montoUSD * categoriaConfig.porcentajeDesperdicios) / 100
    }

    // 4. Actualizar renglones en la base de datos
    const actualizaciones: any[] = []
    const ahora = new Date()

    for (const [claveRenglon, montos] of Object.entries(acumuladores)) {
      const [categoria, subcategoria] = claveRenglon.split('_')

      actualizaciones.push(
        prisma.costoRenglon.updateMany({
          where: {
            costoMensualId: id,
            categoria,
            subcategoria,
          },
          data: {
            montoTotalUSD: montos.total,
            montoVacunoUSD: montos.vacuno,
            montoOvinoUSD: montos.ovino,
            montoEquinoUSD: montos.equino,
            montoDesperdiciosUSD: montos.desperdicios,
            ultimaImportacion: ahora,
          },
        })
      )
    }

    await Promise.all(actualizaciones)

    // 5. Recalcular totales por categoría
    await recalcularTotales(id)

    // 6. Obtener resultado actualizado
    const resultado = await prisma.costoMensual.findUnique({
      where: { id },
      include: {
        renglones: {
          orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
        },
      },
    })

    return NextResponse.json({
      success: true,
      gastosImportados: gastosDelMes.length,
      categoriasActualizadas: Object.keys(acumuladores).length,
      data: resultado,
    })
  } catch (error) {
    console.error('Error al importar gastos:', error)
    return NextResponse.json(
      { error: 'Error al importar gastos' },
      { status: 500 }
    )
  }
}

/**
 * Helper: Recalcular totales de cada categoría
 */
async function recalcularTotales(costoMensualId: string) {
  const renglones = await prisma.costoRenglon.findMany({
    where: {
      costoMensualId,
      esTotal: false,
    },
  })

  // Agrupar por categoría
  const totalesPorCategoria: Record<string, any> = {}

  for (const renglon of renglones) {
    if (!totalesPorCategoria[renglon.categoria]) {
      totalesPorCategoria[renglon.categoria] = {
        total: 0,
        vacuno: 0,
        ovino: 0,
        equino: 0,
        desperdicios: 0,
      }
    }

    totalesPorCategoria[renglon.categoria].total += renglon.montoTotalUSD
    totalesPorCategoria[renglon.categoria].vacuno += renglon.montoVacunoUSD
    totalesPorCategoria[renglon.categoria].ovino += renglon.montoOvinoUSD
    totalesPorCategoria[renglon.categoria].equino += renglon.montoEquinoUSD
    totalesPorCategoria[renglon.categoria].desperdicios +=
      renglon.montoDesperdiciosUSD
  }

  // Actualizar filas TOTAL
  const actualizaciones = Object.entries(totalesPorCategoria).map(
    ([categoria, totales]) =>
      prisma.costoRenglon.updateMany({
        where: {
          costoMensualId,
          categoria,
          subcategoria: 'TOTAL',
          esTotal: true,
        },
        data: {
          montoTotalUSD: totales.total,
          montoVacunoUSD: totales.vacuno,
          montoOvinoUSD: totales.ovino,
          montoEquinoUSD: totales.equino,
          montoDesperdiciosUSD: totales.desperdicios,
        },
      })
  )

  await Promise.all(actualizaciones)
}