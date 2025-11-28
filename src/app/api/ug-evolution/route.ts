import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId') // null = todos los lotes
    const periodo = searchParams.get('periodo') || 'mensual' // 'mensual' | 'ejercicio'

    // Definir rango de fechas
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    let fechaInicio: Date

    if (periodo === 'ejercicio') {
      // Ejercicio ganadero: 1 julio año anterior al 30 junio actual
      const añoActual = hoy.getFullYear()
      const mesActual = hoy.getMonth() + 1
      const añoEjercicio = mesActual >= 7 ? añoActual : añoActual - 1
      fechaInicio = new Date(añoEjercicio, 6, 1) // 1 de julio
    } else {
      // Últimos 12 meses
      fechaInicio = new Date(hoy)
      fechaInicio.setMonth(fechaInicio.getMonth() - 12)
      fechaInicio.setDate(1)
    }

    // Obtener lotes a analizar
    const lotes = await prisma.lote.findMany({
      where: {
        campoId: usuario.campoId,
        ...(loteId && { id: loteId }),
      },
      select: {
        id: true,
        nombre: true,
        hectareas: true,
      },
      orderBy: { nombre: 'asc' },
    })

    // Cargar snapshots del período
    const snapshots = await prisma.cargaHistorica.findMany({
      where: {
        campoId: usuario.campoId,
        fecha: {
          gte: fechaInicio,
          lte: hoy,
        },
        ...(loteId && { loteId }),
      },
      orderBy: [{ loteId: 'asc' }, { fecha: 'asc' }],
      select: {
        fecha: true,
        loteId: true,
        ugTotal: true,
      },
    })

    // Agrupar snapshots por lote
    const snapshotsPorLote = new Map<string, Array<{ fecha: Date; ugTotal: number }>>()
    
    for (const snap of snapshots) {
      if (!snapshotsPorLote.has(snap.loteId)) {
        snapshotsPorLote.set(snap.loteId, [])
      }
      snapshotsPorLote.get(snap.loteId)!.push({
        fecha: snap.fecha,
        ugTotal: snap.ugTotal,
      })
    }

    // Generar lista de meses
    const meses: string[] = []
    const fechaActual = new Date(fechaInicio)

    while (fechaActual <= hoy) {
      meses.push(fechaActual.toISOString().slice(0, 7)) // YYYY-MM
      fechaActual.setMonth(fechaActual.getMonth() + 1)
    }

    // Calcular UG mensual prorrateada por lote
    const seriesPorLote = lotes.map((lote) => {
      const snapshotsLote = snapshotsPorLote.get(lote.id) || []

      const ugPorMes = meses.map((mes) => {
        const [año, mesNum] = mes.split('-').map(Number)
        const primerDia = new Date(año, mesNum - 1, 1)
        const ultimoDia = new Date(año, mesNum, 0) // Último día del mes
        const diasDelMes = ultimoDia.getDate()

        // Reconstruir UG diaria del mes
        let sumaUGDiaria = 0

        for (let dia = 1; dia <= diasDelMes; dia++) {
          const fechaDia = new Date(año, mesNum - 1, dia)

          // Buscar último snapshot <= fechaDia
          let ugDelDia = 0
          for (let i = snapshotsLote.length - 1; i >= 0; i--) {
            if (snapshotsLote[i].fecha <= fechaDia) {
              ugDelDia = snapshotsLote[i].ugTotal
              break
            }
          }

          sumaUGDiaria += ugDelDia
        }

        // Prorrateo
        const ugMensual = sumaUGDiaria / diasDelMes
        return Math.round(ugMensual * 100) / 100
      })

      return {
        loteId: lote.id,
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        datos: ugPorMes,
        cargaPorHectarea: ugPorMes.map((ug) =>
          lote.hectareas > 0 ? Math.round((ug / lote.hectareas) * 100) / 100 : 0
        ),
      }
    })

    // Calcular UG global (suma de todos los lotes)
    const ugGlobalPorMes = meses.map((mes, mesIndex) => {
      return seriesPorLote.reduce((suma, serie) => suma + serie.datos[mesIndex], 0)
    })

    const hectareasTotales = lotes.reduce((sum, l) => sum + l.hectareas, 0)
    const ugPorHaGlobal = ugGlobalPorMes.map((ug) =>
      hectareasTotales > 0 ? Math.round((ug / hectareasTotales) * 100) / 100 : 0
    )

    return NextResponse.json({
      meses: meses.map((m) => {
        const [año, mes] = m.split('-')
        return `${mes}/${año.slice(2)}` // Formato MM/AA
      }),
      lotes: seriesPorLote,
      global: {
        ug: ugGlobalPorMes,
        ugPorHectarea: ugPorHaGlobal,
        hectareasTotales,
      },
    })
  } catch (error) {
    console.error('Error en /api/ug-evolution:', error)
    return NextResponse.json(
      { error: 'Error calculando evolución UG' },
      { status: 500 }
    )
  }
}
