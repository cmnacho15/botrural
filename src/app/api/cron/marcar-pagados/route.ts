import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    // 🔒 Verificar autorización (seguridad)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 📅 Obtener fecha actual
    const ahora = new Date()

    // =========================================
    // 1️⃣ PROCESAR GASTOS A PLAZO (tabla Gasto, tipo: "GASTO")
    // =========================================
    
    const gastosVencidos = await prisma.gasto.findMany({
      where: {
        tipo: 'GASTO',
        metodoPago: 'Plazo',
        pagado: false,
        // ✅ Quitamos las validaciones not: null de aquí
      },
    })

    const gastosAMarcar = gastosVencidos.filter(gasto => {
      if (!gasto.fecha || !gasto.diasPlazo) return false
      
      const fechaVencimiento = new Date(gasto.fecha)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + gasto.diasPlazo)
      
      return fechaVencimiento <= ahora
    })

    const idsGastosAMarcar = gastosAMarcar.map(g => g.id)
    
    const resultadoGastos = idsGastosAMarcar.length > 0 
      ? await prisma.gasto.updateMany({
          where: { id: { in: idsGastosAMarcar } },
          data: { pagado: true }
        })
      : { count: 0 }

    console.log(`✅ Gastos: ${resultadoGastos.count} marcados como pagados`)

    // =========================================
    // 2️⃣ PROCESAR INGRESOS A PLAZO (tabla Gasto, tipo: "INGRESO")
    // =========================================
    
    const ingresosVencidos = await prisma.gasto.findMany({
      where: {
        tipo: 'INGRESO',
        metodoPago: 'Plazo',
        pagado: false,
        // ✅ Quitamos las validaciones not: null de aquí
      },
    })

    const ingresosAMarcar = ingresosVencidos.filter(ingreso => {
      if (!ingreso.fecha || !ingreso.diasPlazo) return false
      
      const fechaVencimiento = new Date(ingreso.fecha)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + ingreso.diasPlazo)
      
      return fechaVencimiento <= ahora
    })

    const idsIngresosAMarcar = ingresosAMarcar.map(i => i.id)
    
    const resultadoIngresos = idsIngresosAMarcar.length > 0
      ? await prisma.gasto.updateMany({
          where: { id: { in: idsIngresosAMarcar } },
          data: { pagado: true }
        })
      : { count: 0 }

    console.log(`✅ Ingresos: ${resultadoIngresos.count} marcados como cobrados`)

    // =========================================
    // 3️⃣ RESUMEN FINAL
    // =========================================
    
    const totalActualizados = resultadoGastos.count + resultadoIngresos.count

    console.log(`🎯 TOTAL: ${totalActualizados} registros actualizados (${resultadoGastos.count} gastos + ${resultadoIngresos.count} ingresos)`)

    return NextResponse.json({ 
      success: true,
      fecha: ahora.toISOString(),
      resumen: {
        totalActualizados,
        gastos: {
          encontrados: gastosVencidos.length,
          vencidos: gastosAMarcar.length,
          marcados: resultadoGastos.count,
          detalles: gastosAMarcar.map(g => ({
            id: g.id,
            descripcion: g.descripcion,
            monto: g.monto,
            fechaOriginal: g.fecha,
            diasPlazo: g.diasPlazo,
            fechaVencimiento: new Date(new Date(g.fecha!).getTime() + (g.diasPlazo! * 24 * 60 * 60 * 1000)).toISOString()
          }))
        },
        ingresos: {
          encontrados: ingresosVencidos.length,
          vencidos: ingresosAMarcar.length,
          marcados: resultadoIngresos.count,
          detalles: ingresosAMarcar.map(i => ({
            id: i.id,
            descripcion: i.descripcion,
            monto: i.monto,
            fechaOriginal: i.fecha,
            diasPlazo: i.diasPlazo,
            fechaVencimiento: new Date(new Date(i.fecha!).getTime() + (i.diasPlazo! * 24 * 60 * 60 * 1000)).toISOString()
          }))
        }
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

// 🧪 También permitir POST para testing manual
export async function POST(request: Request) {
  return GET(request)
}