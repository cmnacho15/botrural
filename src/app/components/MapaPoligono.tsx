'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

if (typeof window !== 'undefined') {
  require('leaflet-draw')
}

interface MapaPoligonoProps {
  onPolygonComplete: (coordinates: number[][], areaHectareas: number) => void
  initialCenter?: [number, number]
  initialZoom?: number
  existingPolygons?: Array<{
    id: string
    nombre: string
    coordinates: number[][]
    color?: string
  }>
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
}: MapaPoligonoProps) {
  const mapRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const existingLayersRef = useRef<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)

  // ✅ Esperar a que initialCenter esté listo
  useEffect(() => {
    console.log('📍 initialCenter recibido:', initialCenter)
    console.log('🗺️ existingPolygons:', existingPolygons.length)
    
    if (initialCenter || existingPolygons.length > 0) {
      console.log('✅ Mapa listo para renderizar')
      setIsReady(true)
    }
  }, [initialCenter, existingPolygons])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapRef.current) return
    if (!isReady) {
      console.log('⏳ Esperando a que el mapa esté listo...')
      return
    }

    console.log('🗺️ Creando mapa con centro:', initialCenter, 'zoom:', initialZoom)

    const map: any = L.map('map')
    map.setView(initialCenter, initialZoom)
    mapRef.current = map

    // Capa base de mapa
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    })
    osmLayer.addTo(map)

    // Capa satelital
    const satelitalLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri',
        maxZoom: 19,
      }
    )

    // Control de capas
    L.control.layers(
      {
        'Mapa': osmLayer,
        'Satélite': satelitalLayer
      }
    ).addTo(map)

    // Capa para potreros existentes (solo visualización)
    const existingLayers = new L.FeatureGroup()
    map.addLayer(existingLayers)
    existingLayersRef.current = existingLayers

    // ✅ Dibujar potreros existentes con nombres visibles
    existingPolygons.forEach((potrero) => {
      if (potrero.coordinates && potrero.coordinates.length > 0) {
        const polygon = (L as any).polygon(potrero.coordinates, {
          color: potrero.color || '#10b981',
          fillColor: potrero.color || '#10b981',
          fillOpacity: 0.3,
          weight: 3,
        })
        
        polygon.bindPopup(`
          <div style="padding: 8px;">
            <strong style="font-size: 14px; color: ${potrero.color};">${potrero.nombre}</strong>
            <br/>
            <span style="color: #666; font-size: 12px;">Potrero existente</span>
          </div>
        `)
        
        existingLayers.addLayer(polygon)

        // ✅ AGREGAR LABEL CON EL NOMBRE EN EL CENTRO DEL POLÍGONO
        const bounds = (polygon as any).getBounds()
        const center = bounds.getCenter()
        
        const label = (L as any).marker(center, {
          icon: (L as any).divIcon({
            className: 'potrero-label',
            html: `<div style="
              background: white;
              padding: 4px 8px;
              border-radius: 4px;
              border: 2px solid ${potrero.color || '#10b981'};
              font-weight: bold;
              font-size: 13px;
              color: ${potrero.color || '#10b981'};
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              pointer-events: none;
            ">${potrero.nombre}</div>`,
            iconSize: null,
          }),
        })
        
        existingLayers.addLayer(label)
      }
    })

    // Si hay potreros, ajustar el zoom para verlos todos
    if (existingPolygons.length > 0 && existingLayers.getLayers().length > 0) {
      console.log('🎯 Ajustando zoom para ver todos los potreros')
      map.fitBounds((existingLayers as any).getBounds(), { padding: [50, 50] })
    }

    // Capa para dibujar nuevos potreros
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems

    const drawControl = new (L.Control as any).Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          metric: ['ha', 'm'],
          shapeOptions: {
            color: '#3b82f6',
            weight: 3,
          },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
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

    map.on(DrawEvent.DELETED, () => {
      setAreaHectareas(null)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [isReady, initialCenter, initialZoom, existingPolygons])

  const buscarUbicacion = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=uy&limit=5`
      )
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Error buscando ubicación:', error)
      alert('Error al buscar la ubicación')
    } finally {
      setSearching(false)
    }
  }

  const irAUbicacion = (result: any) => {
    if (mapRef.current) {
      const lat = parseFloat(result.lat)
      const lon = parseFloat(result.lon)
      mapRef.current.setView([lat, lon], 16)
      setSearchResults([])
      setSearchQuery('')
    }
  }

  const confirmarPoligono = () => {
    if (!drawnItemsRef.current || drawnItemsRef.current.getLayers().length === 0) {
      alert('Primero dibujá el potrero en el mapa')
      return
    }

    const layer = drawnItemsRef.current.getLayers()[0]
    const latlngs = layer.getLatLngs()[0]
    const coordinates = latlngs.map((ll: any) => [ll.lat, ll.lng])

    if (areaHectareas) {
      onPolygonComplete(coordinates, areaHectareas)
    }
  }

  const cancelar = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers()
      setAreaHectareas(null)
    }
  }

  // ✅ Mostrar loading mientras espera
  if (!isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="absolute top-4 left-4 right-4 z-[1000] md:left-16 md:right-auto md:w-96">
        <div className="bg-white rounded-lg shadow-lg p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarUbicacion()}
              placeholder="Ej: Salto, Rincón de Valentín..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={buscarUbicacion}
              disabled={searching}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {searching ? '⏳' : '🔍'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => irAUbicacion(result)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm border-b last:border-b-0"
                >
                  <div className="font-medium">{result.display_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {areaHectareas !== null && (
        <div className="absolute top-4 right-4 z-[1000] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-medium">Área calculada:</div>
          <div className="text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      <div id="map" className="flex-1 w-full h-full" />

      <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-col sm:flex-row gap-3">
        <button
          onClick={confirmarPoligono}
          className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium shadow-lg text-base sm:text-lg"
        >
          ✅ Confirmar Potrero
        </button>
        <button
          onClick={cancelar}
          className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium shadow-lg text-base sm:text-lg"
        >
          ❌ Deshacer
        </button>
      </div>
    </div>
  )
}