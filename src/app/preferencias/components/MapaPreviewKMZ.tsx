'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

// Cargar leaflet-draw solo en cliente
if (typeof window !== 'undefined') {
  require('leaflet-draw')
  
  // Estilos para vértices de edición pequeños y circulares
  if (!document.getElementById('leaflet-edit-vertex-style')) {
    const style = document.createElement('style')
    style.id = 'leaflet-edit-vertex-style'
    style.innerHTML = `
      .leaflet-editing-icon {
        width: 10px !important;
        height: 10px !important;
        margin-left: -5px !important;
        margin-top: -5px !important;
        border-radius: 50% !important;
        background: white !important;
        border: 2px solid #f59e0b !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
      }
      .leaflet-edit-move {
        cursor: move !important;
      }
      .leaflet-editing-icon:hover {
        background: #fbbf24 !important;
        transform: scale(1.2);
      }
    `
    document.head.appendChild(style)
  }
}

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
  editable?: boolean
  onPoligonoEditado?: (nuevasCoords: number[][]) => void
}

export default function MapaPreviewKMZ({ 
  poligonos, 
  resaltarIndice,
  mostrarVertices = false,
  editable = false,
  onPoligonoEditado
}: MapaPreviewKMZProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editableLayerRef = useRef<any>(null)

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

    // Listener para redimensionar el mapa
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize()
      }, 100)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
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

      // Si es el polígono resaltado y es editable, habilitar edición
      if (isResaltado && editable) {
        editableLayerRef.current = polygon

        // Habilitar edición del polígono
        polygon.editing.enable()

        // Escuchar cambios cuando se edita
        map.on('draw:editvertex', () => {
          if (onPoligonoEditado && editableLayerRef.current) {
            const latlngs = editableLayerRef.current.getLatLngs()[0]
            // Convertir de vuelta a [lng, lat]
            const nuevasCoords = latlngs.map((ll: any) => [ll.lng, ll.lat])
            // Cerrar el polígono si no está cerrado
            const first = nuevasCoords[0]
            const last = nuevasCoords[nuevasCoords.length - 1]
            if (first[0] !== last[0] || first[1] !== last[1]) {
              nuevasCoords.push([first[0], first[1]])
            }
            onPoligonoEditado(nuevasCoords)
          }
        })
      } else if (isResaltado && mostrarVertices) {
        // Solo mostrar vértices sin edición
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

    // Cleanup de eventos
    return () => {
      map.off('draw:editvertex')
    }
  }, [poligonos, resaltarIndice, mostrarVertices, editable, onPoligonoEditado])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ minHeight: '250px' }}
    />
  )
}