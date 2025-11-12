import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    // 🔒 Verificar autorización (seguridad)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRETT}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 📅 Obtener fecha actual
    const ahora = new Date()

    // 🔍 Buscar gastos que ya vencieron y marcarlos como pagados
    const gastosVencidos = await prisma.gasto.findMany({
      where: {
        metodoPago: 'Plazo',
        pagado: false,
        fecha: { not: null },
        diasPlazo: { not: null },
      },
    })

    // Filtrar los que realmente están vencidos
    const gastosAMarcar = gastosVencidos.filter(gasto => {
      if (!gasto.fecha || !gasto.diasPlazo) return false
      
      const fechaVencimiento = new Date(gasto.fecha)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + gasto.diasPlazo)
      
      return fechaVencimiento <= ahora
    })

    // ✅ Marcar como pagados
    const idsAMarcar = gastosAMarcar.map(g => g.id)
    
    const resultado = await prisma.gasto.updateMany({
      where: {
        id: { in: idsAMarcar }
      },
      data: {
        pagado: true
      }
    })

    console.log(`✅ Cron ejecutado: ${resultado.count} gastos marcados como pagados`)

    return NextResponse.json({ 
      success: true, 
      marcados: resultado.count,
      fecha: ahora.toISOString(),
      gastosActualizados: gastosAMarcar.map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: g.monto,
        fechaOriginal: g.fecha,
        diasPlazo: g.diasPlazo
      }))
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