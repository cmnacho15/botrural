'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface PoligonoPreview {
  coordinates: number[][]
  color: string
  nombre: string
  opacity?: number
  weight?: number
}

interface MapaPreviewKMZProps {
  poligonos: PoligonoPreview[]
  resaltarIndice?: number
  mostrarVertices?: boolean
}

export default function MapaPreviewKMZ({ 
  poligonos, 
  resaltarIndice,
  mostrarVertices = false 
}: MapaPreviewKMZProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Crear mapa
const map: any = (L as any).map(containerRef.current, {
  zoomControl: true,
  attributionControl: false
})

// Capa satelital
const tileLayer = (L as any).tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19 }
)
tileLayer.addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Actualizar polígonos cuando cambian
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current

    // Limpiar capas anteriores (excepto tile layer)
    map.eachLayer((layer: any) => {
      if (!(layer instanceof (L as any).TileLayer)) {
        map.removeLayer(layer)
      }
    })

    if (poligonos.length === 0) return

    const bounds = (L as any).latLngBounds([])

    poligonos.forEach((pol, idx) => {
      // Convertir [lng, lat] a [lat, lng] para Leaflet
      const coordsLeaflet = pol.coordinates.map(c => [c[1], c[0]] as [number, number])
      
      const isResaltado = resaltarIndice === idx

      // Dibujar polígono
      const polygon = (L as any).polygon(coordsLeaflet, {
        color: isResaltado ? '#f59e0b' : pol.color,
        fillColor: isResaltado ? '#fbbf24' : pol.color,
        fillOpacity: pol.opacity ?? (isResaltado ? 0.6 : 0.4),
        weight: pol.weight ?? (isResaltado ? 3 : 2)
      }).addTo(map)

      // Agregar vértices si está resaltado
      if (isResaltado && mostrarVertices) {
        coordsLeaflet.forEach((coord) => {
          (L as any).circleMarker(coord, {
            radius: 6,
            color: '#f59e0b',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
          }).addTo(map)
        })
      }

      bounds.extend(polygon.getBounds())
    })

    // Ajustar vista
    if (bounds.isValid()) {
      if (resaltarIndice !== undefined && poligonos[resaltarIndice]) {
        // Si hay uno resaltado, centrar en ese
        const coordsResaltado = poligonos[resaltarIndice].coordinates.map(c => [c[1], c[0]] as [number, number])
        const boundsResaltado = (L as any).latLngBounds(coordsResaltado)
        map.fitBounds(boundsResaltado, { padding: [30, 30], maxZoom: 16 })
      } else {
        // Si no, mostrar todos
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
      }
    }
  }, [poligonos, resaltarIndice, mostrarVertices])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-64"
      style={{ minHeight: '250px' }}
    />
  )
}