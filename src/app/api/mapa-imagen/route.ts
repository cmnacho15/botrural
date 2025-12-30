// src/app/api/mapa-imagen/route.ts

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    const padding = 0.001
    minLng -= padding
    maxLng += padding
    minLat -= padding
    maxLat += padding

    // Dimensiones
    const mapWidth = 800
    const mapHeight = 450
    const legendHeight = Math.max(200, potreros.length * 52 + 60)
    const totalHeight = mapHeight + legendHeight

    // Convertir coordenadas a píxeles
    const toPixelX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 60) + 30
    const toPixelY = (lat: number) => (mapHeight - 50) - (((lat - minLat) / (maxLat - minLat)) * (mapHeight - 100) + 30)

    // Generar SVG de polígonos
    const polygonsSvg = potreros.map(p => {
      const points = p.coordinates.map(coord => 
        `${toPixelX(coord[0]).toFixed(1)},${toPixelY(coord[1]).toFixed(1)}`
      ).join(' ')
      
      const centerX = p.coordinates.reduce((sum, c) => sum + toPixelX(c[0]), 0) / p.coordinates.length
      const centerY = p.coordinates.reduce((sum, c) => sum + toPixelY(c[1]), 0) / p.coordinates.length

      return `
        <polygon points="${points}" fill="${p.color}" fill-opacity="0.7" stroke="${p.color}" stroke-width="3"/>
        <text x="${centerX.toFixed(1)}" y="${centerY.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="14" font-weight="bold" stroke="black" stroke-width="0.5">${p.nombre}</text>
      `
    }).join('')

    // Generar leyenda HTML
    const legendItems = potreros.map(p => {
      const totalAnimales = p.animales.reduce((sum, a) => sum + a.cantidad, 0)
      const animalesTexto = totalAnimales > 0 
        ? `🐄 ${p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ')}`
        : '<span style="color: #a0aec0; font-style: italic;">Sin animales</span>'
      const cultivosTexto = p.cultivos.length > 0 
        ? `<div style="color: #38a169;">🌱 ${p.cultivos.map(c => c.tipoCultivo).join(' + ')}</div>`
        : ''

      return `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: white; border-radius: 6px; border-left: 4px solid ${p.color}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          <div style="min-width: 110px;">
            <div style="font-weight: bold; color: ${p.color}; font-size: 13px;">${p.nombre}</div>
            <div style="font-size: 10px; color: #718096;">${p.hectareas.toFixed(1)} ha</div>
          </div>
          <div style="flex: 1; font-size: 11px;">
            <div style="color: #2d3748;">${animalesTexto}</div>
            ${cultivosTexto}
          </div>
        </div>
      `
    }).join('')

    const fecha = new Date().toLocaleDateString('es-UY')

    // Generar SVG completo
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${totalHeight}">
        <defs>
          <style>
            text { font-family: system-ui, -apple-system, sans-serif; }
          </style>
        </defs>
        
        <!-- Fondo -->
        <rect width="${mapWidth}" height="${totalHeight}" fill="#1a202c"/>
        
        <!-- Header -->
        <rect y="0" width="${mapWidth}" height="50" fill="#2d3748"/>
        <text x="${mapWidth/2}" y="32" text-anchor="middle" fill="white" font-size="22" font-weight="bold">🗺️ ${campo.nombre}</text>
        
        <!-- Área del mapa -->
        <rect y="50" width="${mapWidth}" height="${mapHeight - 50}" fill="#4a5568"/>
        
        <!-- Polígonos -->
        <g transform="translate(0, 50)">
          ${polygonsSvg}
        </g>
        
        <!-- Leyenda fondo -->
        <rect y="${mapHeight}" width="${mapWidth}" height="${legendHeight - 30}" fill="#f7fafc"/>
        
        <!-- Título leyenda -->
        <text x="20" y="${mapHeight + 25}" fill="#2d3748" font-size="14" font-weight="bold">📋 Detalle por Potrero</text>
        
        <!-- Footer -->
        <rect y="${totalHeight - 30}" width="${mapWidth}" height="30" fill="#edf2f7"/>
        <text x="${mapWidth/2}" y="${totalHeight - 12}" text-anchor="middle" fill="#a0aec0" font-size="10">Bot Rural • ${fecha}</text>
      </svg>
    `

    // Convertir SVG a PNG usando resvg-js (si está disponible) o retornar SVG
    // Por simplicidad, vamos a usar un approach con HTML + foreignObject
    
    const htmlContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${totalHeight}">
        <defs>
          <style>
            * { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
          </style>
        </defs>
        
        <!-- Fondo general -->
        <rect width="${mapWidth}" height="${totalHeight}" fill="#f7fafc"/>
        
        <!-- Header -->
        <rect y="0" width="${mapWidth}" height="50" fill="#2d3748"/>
        <text x="${mapWidth/2}" y="32" text-anchor="middle" fill="white" font-size="22" font-weight="bold">🗺️ ${campo.nombre}</text>
        
        <!-- Área del mapa -->
        <rect y="50" width="${mapWidth}" height="${mapHeight - 50}" fill="#718096"/>
        
        <!-- Polígonos -->
        <g transform="translate(0, 50)">
          ${polygonsSvg}
        </g>
        
        <!-- Separador -->
        <rect y="${mapHeight}" width="${mapWidth}" height="2" fill="#e2e8f0"/>
        
        <!-- Leyenda con foreignObject -->
        <foreignObject x="0" y="${mapHeight + 2}" width="${mapWidth}" height="${legendHeight - 32}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="padding: 12px 15px; font-family: system-ui, sans-serif;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #2d3748;">📋 Detalle por Potrero</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${legendItems}
            </div>
          </div>
        </foreignObject>
        
        <!-- Footer -->
        <rect y="${totalHeight - 30}" width="${mapWidth}" height="30" fill="#edf2f7"/>
        <text x="${mapWidth/2}" y="${totalHeight - 10}" text-anchor="middle" fill="#a0aec0" font-size="10">Bot Rural • ${fecha}</text>
      </svg>
    `

    // Retornar como SVG (WhatsApp debería aceptarlo, si no, necesitamos convertir a PNG)
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Error generando imagen:', error)
    return new Response('Error interno', { status: 500 })
  }
}