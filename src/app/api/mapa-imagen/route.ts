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

    // Agregar padding
    const lngPadding = (maxLng - minLng) * 0.15
    const latPadding = (maxLat - minLat) * 0.15
    minLng -= lngPadding
    maxLng += lngPadding
    minLat -= latPadding
    maxLat += latPadding

    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    // Calcular zoom
    const latDiff = maxLat - minLat
    const lngDiff = maxLng - minLng
    const maxDiff = Math.max(latDiff, lngDiff)
    let zoom = 14
    if (maxDiff > 0.1) zoom = 11
    else if (maxDiff > 0.05) zoom = 12
    else if (maxDiff > 0.02) zoom = 13
    else if (maxDiff > 0.01) zoom = 14
    else zoom = 15

    // Dimensiones
    const mapWidth = 800
    const mapHeight = 500

    // Obtener mapa satelital de Mapbox (sin polígonos)
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${centerLng},${centerLat},${zoom},0/${mapWidth}x${mapHeight}@2x?access_token=${mapboxToken}`

    console.log('🗺️ Solicitando mapa satelital a Mapbox...')
    
    const mapResponse = await fetch(mapboxUrl)
    
    if (!mapResponse.ok) {
      console.error('❌ Error de Mapbox:', mapResponse.status)
      return generarMapaFallback(campo.nombre, potreros, mapWidth, mapHeight)
    }

    const mapBuffer = Buffer.from(await mapResponse.arrayBuffer())
    console.log('✅ Mapa satelital recibido')

    // Redimensionar el mapa (viene en @2x)
    const resizedMap = await sharp(mapBuffer)
      .resize(mapWidth, mapHeight)
      .toBuffer()

    // Convertir coordenadas geográficas a píxeles
    const toPixelX = (lng: number) => {
      return ((lng - minLng) / (maxLng - minLng)) * mapWidth
    }
    const toPixelY = (lat: number) => {
      return mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight
    }

    // Crear SVG con los polígonos para superponer
    const polygonsSvg = potreros.map(p => {
      const points = p.coordinates.map(coord => 
        `${toPixelX(coord[0]).toFixed(1)},${toPixelY(coord[1]).toFixed(1)}`
      ).join(' ')

      return `<polygon points="${points}" fill="${p.color}" fill-opacity="0.35" stroke="${p.color}" stroke-width="3"/>`
    }).join('')

    // SVG de polígonos (transparente excepto los polígonos)
    const overlaySvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
        ${polygonsSvg}
      </svg>
    `

    // Superponer polígonos sobre el mapa
    const mapWithPolygons = await sharp(resizedMap)
      .composite([{
        input: Buffer.from(overlaySvg),
        top: 0,
        left: 0
      }])
      .toBuffer()

    // Crear la leyenda
    const legendRowHeight = 52
    const legendPadding = 80
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = mapHeight + legendHeight

    // Header SVG - usando encoding UTF-8 explícito
    const headerHeight = 50
    const safeNombreCampo = campo.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const headerSvg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${headerHeight}">
        <rect width="${mapWidth}" height="${headerHeight}" fill="#1e293b"/>
        <text x="${mapWidth/2}" y="33" text-anchor="middle" fill="white" font-size="22" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold">Mapa: ${safeNombreCampo}</text>
      </svg>
    `

    // Crear items de leyenda
    const fecha = new Date().toLocaleDateString('es-UY')
    let currentY = 50
    
    // Función para limpiar texto de acentos
    const limpiarTexto = (texto: string) => {
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/[^\x00-\x7F]/g, '')    // Solo ASCII
    }

    const legendItemsSvg = potreros.map((p, index) => {
      const y = currentY + (index * legendRowHeight)
      const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
      
      // Simplificar texto de animales (sin acentos)
      let animalesTexto = ''
      if (totalAnimales > 0) {
        animalesTexto = p.animales.map(a => `${a.cantidad} ${limpiarTexto(a.categoria)}`).join(', ')
      }
      
      // Texto de cultivos (sin acentos)
      const cultivosTexto = p.cultivos.length > 0 
        ? p.cultivos.map(c => limpiarTexto(c.tipoCultivo)).join(' + ')
        : ''

      const nombreLimpio = limpiarTexto(p.nombre)

      return `
        <rect x="8" y="${y}" width="784" height="${legendRowHeight - 4}" rx="8" fill="white"/>
        <rect x="8" y="${y}" width="6" height="${legendRowHeight - 4}" rx="3" fill="${p.color}"/>
        <text x="24" y="${y + 22}" fill="${p.color}" font-size="15" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold">${nombreLimpio}</text>
        <text x="24" y="${y + 40}" fill="#64748b" font-size="12" font-family="DejaVu Sans, Arial, sans-serif">${p.hectareas.toFixed(1)} ha</text>
        <text x="160" y="${y + 22}" fill="#334155" font-size="13" font-family="DejaVu Sans, Arial, sans-serif">${totalAnimales > 0 ? animalesTexto : '(sin animales)'}</text>
        ${cultivosTexto ? `<text x="160" y="${y + 40}" fill="#16a34a" font-size="12" font-family="DejaVu Sans, Arial, sans-serif">${cultivosTexto}</text>` : ''}
      `
    }).join('')

    const legendSvg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${legendHeight}">
        <rect width="${mapWidth}" height="${legendHeight}" fill="#f1f5f9"/>
        <text x="15" y="32" fill="#1e293b" font-size="16" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold">Detalle por Potrero:</text>
        ${legendItemsSvg}
        <rect y="${legendHeight - 30}" width="${mapWidth}" height="30" fill="#e2e8f0"/>
        <text x="${mapWidth/2}" y="${legendHeight - 10}" text-anchor="middle" fill="#64748b" font-size="11" font-family="DejaVu Sans, Arial, sans-serif">Bot Rural - ${fecha}</text>
      </svg>
    `

    // Convertir SVGs a buffers
    const headerBuffer = await sharp(Buffer.from(headerSvg)).png().toBuffer()
    const legendBuffer = await sharp(Buffer.from(legendSvg)).png().toBuffer()

    // Crear imagen final combinando todo
    const finalImage = await sharp({
      create: {
        width: mapWidth,
        height: headerHeight + mapHeight + legendHeight,
        channels: 4,
        background: { r: 241, g: 245, b: 249, alpha: 1 }
      }
    })
    .composite([
      { input: headerBuffer, top: 0, left: 0 },
      { input: mapWithPolygons, top: headerHeight, left: 0 },
      { input: legendBuffer, top: headerHeight + mapHeight, left: 0 }
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
    return new Response('Error interno: ' + (error as Error).message, { status: 500 })
  }
}

// Fallback sin Mapbox
async function generarMapaFallback(
  nombreCampo: string,
  potreros: PotreroData[],
  mapWidth: number,
  mapHeight: number
) {
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  potreros.forEach(p => {
    p.coordinates.forEach(coord => {
      minLng = Math.min(minLng, coord[0])
      maxLng = Math.max(maxLng, coord[0])
      minLat = Math.min(minLat, coord[1])
      maxLat = Math.max(maxLat, coord[1])
    })
  })

  const padding = (maxLng - minLng) * 0.1
  minLng -= padding
  maxLng += padding
  minLat -= padding
  maxLat += padding

  const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * mapWidth
  const toPixelY = (lat: number) => mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight

  const polygonsSvg = potreros.map(p => {
    const points = p.coordinates.map(coord => 
      `${toPixelX(coord[0]).toFixed(1)},${toPixelY(coord[1]).toFixed(1)}`
    ).join(' ')
    return `<polygon points="${points}" fill="${p.color}" fill-opacity="0.5" stroke="${p.color}" stroke-width="3"/>`
  }).join('')

  const legendRowHeight = 52
  const legendHeight = potreros.length * legendRowHeight + 80
  const totalHeight = 50 + mapHeight + legendHeight
  const fecha = new Date().toLocaleDateString('es-UY')

  const legendItems = potreros.map((p, index) => {
    const y = 50 + mapHeight + 50 + (index * legendRowHeight)
    const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
    const animalesTexto = totalAnimales > 0 
      ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')
      : '(sin animales)'

    return `
      <rect x="8" y="${y}" width="784" height="${legendRowHeight - 4}" rx="8" fill="white"/>
      <rect x="8" y="${y}" width="6" height="${legendRowHeight - 4}" rx="3" fill="${p.color}"/>
      <text x="24" y="${y + 22}" fill="${p.color}" font-size="15" font-family="sans-serif" font-weight="bold">${p.nombre}</text>
      <text x="24" y="${y + 40}" fill="#64748b" font-size="12" font-family="sans-serif">${p.hectareas.toFixed(1)} ha</text>
      <text x="160" y="${y + 22}" fill="#334155" font-size="13" font-family="sans-serif">${animalesTexto}</text>
    `
  }).join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${totalHeight}">
      <rect width="${mapWidth}" height="${totalHeight}" fill="#f1f5f9"/>
      <rect width="${mapWidth}" height="50" fill="#1e293b"/>
      <text x="${mapWidth/2}" y="33" text-anchor="middle" fill="white" font-size="22" font-family="sans-serif" font-weight="bold">Mapa: ${nombreCampo}</text>
      <rect y="50" width="${mapWidth}" height="${mapHeight}" fill="#4b5563"/>
      <g transform="translate(0, 50)">${polygonsSvg}</g>
      <text x="15" y="${50 + mapHeight + 32}" fill="#1e293b" font-size="16" font-family="sans-serif" font-weight="bold">Detalle por Potrero:</text>
      ${legendItems}
      <rect y="${totalHeight - 30}" width="${mapWidth}" height="30" fill="#e2e8f0"/>
      <text x="${mapWidth/2}" y="${totalHeight - 10}" text-anchor="middle" fill="#64748b" font-size="11" font-family="sans-serif">Bot Rural - ${fecha}</text>
    </svg>
  `

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()

  return new Response(new Uint8Array(pngBuffer), {
    headers: { 'Content-Type': 'image/png' }
  })
}