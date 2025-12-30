// src/app/api/mapa-imagen/route.ts

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

// Colores para los potreros (30 colores distintos)
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
    // Verificar API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'bot-internal-key')) {
      return new Response('No autorizado', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campoId = searchParams.get('campoId')

    if (!campoId) {
      return new Response('campoId requerido', { status: 400 })
    }

    // Obtener campo y potreros
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

    // Preparar datos
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

    // Agregar padding al bounding box (10%)
    const lngPadding = (maxLng - minLng) * 0.1
    const latPadding = (maxLat - minLat) * 0.1
    minLng -= lngPadding
    maxLng += lngPadding
    minLat -= latPadding
    maxLat += latPadding

    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    // Calcular zoom apropiado
    const latDiff = maxLat - minLat
    const lngDiff = maxLng - minLng
    const maxDiff = Math.max(latDiff, lngDiff)
    let zoom = 14
    if (maxDiff > 0.1) zoom = 12
    else if (maxDiff > 0.05) zoom = 13
    else if (maxDiff > 0.02) zoom = 14
    else if (maxDiff > 0.01) zoom = 15
    else zoom = 16

    // Dimensiones del mapa
    const mapWidth = 800
    const mapHeight = 500

    // Crear GeoJSON para los polígonos de Mapbox
    const geojsonOverlays = potreros.map((p, index) => {
      // Cerrar el polígono si no está cerrado
      const coords = [...p.coordinates]
      if (coords.length > 0) {
        const first = coords[0]
        const last = coords[coords.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push(first)
        }
      }

      const color = p.color.replace('#', '')
      
      return `path-${color}+${color}-0.5(${encodeURIComponent(JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        }
      }))})`
    }).join(',')

    // URL de Mapbox Static API con estilo satelital
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${geojsonOverlays}/[${minLng},${minLat},${maxLng},${maxLat}]/${mapWidth}x${mapHeight}@2x?access_token=${mapboxToken}&logo=false&attribution=false`

    console.log('🗺️ Solicitando mapa a Mapbox...')

    // Obtener imagen del mapa de Mapbox
    const mapResponse = await fetch(mapboxUrl)
    
    if (!mapResponse.ok) {
      console.error('❌ Error de Mapbox:', mapResponse.status, await mapResponse.text())
      
      // Fallback: generar mapa simple sin Mapbox
      return await generarMapaSinMapbox(campo.nombre, potreros, mapWidth, mapHeight)
    }

    const mapBuffer = await mapResponse.arrayBuffer()
    console.log('✅ Mapa de Mapbox recibido')

    // Crear leyenda
    const legendRowHeight = 50
    const legendPadding = 70
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = mapHeight + legendHeight

    // Generar SVG de la leyenda
    let legendY = 45
    const legendItems = potreros.map((p, index) => {
      const y = legendY + (index * legendRowHeight)
      const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
      const animalesTexto = totalAnimales > 0 
        ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
        : 'Sin animales'
      const cultivosTexto = p.cultivos.length > 0 
        ? p.cultivos.map(c => c.tipoCultivo).join(' + ')
        : ''

      return `
        <rect x="10" y="${y}" width="780" height="${legendRowHeight - 6}" rx="6" fill="white" stroke="#e2e8f0" stroke-width="1"/>
        <rect x="10" y="${y}" width="5" height="${legendRowHeight - 6}" rx="2" fill="${p.color}"/>
        <text x="25" y="${y + 20}" fill="${p.color}" font-size="14" font-weight="bold" font-family="Arial, sans-serif">${escapeXml(p.nombre)}</text>
        <text x="25" y="${y + 36}" fill="#718096" font-size="11" font-family="Arial, sans-serif">${p.hectareas.toFixed(1)} ha</text>
        <text x="150" y="${y + 20}" fill="#2d3748" font-size="12" font-family="Arial, sans-serif">${totalAnimales > 0 ? '🐄 ' + escapeXml(animalesTexto) : '(sin animales)'}</text>
        ${cultivosTexto ? `<text x="150" y="${y + 36}" fill="#38a169" font-size="11" font-family="Arial, sans-serif">🌱 ${escapeXml(cultivosTexto)}</text>` : ''}
      `
    }).join('')

    const fecha = new Date().toLocaleDateString('es-UY')

    const legendSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${legendHeight}">
        <rect width="${mapWidth}" height="${legendHeight}" fill="#f8fafc"/>
        <text x="15" y="28" fill="#1e293b" font-size="16" font-weight="bold" font-family="Arial, sans-serif">📋 Detalle por Potrero</text>
        ${legendItems}
        <rect y="${legendHeight - 28}" width="${mapWidth}" height="28" fill="#f1f5f9"/>
        <text x="${mapWidth/2}" y="${legendHeight - 10}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Arial, sans-serif">Bot Rural • ${fecha}</text>
      </svg>
    `

    // Convertir leyenda SVG a PNG
    const legendPng = await sharp(Buffer.from(legendSvg))
      .png()
      .toBuffer()

    // Combinar mapa + leyenda
    const finalImage = await sharp(Buffer.from(mapBuffer))
      .resize(mapWidth, mapHeight)
      .extend({
        bottom: legendHeight,
        background: { r: 248, g: 250, b: 252, alpha: 1 }
      })
      .composite([
        {
          input: legendPng,
          top: mapHeight,
          left: 0
        }
      ])
      .png()
      .toBuffer()

    console.log('✅ Imagen final generada')

    return new Response(new Uint8Array(finalImage), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Error generando imagen:', error)
    return new Response('Error interno', { status: 500 })
  }
}

// Fallback si Mapbox falla
async function generarMapaSinMapbox(
  nombreCampo: string,
  potreros: PotreroData[],
  mapWidth: number,
  mapHeight: number
) {
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

  const padding = 0.001
  minLng -= padding
  maxLng += padding
  minLat -= padding
  maxLat += padding

  const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 40) + 20
  const toPixelY = (lat: number) => (mapHeight - 60) - (((lat - minLat) / (maxLat - minLat)) * (mapHeight - 80) + 20)

  const polygonsSvg = potreros.map(p => {
    const points = p.coordinates.map(coord => 
      `${toPixelX(coord[0]).toFixed(1)},${toPixelY(coord[1]).toFixed(1)}`
    ).join(' ')
    
    const centerX = p.coordinates.reduce((sum, c) => sum + toPixelX(c[0]), 0) / p.coordinates.length
    const centerY = p.coordinates.reduce((sum, c) => sum + toPixelY(c[1]), 0) / p.coordinates.length

    return `
      <polygon points="${points}" fill="${p.color}" fill-opacity="0.6" stroke="${p.color}" stroke-width="3"/>
      <text x="${centerX.toFixed(1)}" y="${centerY.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial, sans-serif" stroke="#000" stroke-width="0.5">${escapeXml(p.nombre)}</text>
    `
  }).join('')

  const legendRowHeight = 50
  const legendPadding = 70
  const legendHeight = potreros.length * legendRowHeight + legendPadding
  const totalHeight = mapHeight + legendHeight

  let legendY = mapHeight + 45
  const legendItems = potreros.map((p, index) => {
    const y = legendY + (index * legendRowHeight)
    const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
    const animalesTexto = totalAnimales > 0 
      ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
      : 'Sin animales'
    const cultivosTexto = p.cultivos.length > 0 
      ? p.cultivos.map(c => c.tipoCultivo).join(' + ')
      : ''

    return `
      <rect x="10" y="${y}" width="780" height="${legendRowHeight - 6}" rx="6" fill="white" stroke="#e2e8f0" stroke-width="1"/>
      <rect x="10" y="${y}" width="5" height="${legendRowHeight - 6}" rx="2" fill="${p.color}"/>
      <text x="25" y="${y + 20}" fill="${p.color}" font-size="14" font-weight="bold" font-family="Arial, sans-serif">${escapeXml(p.nombre)}</text>
      <text x="25" y="${y + 36}" fill="#718096" font-size="11" font-family="Arial, sans-serif">${p.hectareas.toFixed(1)} ha</text>
      <text x="150" y="${y + 20}" fill="#2d3748" font-size="12" font-family="Arial, sans-serif">${totalAnimales > 0 ? '🐄 ' + escapeXml(animalesTexto) : '(sin animales)'}</text>
      ${cultivosTexto ? `<text x="150" y="${y + 36}" fill="#38a169" font-size="11" font-family="Arial, sans-serif">🌱 ${escapeXml(cultivosTexto)}</text>` : ''}
    `
  }).join('')

  const fecha = new Date().toLocaleDateString('es-UY')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${totalHeight}">
      <rect width="${mapWidth}" height="${totalHeight}" fill="#f8fafc"/>
      <rect y="0" width="${mapWidth}" height="50" fill="#1e293b"/>
      <text x="${mapWidth/2}" y="32" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Arial, sans-serif">🗺️ ${escapeXml(nombreCampo)}</text>
      <rect y="50" width="${mapWidth}" height="${mapHeight - 50}" fill="#64748b"/>
      <g transform="translate(0, 50)">
        ${polygonsSvg}
      </g>
      <rect y="${mapHeight}" width="${mapWidth}" height="${legendHeight}" fill="#f8fafc"/>
      <text x="15" y="${mapHeight + 28}" fill="#1e293b" font-size="16" font-weight="bold" font-family="Arial, sans-serif">📋 Detalle por Potrero</text>
      ${legendItems}
      <rect y="${totalHeight - 28}" width="${mapWidth}" height="28" fill="#f1f5f9"/>
      <text x="${mapWidth/2}" y="${totalHeight - 10}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Arial, sans-serif">Bot Rural • ${fecha}</text>
    </svg>
  `

  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer()

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache'
    }
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}