// src/app/api/mapa-imagen/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

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

// Caches globales
let isWasmInitialized = false
let regularFont: Uint8Array | null = null
let boldFont: Uint8Array | null = null

async function initWasmIfNeeded() {
  if (!isWasmInitialized) {
    const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'
    const res = await fetch(wasmUrl, { headers: { 'Accept': 'application/wasm' } })
    if (!res.ok) throw new Error(`WASM fetch failed: ${res.status}`)
    const wasmBuffer = await res.arrayBuffer()
    await initWasm(new Uint8Array(wasmBuffer))
    console.log('✅ WASM inicializado')
    isWasmInitialized = true
  }
}

async function getFonts(): Promise<Uint8Array[]> {
  if (regularFont && boldFont) return [regularFont, boldFont]
  
  const urls = {
    regular: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
    bold: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50SjIa1ZL7W0Q5n-wU.woff2'
  }
  
  const [regRes, boldRes] = await Promise.all([fetch(urls.regular), fetch(urls.bold)])
  regularFont = new Uint8Array(await regRes.arrayBuffer())
  boldFont = new Uint8Array(await boldRes.arrayBuffer())
  console.log('✅ Fuentes Inter cargadas')
  return [regularFont, boldFont]
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

    // Bounding box
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    potreros.forEach(p => p.coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }))
    
    const lngPad = (maxLng - minLng) * 0.15
    const latPad = (maxLat - minLat) * 0.15
    minLng -= lngPad
    maxLng += lngPad
    minLat -= latPad
    maxLat += latPad
    
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)
    const zoom = maxDiff > 0.1 ? 11 : maxDiff > 0.05 ? 12 : maxDiff > 0.02 ? 13 : maxDiff > 0.01 ? 14 : 15

    const mapWidth = 800
    const mapHeight = 500
    const headerHeight = 55
    const legendRowHeight = 52
    const legendPadding = 80
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = headerHeight + mapHeight + legendHeight

    // Mapbox
    console.log('🗺️ Solicitando mapa satelital...')
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${centerLng},${centerLat},${zoom},0/${mapWidth}x${mapHeight}@2x?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`
    const mapRes = await fetch(mapboxUrl)
    if (!mapRes.ok) return new Response('Error Mapbox', { status: 500 })
    const mapBase64 = Buffer.from(await mapRes.arrayBuffer()).toString('base64')
    console.log('✅ Mapa satelital recibido')

    // Coordenadas a píxeles
    const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * mapWidth
    const toPixelY = (lat: number) => mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight

    // Generar polígonos SVG
    const polygonsSvg = potreros.map(p => {
      const points = p.coordinates.map(([lng, lat]) => 
        `${toPixelX(lng).toFixed(1)},${toPixelY(lat).toFixed(1)}`
      ).join(' ')
      return `<polygon points="${points}" fill="${p.color}" fill-opacity="0.4" stroke="${p.color}" stroke-width="3"/>`
    }).join('')

    // Init WASM y fuentes
    await initWasmIfNeeded()
    const fonts = await getFonts()
    const fecha = new Date().toLocaleDateString('es-UY')

    // Generar leyenda SVG
    const legendItems = potreros.map((p, i) => {
      const y = headerHeight + mapHeight + 50 + (i * legendRowHeight)
      const totalAnimales = p.animales.reduce((s, a) => s + a.cantidad, 0)
      const animalesTexto = totalAnimales > 0 
        ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
        : '(sin animales)'
      const cultivosTexto = p.cultivos.length > 0
        ? p.cultivos.map(c => c.tipoCultivo).join(' + ')
        : ''

      return `
        <rect x="12" y="${y}" width="776" height="${legendRowHeight - 6}" rx="8" fill="white" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="12" y="${y}" width="5" height="${legendRowHeight - 6}" rx="2" fill="${p.color}"/>
        <circle cx="38" cy="${y + 23}" r="11" fill="${p.color}"/>
        <text x="60" y="${y + 19}" fill="${p.color}" font-size="14" font-weight="700" font-family="Inter">${escapeXml(p.nombre)}</text>
        <text x="60" y="${y + 36}" fill="#64748b" font-size="11" font-family="Inter">${p.hectareas.toFixed(1)} ha</text>
        <text x="200" y="${y + 19}" fill="#334155" font-size="12" font-family="Inter">${escapeXml(animalesTexto)}</text>
        ${cultivosTexto ? `<text x="200" y="${y + 36}" fill="#16a34a" font-size="11" font-family="Inter">${escapeXml(cultivosTexto)}</text>` : ''}
      `
    }).join('')

    // SVG completo
    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${mapWidth}" height="${totalHeight}">
  <rect width="${mapWidth}" height="${totalHeight}" fill="#f1f5f9"/>
  
  <rect width="${mapWidth}" height="${headerHeight}" fill="#1e293b"/>
  <text x="${mapWidth/2}" y="36" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="Inter">Mapa: ${escapeXml(campo.nombre)}</text>
  
  <image x="0" y="${headerHeight}" width="${mapWidth}" height="${mapHeight}" xlink:href="data:image/png;base64,${mapBase64}" preserveAspectRatio="xMidYMid slice"/>
  
  <g transform="translate(0, ${headerHeight})">
    ${polygonsSvg}
  </g>
  
  <text x="15" y="${headerHeight + mapHeight + 30}" fill="#1e293b" font-size="16" font-weight="700" font-family="Inter">Detalle por Potrero:</text>
  
  ${legendItems}
  
  <rect y="${totalHeight - 32}" width="${mapWidth}" height="32" fill="#e2e8f0"/>
  <text x="${mapWidth/2}" y="${totalHeight - 12}" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter">Bot Rural - ${fecha}</text>
</svg>`

    console.log('🔄 Renderizando PNG con Resvg...')

    // Renderizar con Resvg
    const resvg = new Resvg(fullSvg, {
      fitTo: { mode: 'width', value: mapWidth },
      font: {
        fontBuffers: fonts,
        loadSystemFonts: false,
        defaultFontFamily: 'Inter'
      }
    })
    
    const pngBuffer = resvg.render().asPng()
    console.log('✅ Imagen generada!')

    return new Response(new Uint8Array(pngBuffer), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' }
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(`Error: ${(error as Error).message}`, { status: 500 })
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}