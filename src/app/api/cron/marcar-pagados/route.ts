//src/app/api/cron/marcar-pagados/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ahora = new Date()

    // ✅ OPTIMIZACIÓN: Query más específica con fecha calculada
    // En lugar de traer TODOS y filtrar en memoria, calculamos la fecha límite
    const fechaLimite = new Date(ahora)
    fechaLimite.setDate(fechaLimite.getDate() - 365) // Rango razonable (1 año atrás)

    // GASTOS A PLAZO
    const gastosVencidos = await prisma.gasto.findMany({
      where: {
        tipo: 'GASTO',
        metodoPago: 'Plazo',
        pagado: false,
        fecha: { gte: fechaLimite }, // ✅ Filtrar por rango de fecha
        diasPlazo: { not: null },
      },
      select: {
        id: true,
        fecha: true,
        diasPlazo: true,
        descripcion: true,
        monto: true,
      },
    })

    const gastosAMarcar = gastosVencidos.filter(gasto => {
      const fechaVencimiento = new Date(gasto.fecha!)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + gasto.diasPlazo!)
      return fechaVencimiento <= ahora
    })

    const resultadoGastos = gastosAMarcar.length > 0 
      ? await prisma.gasto.updateMany({
          where: { id: { in: gastosAMarcar.map(g => g.id) } },
          data: { pagado: true }
        })
      : { count: 0 }

    // INGRESOS A PLAZO
    const ingresosVencidos = await prisma.gasto.findMany({
      where: {
        tipo: 'INGRESO',
        metodoPago: 'Plazo',
        pagado: false,
        fecha: { gte: fechaLimite },
        diasPlazo: { not: null },
      },
      select: {
        id: true,
        fecha: true,
        diasPlazo: true,
        descripcion: true,
        monto: true,
      },
    })

    const ingresosAMarcar = ingresosVencidos.filter(ingreso => {
      const fechaVencimiento = new Date(ingreso.fecha!)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + ingreso.diasPlazo!)
      return fechaVencimiento <= ahora
    })

    const resultadoIngresos = ingresosAMarcar.length > 0
      ? await prisma.gasto.updateMany({
          where: { id: { in: ingresosAMarcar.map(i => i.id) } },
          data: { pagado: true }
        })
      : { count: 0 }

    const totalActualizados = resultadoGastos.count + resultadoIngresos.count

    console.log(`🎯 TOTAL: ${totalActualizados} registros actualizados`)

    return NextResponse.json({ 
      success: true,
      fecha: ahora.toISOString(),
      resumen: {
        totalActualizados,
        gastos: { marcados: resultadoGastos.count },
        ingresos: { marcados: resultadoIngresos.count },
      }
    })

  } catch (error) {
    console.error('❌ Error en cron job:', error)
    return NextResponse.json({ 
      error: 'Error al ejecutar cron job',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}