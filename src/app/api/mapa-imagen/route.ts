// src/app/api/mapa-imagen/route.ts

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resvg } from '@resvg/resvg-js'

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

// Descargar y cachear la fuente
let fontBuffer: Buffer | null = null

async function getFont(): Promise<Buffer> {
  if (fontBuffer) return fontBuffer
  
  // Descargar Inter font de Google Fonts
  const fontUrl = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
  const response = await fetch(fontUrl)
  fontBuffer = Buffer.from(await response.arrayBuffer())
  return fontBuffer
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'bot-internal-key')) {
      return new Response('No autorizado', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campoId = searchParams.get('campoId')

    if (!campoId) {
      return new Response('campoId requerido', { status: 400 })
    }

    const campo = await prisma.campo.findUnique({
      where: { id: campoId }
    })

    if (!campo) {
      return new Response('Campo no encontrado', { status: 404 })
    }

    const lotes = await prisma.lote.findMany({
      where: { campoId },
      include: {
        cultivos: true,
        animalesLote: true,
      },
      orderBy: { nombre: 'asc' }
    })

    if (lotes.length === 0) {
      return new Response('No hay potreros', { status: 400 })
    }

    const potreros: PotreroData[] = lotes.map((lote, index) => ({
      nombre: lote.nombre,
      hectareas: lote.hectareas,
      color: COLORES_POTREROS[index % COLORES_POTREROS.length],
      animales: lote.animalesLote.map(a => ({
        categoria: a.categoria,
        cantidad: a.cantidad
      })),
      cultivos: lote.cultivos.map(c => ({
        tipoCultivo: c.tipoCultivo
      })),
      coordinates: lote.poligono as number[][]
    }))

    // Calcular bounding box
    let minLng = Infinity, maxLng = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    potreros.forEach(p => {
      p.coordinates.forEach(coord => {
        const [lng, lat] = coord
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      })
    })

    const lngPadding = (maxLng - minLng) * 0.15
    const latPadding = (maxLat - minLat) * 0.15
    minLng -= lngPadding
    maxLng += lngPadding
    minLat -= latPadding
    maxLat += latPadding

    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)
    let zoom = 14
    if (maxDiff > 0.1) zoom = 11
    else if (maxDiff > 0.05) zoom = 12
    else if (maxDiff > 0.02) zoom = 13
    else if (maxDiff > 0.01) zoom = 14
    else zoom = 15

    const mapWidth = 800
    const mapHeight = 500
    const headerHeight = 55
    const legendRowHeight = 55
    const legendPadding = 90
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = headerHeight + mapHeight + legendHeight

    // Obtener mapa satelital de Mapbox
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${centerLng},${centerLat},${zoom},0/${mapWidth}x${mapHeight}@2x?access_token=${mapboxToken}`

    console.log('🗺️ Solicitando mapa satelital a Mapbox...')
    
    const mapResponse = await fetch(mapboxUrl)
    
    if (!mapResponse.ok) {
      console.error('❌ Error de Mapbox:', mapResponse.status)
      return new Response('Error obteniendo mapa', { status: 500 })
    }

    const mapArrayBuffer = await mapResponse.arrayBuffer()
    const mapBase64 = Buffer.from(mapArrayBuffer).toString('base64')
    console.log('✅ Mapa satelital recibido')

    // Convertir coordenadas a píxeles
    const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * mapWidth
    const toPixelY = (lat: number) => mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight

    // Generar polígonos SVG
    const polygonsSvg = potreros.map(p => {
      const points = p.coordinates.map(coord => 
        `${toPixelX(coord[0]).toFixed(1)},${toPixelY(coord[1]).toFixed(1)}`
      ).join(' ')
      return `<polygon points="${points}" fill="${p.color}" fill-opacity="0.4" stroke="${p.color}" stroke-width="3"/>`
    }).join('')

    // Generar leyenda
    const fecha = new Date().toLocaleDateString('es-UY')
    
    const legendItems = potreros.map((p, index) => {
      const y = headerHeight + mapHeight + 55 + (index * legendRowHeight)
      const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
      const animalesTexto = totalAnimales > 0 
        ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
        : '(sin animales)'
      const cultivosTexto = p.cultivos.length > 0 
        ? p.cultivos.map(c => c.tipoCultivo).join(' + ')
        : ''

      return `
        <rect x="10" y="${y}" width="780" height="${legendRowHeight - 6}" rx="8" fill="white" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="10" y="${y}" width="6" height="${legendRowHeight - 6}" rx="3" fill="${p.color}"/>
        <circle cx="35" cy="${y + 24}" r="12" fill="${p.color}"/>
        <text x="58" y="${y + 20}" fill="${p.color}" font-size="15" font-weight="bold" font-family="Inter">${escapeXml(p.nombre)}</text>
        <text x="58" y="${y + 38}" fill="#64748b" font-size="11" font-family="Inter">${p.hectareas.toFixed(1)} ha</text>
        <text x="200" y="${y + 20}" fill="#334155" font-size="13" font-family="Inter">${escapeXml(animalesTexto)}</text>
        ${cultivosTexto ? `<text x="200" y="${y + 38}" fill="#16a34a" font-size="11" font-family="Inter">${escapeXml(cultivosTexto)}</text>` : ''}
      `
    }).join('')

    // SVG completo
    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${mapWidth}" height="${totalHeight}">
  <!-- Fondo -->
  <rect width="${mapWidth}" height="${totalHeight}" fill="#f1f5f9"/>
  
  <!-- Header -->
  <rect width="${mapWidth}" height="${headerHeight}" fill="#1e293b"/>
  <text x="${mapWidth/2}" y="36" text-anchor="middle" fill="white" font-size="22" font-weight="bold" font-family="Inter">Mapa: ${escapeXml(campo.nombre)}</text>
  
  <!-- Mapa satelital -->
  <image x="0" y="${headerHeight}" width="${mapWidth}" height="${mapHeight}" xlink:href="data:image/png;base64,${mapBase64}" preserveAspectRatio="xMidYMid slice"/>
  
  <!-- Poligonos sobre el mapa -->
  <g transform="translate(0, ${headerHeight})">
    ${polygonsSvg}
  </g>
  
  <!-- Leyenda titulo -->
  <text x="15" y="${headerHeight + mapHeight + 35}" fill="#1e293b" font-size="16" font-weight="bold" font-family="Inter">Detalle por Potrero:</text>
  
  <!-- Items de leyenda -->
  ${legendItems}
  
  <!-- Footer -->
  <rect y="${totalHeight - 35}" width="${mapWidth}" height="35" fill="#e2e8f0"/>
  <text x="${mapWidth/2}" y="${totalHeight - 12}" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter">Bot Rural - ${fecha}</text>
</svg>`

    // Obtener la fuente
    const font = await getFont()

    // Convertir SVG a PNG usando resvg con fuente embebida
    const resvg = new Resvg(fullSvg, {
      fitTo: {
        mode: 'width',
        value: mapWidth
      },
      font: {
        fontBuffers: [font],
        loadSystemFonts: false,
        defaultFontFamily: 'Inter',
      }
    })
    
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    console.log('✅ Imagen final generada con resvg')

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Error generando imagen:', error)
    return new Response('Error interno: ' + (error as Error).message, { status: 500 })
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