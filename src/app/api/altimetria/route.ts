import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { potreroId, bbox, coordinates } = await request.json()

    // Validar input
    if (!potreroId || !bbox || !coordinates) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    console.log('🔍 Verificando cache para potrero:', potreroId)

    // 1. Verificar si ya existe en cache
    const { data: cached, error: cacheError } = await supabase
      .from('altimetria_cache')
      .select('*')
      .eq('potrero_id', potreroId)
      .single()

    if (cached && !cacheError) {
      console.log('✅ Encontrado en cache:', cached.image_url)
      return NextResponse.json({
        status: 'cached',
        imageUrl: cached.image_url,
        bbox: cached.bbox
      })
    }

    console.log('❌ No encontrado en cache, iniciando procesamiento...')

    // 2. Si no existe, llamar al worker de Railway
    const workerUrl = process.env.ALTIMETRIA_WORKER_URL

    if (!workerUrl) {
      return NextResponse.json(
        { error: 'Worker URL no configurada' },
        { status: 500 }
      )
    }

    console.log('📡 Llamando a worker:', workerUrl)

    const response = await fetch(`${workerUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ potreroId, bbox, coordinates }),
    })

    if (!response.ok) {
      throw new Error(`Worker respondió con status ${response.status}`)
    }

    const result = await response.json()

    console.log('✅ Worker respondió:', result)

    return NextResponse.json({
      status: 'processing',
      message: 'Procesamiento iniciado. Puede tardar unos segundos.',
      potreroId
    })

  } catch (error) {
    console.error('❌ Error en API altimetria:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const potreroId = searchParams.get('potreroId')

    if (!potreroId) {
      return NextResponse.json(
        { error: 'potreroId requerido' },
        { status: 400 }
      )
    }

    // Verificar cache
    const { data: cached, error } = await supabase
      .from('altimetria_cache')
      .select('*')
      .eq('potrero_id', potreroId)
      .single()

    if (error || !cached) {
      return NextResponse.json({
        status: 'not_found',
        message: 'No hay datos en cache para este potrero'
      })
    }

    return NextResponse.json({
      status: 'ready',
      imageUrl: cached.image_url,
      bbox: cached.bbox,
      createdAt: cached.created_at
    })

  } catch (error) {
    console.error('❌ Error verificando cache:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}