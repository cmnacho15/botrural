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
    const periodo = searchParams.get('periodo') || 'mensual'

    // ===========================
    // FECHAS
    // ===========================
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    let fechaInicio: Date

    if (periodo === 'ejercicio') {
      const añoActual = hoy.getFullYear()
      const mesActual = hoy.getMonth() + 1
      const añoEjercicio = mesActual >= 7 ? añoActual : añoActual - 1
      fechaInicio = new Date(añoEjercicio, 6, 1)
    } else {
      fechaInicio = new Date(hoy)
      fechaInicio.setMonth(fechaInicio.getMonth() - 12)
      fechaInicio.setDate(1)
    }

    // ===========================
    // LOTES (SIEMPRE TODOS)
    // ===========================
    const lotes = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      select: { id: true, nombre: true, hectareas: true },
      orderBy: { nombre: 'asc' },
    })

    // ===========================
    // SNAPSHOTS (SIEMPRE TODOS)
    // ===========================
    const snapshots = await prisma.cargaHistorica.findMany({
      where: {
        campoId: usuario.campoId,
        fecha: { gte: fechaInicio, lte: hoy },
      },
      orderBy: [{ loteId: 'asc' }, { fecha: 'asc' }],
      select: { fecha: true, loteId: true, ugTotal: true },
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

    // ===============================
    // 📅 Generar lista de días
    // ===============================
    const dias: string[] = []
    const cursor = new Date(fechaInicio)

    while (cursor <= hoy) {
      dias.push(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }

    // ===============================
    // 🔢 Calcular UG diaria por lote
    // ===============================
    const seriesPorLote = lotes.map((lote) => {
      const snapshotsLote = snapshotsPorLote.get(lote.id) || []

      const ugPorDia = dias.map((diaStr) => {
        const fechaDia = new Date(diaStr)

        let ugDelDia = 0
        for (let i = snapshotsLote.length - 1; i >= 0; i--) {
          if (snapshotsLote[i].fecha <= fechaDia) {
            ugDelDia = snapshotsLote[i].ugTotal
            break
          }
        }

        return Math.round(ugDelDia * 100) / 100
      })

      return {
        loteId: lote.id,
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        datos: ugPorDia,
        cargaPorHectarea: ugPorDia.map((ug) =>
          lote.hectareas > 0 ? Math.round((ug / lote.hectareas) * 100) / 100 : 0
        ),
      }
    })

    // ===============================
    // 🌍 UG GLOBAL diaria (SIEMPRE)
    // ===============================
    const ugGlobalPorDia = dias.map((_, index) =>
      seriesPorLote.reduce((sum, lote) => sum + lote.datos[index], 0)
    )

    const hectareasTotales = lotes.reduce((sum, l) => sum + l.hectareas, 0)

    const ugPorHaGlobal = ugGlobalPorDia.map((ug) =>
      hectareasTotales > 0 ? Math.round((ug / hectareasTotales) * 100) / 100 : 0
    )

    const global = {
      ug: ugGlobalPorDia,
      ugPorHectarea: ugPorHaGlobal,
      hectareasTotales,
    }

    // ===============================
    // 📤 RESPUESTA FINAL
    // ===============================
    return NextResponse.json({
      dias,
      lotes: seriesPorLote,
      global, // SIEMPRE EXISTE
    })

  } catch (error) {
    console.error('Error en /api/ug-evolution:', error)
    return NextResponse.json(
      { error: 'Error calculando evolución UG' },
      { status: 500 }
    )
  }
}