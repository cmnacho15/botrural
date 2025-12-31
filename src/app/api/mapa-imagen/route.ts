// src/app/api/mapa-imagen/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Canvas, loadImage } from 'skia-canvas'

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
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }))
    const pad = 0.15
    minLng -= (maxLng - minLng) * pad
    maxLng += (maxLng - minLng) * pad
    minLat -= (maxLat - minLat) * pad
    maxLat += (maxLat - minLat) * pad
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)
    const zoom = maxDiff > 0.1 ? 11 : maxDiff > 0.05 ? 12 : maxDiff > 0.02 ? 13 : maxDiff > 0.01 ? 14 : 15

    const mapWidth = 800
    const mapHeight = 500
    const headerHeight = 55
    const legendRowHeight = 55
    const legendPadding = 90
    const legendHeight = potreros.length * legendRowHeight + legendPadding
    const totalHeight = headerHeight + mapHeight + legendHeight

    // Mapbox satelital con token nuevo
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${centerLng},${centerLat},${zoom},0/${mapWidth}x${mapHeight}@2x?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`
    const mapRes = await fetch(mapboxUrl)
    if (!mapRes.ok) {
      console.error('Error Mapbox:', await mapRes.text())
      return new Response('Error Mapbox', { status: 500 })
    }
    const mapArrayBuffer = await mapRes.arrayBuffer()

    // Canvas
    const canvas = new Canvas(mapWidth, totalHeight)
    const ctx = canvas.getContext('2d')

    // Fondo
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, mapWidth, totalHeight)

    // Header
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, mapWidth, headerHeight)
    ctx.fillStyle = 'white'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Mapa: ${campo.nombre}`, mapWidth / 2, headerHeight / 2)

    // Mapa satelital
    const mapImage = await loadImage(Buffer.from(mapArrayBuffer))
    ctx.drawImage(mapImage, 0, headerHeight, mapWidth, mapHeight)

    // Polígonos overlay
    potreros.forEach(p => {
      ctx.fillStyle = p.color + '66' // opacity 0.4
      ctx.strokeStyle = p.color
      ctx.lineWidth = 3
      ctx.beginPath()
      p.coordinates.forEach(([lng, lat], i) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * mapWidth
        const y = headerHeight + mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    })

    // Leyenda
    const legendYStart = headerHeight + mapHeight + 30
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Detalle por Potrero:', 15, legendYStart)

    potreros.forEach((p, i) => {
      const y = legendYStart + 40 + i * legendRowHeight

      ctx.fillStyle = 'white'
      ctx.fillRect(12, y, 776, legendRowHeight - 6)
      ctx.strokeStyle = '#e2e8f0'
      ctx.strokeRect(12, y, 776, legendRowHeight - 6)

      ctx.fillStyle = p.color
      ctx.fillRect(12, y, 6, legendRowHeight - 6)

      ctx.beginPath()
      ctx.arc(38, y + legendRowHeight / 2, 12, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = p.color
      ctx.font = 'bold 15px sans-serif'
      ctx.fillText(p.nombre, 58, y + 20)

      ctx.fillStyle = '#64748b'
      ctx.font = '12px sans-serif'
      ctx.fillText(`${p.hectareas.toFixed(1)} ha`, 58, y + 38)

      const totalAnimales = p.animales.reduce((s, a) => s + a.cantidad, 0)
      const animalesTexto = totalAnimales ? p.animales.map(a => `${a.cantidad} ${a.categoria}`).join(', ') : '(sin animales)'
      ctx.fillStyle = '#334155'
      ctx.font = '13px sans-serif'
      ctx.fillText(animalesTexto, 200, y + 20)

      const cultivosTexto = p.cultivos.length ? p.cultivos.map(c => c.tipoCultivo).join(' + ') : ''
      if (cultivosTexto) {
        ctx.fillStyle = '#16a34a'
        ctx.font = '11px sans-serif'
        ctx.fillText(cultivosTexto, 200, y + 38)
      }
    })

    // Footer
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, totalHeight - 35, mapWidth, 35)
    const fecha = new Date().toLocaleDateString('es-UY')
    ctx.fillStyle = '#64748b'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Bot Rural - ${fecha}`, mapWidth / 2, totalHeight - 15)

 
    const buffer = canvas.toBuffer('png')

return new Response(buffer as any, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=300'
  }
})

  } catch (error) {
    console.error('Error:', error)
    return new Response('Error interno', { status: 500 })
  }
}