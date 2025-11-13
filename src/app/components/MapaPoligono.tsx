'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

if (typeof window !== 'undefined') {
  require('leaflet-draw')
}

interface MapaPoligonoProps {
  onPolygonComplete?: (coordinates: number[][], areaHectareas: number) => void // ✅ Agregar ?
  initialCenter?: [number, number]
  initialZoom?: number
  existingPolygons?: Array<{
    id: string
    nombre: string
    coordinates: number[][]
    color?: string
    info?: {  // ✅ Agregar info opcional
      hectareas?: number
      cultivos?: any[]
      animales?: any[]
    }
  }>
  readOnly?: boolean // ✅ AGREGAR ESTA LÍNEA
}

function calcularAreaPoligono(latlngs: any[]): number {
  const R = 6371000
  if (latlngs.length < 3) return 0
  
  let area = 0
  const coords = latlngs.map((ll: any) => ({
    lat: ll.lat * Math.PI / 180,
    lng: ll.lng * Math.PI / 180
  }))
  
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    area += coords[i].lng * coords[j].lat
    area -= coords[j].lng * coords[i].lat
  }
  
  area = Math.abs(area * R * R / 2)
  return area
}

export default function MapaPoligono({
  onPolygonComplete,
  initialCenter = [-34.397, -56.165],
  initialZoom = 8,
  existingPolygons = [],
  readOnly = false,
}: MapaPoligonoProps) {

  const mapRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const existingLayersRef = useRef<any>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Esperar center
  useEffect(() => {
    if (initialCenter) setIsReady(true)
  }, [initialCenter])

  // Crear mapa
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isReady) return
    if (mapRef.current) return

    const map: any = L.map('map')
    map.setView(initialCenter, initialZoom)
    mapRef.current = map

    // Satelital
    const satelitalLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 19 }
    )
    satelitalLayer.addTo(map)

    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap', maxZoom: 19 }
    )

    L.control.layers(
      { 'Satélite': satelitalLayer, 'Mapa': osmLayer }
    ).addTo(map)

    // Dibujar potreros existentes
const existingLayers = new L.FeatureGroup()
map.addLayer(existingLayers)
existingLayersRef.current = existingLayers

existingPolygons.forEach((potrero) => {
  if (potrero.coordinates && potrero.coordinates.length > 0) {
    // Crear polígono del potrero
    const polygon = (L as any).polygon(potrero.coordinates, {
      color: potrero.color || '#10b981',
      fillColor: potrero.color || '#10b981',
      fillOpacity: 0.3,
      weight: 3,
    })

    // Construir información de animales
    let animalesInfo = ''
    if (potrero.info?.animales && potrero.info.animales.length > 0) {
      const totalAnimales = potrero.info.animales.reduce((sum: number, a: any) => sum + a.cantidad, 0)
      const categorias = potrero.info.animales.map((a: any) => a.categoria).join(', ')
      animalesInfo = `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <span style="color: #666; font-size: 12px;">
            🐄 ${totalAnimales} animales<br/>
            <span style="color: #999; font-size: 11px;">${categorias}</span>
          </span>
        </div>
      `
    }

    // Construir información de cultivos
    let cultivosInfo = ''
    if (potrero.info?.cultivos && potrero.info.cultivos.length > 0) {
      const cultivos = potrero.info.cultivos.map((c: any) => `${c.tipoCultivo} (${c.hectareas} ha)`).join(', ')
      cultivosInfo = `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <span style="color: #666; font-size: 12px;">
            🌾 ${cultivos}
          </span>
        </div>
      `
    }

    // Popup al hacer click
    polygon.bindPopup(`
      <div style="padding: 8px; min-width: 200px;">
        <strong style="font-size: 16px; color: ${potrero.color || '#10b981'};">
          ${potrero.nombre}
        </strong><br/>
        <span style="color: #999; font-size: 12px;">
          ${potrero.info?.hectareas?.toFixed(2) || '0'} ha
        </span>
        ${cultivosInfo}
        ${animalesInfo}
      </div>
    `)

    // Agregar polígono al mapa
    existingLayers.addLayer(polygon)
  }
})

// Ajustar zoom si hay polígonos
if (existingPolygons.length > 0 && existingLayers.getLayers().length > 0) {
  const bounds = (existingLayers as any).getBounds()
  map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
}

    // ⛔ DIBUJO SOLO SI NO es readOnly
    if (!readOnly) {
      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems

      const drawControl = new (L.Control as any).Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            metric: ['ha', 'm'],
            shapeOptions: { color: '#3b82f6', weight: 3 }
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: { featureGroup: drawnItems, remove: true }
      })
      map.addControl(drawControl)

      const DrawEvent = (L as any).Draw.Event

      map.on(DrawEvent.CREATED, (event: any) => {
        const layer = event.layer
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)

        const latlngs = layer.getLatLngs()[0]
        const areaM2 = calcularAreaPoligono(latlngs)
        const areaHa = areaM2 / 10000
        setAreaHectareas(areaHa)
      })

      map.on(DrawEvent.EDITED, (event: any) => {
        const layers = event.layers
        layers.eachLayer((layer: any) => {
          const latlngs = layer.getLatLngs()[0]
          const areaM2 = calcularAreaPoligono(latlngs)
          const areaHa = areaM2 / 10000
          setAreaHectareas(areaHa)
        })
      })

      map.on(DrawEvent.DELETED, () => setAreaHectareas(null))
    }

    return () => map.remove()
  }, [isReady, initialCenter, initialZoom, existingPolygons, readOnly])

  const buscarUbicacion = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=uy&limit=5`
      )
      const data = await response.json()
      setSearchResults(data)
    } finally {
      setSearching(false)
    }
  }

  const confirmarPoligono = () => {
    if (!drawnItemsRef.current) return
    if (drawnItemsRef.current.getLayers().length === 0) return alert('Dibuje el potrero primero')

    const layer = drawnItemsRef.current.getLayers()[0]
    const latlngs = layer.getLatLngs()[0]
    const coordinates = latlngs.map((ll: any) => [ll.lat, ll.lng])

    if (areaHectareas && onPolygonComplete) {
      onPolygonComplete(coordinates, areaHectareas)
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col">

      {/* 🔍 Barra de búsqueda SOLO si NO es readOnly */}
      {!readOnly && (
        <div className="absolute top-4 left-4 right-4 z-[1000] md:left-16 md:w-96">
          <div className="bg-white rounded-lg shadow-lg p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarUbicacion()}
                placeholder="Buscar ubicación..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={buscarUbicacion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                {searching ? '⏳' : '🔍'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView([parseFloat(r.lat), parseFloat(r.lon)], 16)
                      }
                      setSearchResults([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm border-b"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏷️ Badge solo lectura */}
      {readOnly && (
        <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-gray-200 text-sm text-gray-600 z-[1000]">
          🗺️ Vista del mapa
        </div>
      )}

      {/* Área calculada */}
      {!readOnly && areaHectareas !== null && (
        <div className="absolute top-4 right-4 z-[1000] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm">Área:</div>
          <div className="text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      {/* Mapa */}
      <div id="map" className="flex-1 w-full h-full" />

      {/* Botones dibujar */}
      {!readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-col sm:flex-row gap-3">
          <button
            onClick={confirmarPoligono}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            Confirmar Potrero
          </button>
        </div>
      )}
    </div>
  )
}