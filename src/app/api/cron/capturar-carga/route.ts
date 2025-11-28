import { NextResponse } from 'next/server'
import { capturarCargaDiaria } from '@/lib/historico/capturarCargaDiaria'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos máximo

export async function GET(request: Request) {
  try {
    // Verificar authorization header (para seguridad)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-123'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    console.log('🚀 Ejecutando captura diaria desde API...')

    const resultado = await capturarCargaDiaria()

    return NextResponse.json({
      success: true,
      mensaje: 'Captura diaria ejecutada correctamente',
      ...resultado,
    })
  } catch (error: any) {
    console.error('❌ Error en endpoint de captura:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error ejecutando captura diaria',
        mensaje: error.message,
      },
      { status: 500 }
    )
  }
}

// También permitir POST para mayor compatibilidad con servicios de cron
export async function POST(request: Request) {
  return GET(request)
}
//holaa