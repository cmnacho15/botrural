// src/app/api/mapa-imagen/route.tsx
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ImageResponse } from '@vercel/og'

const COLORES_POTREROS = [
  '#E53E3E', '#3182CE', '#38A169', '#D69E2E', '#805AD5',
  '#DD6B20', '#319795', '#E91E8C', '#2D3748', '#00B5D8',
  '#C53030', '#2B6CB0', '#276749', '#B7791F', '#6B46C1',
  '#C05621', '#285E61', '#B83280', '#1A202C', '#0987A0',
  '#F56565', '#4299E1', '#48BB78', '#ECC94B', '#9F7AEA',
  '#ED8936', '#4FD1C5', '#F687B3', '#A0AEC0', '#76E4F7',
]

interface PotreroData {
  nombre: string
  hectareas: number
  color: string
  animales: { categoria: string; cantidad: number }[]
  cultivos: { tipoCultivo: string }[]
  coordinates: number[][]
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'bot-internal-key')) {
      return new Response('No autorizado', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campoId = searchParams.get('campoId')
    if (!campoId) return new Response('campoId requerido', { status: 400 })

    const campo = await prisma.campo.findUnique({ where: { id: campoId } })
    if (!campo) return new Response('Campo no encontrado', { status: 404 })

    const lotes = await prisma.lote.findMany({
      where: { campoId },
      include: { cultivos: true, animalesLote: true },
      orderBy: { nombre: 'asc' }
    })
    if (lotes.length === 0) return new Response('No hay potreros', { status: 400 })

    const potreros: PotreroData[] = lotes.map((lote, i) => ({
      nombre: lote.nombre,
      hectareas: lote.hectareas,
      color: COLORES_POTREROS[i % COLORES_POTREROS.length],
      animales: lote.animalesLote.map(a => ({ categoria: a.categoria, cantidad: a.cantidad })),
      cultivos: lote.cultivos.map(c => ({ tipoCultivo: c.tipoCultivo })),
      coordinates: lote.poligono as number[][]
    }))

    // Bounding box y zoom
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    potreros.forEach(p => p.coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
    }))
    const pad = 0.15
    minLng -= (maxLng - minLng) * pad; maxLng += (maxLng - minLng) * pad
    minLat -= (maxLat - minLat) * pad; maxLat += (maxLat - minLat) * pad
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)
    const zoom = maxDiff > 0.1 ? 11 : maxDiff > 0.05 ? 12 : maxDiff > 0.02 ? 13 : maxDiff > 0.01 ? 14 : 15

    const mapWidth = 600
    const mapHeight = 375
    const headerHeight = 55
    const legendRowHeight = 55
    const legendPadding = 90
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = headerHeight + mapHeight + legendHeight

    // Mapbox satelital
    console.log('🗺️ Solicitando mapa satelital a Mapbox...')
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${centerLng},${centerLat},${zoom},0/${mapWidth}x${mapHeight}@2x?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`
    const mapRes = await fetch(mapboxUrl)
    if (!mapRes.ok) {
      console.error('Error Mapbox:', mapRes.status)
      return new Response('Error obteniendo mapa', { status: 500 })
    }

    // Conversión a base64 sin Buffer
    const arrayBuffer = await mapRes.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const mapBase64 = btoa(binary)
    console.log('✅ Mapa satelital recibido')

    // Polígonos overlay
    const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * mapWidth
    const toPixelY = (lat: number) => mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight
    const polygonsSvg = potreros.map(p => {
      const points = p.coordinates.map(([lng, lat]) => 
        `${toPixelX(lng).toFixed(1)},${toPixelY(lat).toFixed(1)}`
      ).join(' ')
      return `<polygon points="${points}" fill="${p.color}" fill-opacity="0.4" stroke="${p.color}" stroke-width="3"/>`
    }).join('')

    const fecha = new Date().toLocaleDateString('es-UY')

    // Fuentes Inter regular + bold
    const [regularFont, boldFont] = await Promise.all([
      fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2').then(r => r.arrayBuffer()),
      fetch('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50SjIa1ZL7W0Q5n-wU.woff2').then(r => r.arrayBuffer())
    ])

    return new ImageResponse(
      (
        <div style={{ width: mapWidth, height: totalHeight, background: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'Inter' }}>
          {/* Header */}
          <div style={{ height: headerHeight, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>Mapa: {campo.nombre}</span>
          </div>

          {/* Mapa + polígonos */}
          <div style={{ position: 'relative', height: mapHeight }}>
            <img src={`data:image/png;base64,${mapBase64}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
              <g dangerouslySetInnerHTML={{ __html: polygonsSvg }} />
            </svg>
          </div>

          {/* Leyenda */}
          <div style={{ padding: '20px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Detalle por Potrero:</span>
            {potreros.map(p => {
              const totalAnimales = p.animales.reduce((s, a) => s + a.cantidad, 0)
              const animalesTexto = totalAnimales ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ') : '(sin animales)'
              const cultivosTexto = p.cultivos.length ? p.cultivos.map(c => c.tipoCultivo).join(' + ') : ''
              return (
                <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 8, padding: '12px', borderLeft: `6px solid ${p.color}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: p.color, marginRight: 15 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: p.color }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.hectareas.toFixed(1)} ha</div>
                  </div>
                  <div style={{ flex: 2, marginLeft: 20 }}>
                    <div style={{ fontSize: 13, color: '#334155' }}>{animalesTexto}</div>
                    {cultivosTexto && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>{cultivosTexto}</div>}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 'auto', paddingTop: 15, textAlign: 'center', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
              Bot Rural - {fecha}
            </div>
          </div>
        </div>
      ),
      {
        width: mapWidth,
        height: totalHeight,
        fonts: [
          { name: 'Inter', data: regularFont, weight: 400 },
          { name: 'Inter', data: boldFont, weight: 700 }
        ]
      }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response('Error interno', { status: 500 })
  }
}