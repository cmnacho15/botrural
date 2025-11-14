'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet.heat'

if (typeof window !== 'undefined') {
  require('leaflet-draw')
}

interface MapaPoligonoProps {
  onPolygonComplete?: (coordinates: number[][], areaHectareas: number) => void
  initialCenter?: [number, number]
  initialZoom?: number
  existingPolygons?: Array<{
    id: string
    nombre: string
    coordinates: number[][]
    color?: string
    info?: {
      hectareas?: number
      cultivos?: any[]
      animales?: any[]
      ndviMatriz?: any
    }
  }>
  readOnly?: boolean
}

function calcularAreaPoligono(latlngs: any[]): number {
  const R = 6371000
  if (latlngs.length < 3) return 0

  let area = 0
  const coords = latlngs.map((ll: any) => ({
    lat: ll.lat * Math.PI / 180,
    lng: ll.lng * Math.PI / 180,
  }))

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    area += coords[i].lng * coords[j].lat
    area -= coords[j].lng * coords[i].lat
  }

  area = Math.abs(area * R * R / 2)
  return area
}

function crearHeatmapNDVI(
  map: any,
  ndviData: any,
  poligonoCoords: number[][]
) {
  if (!ndviData.matriz || ndviData.matriz.length === 0) return null

  const { matriz, width, height, bbox } = ndviData
  const [west, south, east, north] = bbox

  const heatPoints: [number, number, number][] = []

  // ✅ Función para verificar si un punto está dentro del polígono
  function puntoEnPoligono(lat: number, lng: number, coords: number[][]): boolean {
    let dentro = false
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][1], yi = coords[i][0]
      const xj = coords[j][1], yj = coords[j][0]
      
      const intersecta = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      
      if (intersecta) dentro = !dentro
    }
    return dentro
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = matriz[y][x]
      
      if (value !== -999 && !isNaN(value)) {
        const lng = west + (x / width) * (east - west)
        const lat = north - (y / height) * (north - south)
        
        // ✅ Verificar si está REALMENTE dentro del polígono
        if (puntoEnPoligono(lat, lng, poligonoCoords)) {
          const intensity = (value + 1) / 2
          heatPoints.push([lat, lng, intensity])
        }
      }
    }
  }

  if (heatPoints.length === 0) return null

  // ✅ Parámetros más agresivos para contener el heatmap
  const heatLayer = (L as any).heatLayer(heatPoints, {
    radius: 6,        // Más pequeño
    blur: 8,          // Menos difuminado
    maxZoom: 18,
    max: 1.0,
    gradient: {
      0.0: '#8B4513',
      0.2: '#DAA520',
      0.3: '#FFFF00',
      0.4: '#ADFF2F',
      0.5: '#7CFC00',
      0.6: '#32CD32',
      0.7: '#228B22',
      0.8: '#006400'
    }
  })

  return heatLayer
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

  /** Esperar que center esté listo */
  useEffect(() => {
    if (initialCenter) setIsReady(true)
  }, [initialCenter])

  /** Crear mapa */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isReady) return
    if (mapRef.current) return

    const map: any = L.map('map')
    map.setView(initialCenter, initialZoom)
    mapRef.current = map

    const satelitalLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 19 }
    )
    satelitalLayer.addTo(map)

    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap', maxZoom: 19 }
    )

    L.control.layers({ 'Satélite': satelitalLayer, 'Mapa': osmLayer }).addTo(map)

    /** Dibujar polígonos existentes iniciales */
    const existingLayers = new L.FeatureGroup()
    map.addLayer(existingLayers)
    existingLayersRef.current = existingLayers

    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates?.length) return

      const polygon = (L as any).polygon(potrero.coordinates, {
        color: potrero.color || '#10b981',
        fillColor: potrero.color || '#10b981',
        fillOpacity: 0.3,
        weight: 3,
      })

      polygon.bindPopup(`
        <div style="padding: 8px; min-width: 200px;">
          <strong style="font-size: 16px; color: ${potrero.color || '#10b981'};">
            ${potrero.nombre}
          </strong><br/>
          <span style="color: #999; font-size: 12px;">
            ${potrero.info?.hectareas?.toFixed(2) || '0'} ha
          </span>
        </div>
      `)

      existingLayers.addLayer(polygon)
    })

    if (existingPolygons.length > 0 && existingLayers.getLayers().length > 0) {
      const bounds = (existingLayers as any).getBounds()
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
    }

    /** Dibujo si NO es readOnly */
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
            shapeOptions: { color: '#3b82f6', weight: 3 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: { featureGroup: drawnItems, remove: true },
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
        event.layers.eachLayer((layer: any) => {
          const latlngs = layer.getLatLngs()[0]
          const areaM2 = calcularAreaPoligono(latlngs)
          setAreaHectareas(areaM2 / 10000)
        })
      })

      map.on(DrawEvent.DELETED, () => setAreaHectareas(null))
    }

    return () => map.remove()
  }, [isReady, initialCenter, initialZoom, readOnly])

  /**
   * 🔄 Redibujar polígonos cuando cambian (ACTUALIZACIÓN DINÁMICA REAL)
   */
  useEffect(() => {
    if (!mapRef.current || !existingLayersRef.current) return
    if (!isReady) return

    existingLayersRef.current.clearLayers()

    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates?.length) return

      // 🗺️ PRIMERO: Agregar heatmap si hay datos NDVI (va DEBAJO del polígono)
      if (potrero.info?.ndviMatriz?.matriz?.length > 0) {
        const heatLayer = crearHeatmapNDVI(
          mapRef.current,
          potrero.info.ndviMatriz,
          potrero.coordinates
        )
        if (heatLayer) {
          existingLayersRef.current.addLayer(heatLayer)
        }
      }

      // DESPUÉS: Dibujar el polígono encima
      const polygon = (L as any).polygon(potrero.coordinates, {
        color: potrero.color || '#10b981',
        fillColor: potrero.color || '#10b981',
        fillOpacity: 0.2,
        weight: 3,
      })

      existingLayersRef.current.addLayer(polygon)

      // 🏷️ CREAR TOOLTIP PERMANENTE (siempre visible, sin hacer clic)
      const center = polygon.getBounds().getCenter()
      
      // Construir información de animales
      let animalesText = ''
      if (potrero.info?.animales?.length) {
        const grupos = potrero.info.animales
          .map((a: any) => `${a.categoria}: ${a.cantidad}`)
          .join('<br/>')
        animalesText = `<br/>${grupos}`
      }

      // Construir información de cultivos
      let cultivosText = ''
      if (potrero.info?.cultivos?.length) {
        const cs = potrero.info.cultivos
          .map((c: any) => `${c.tipoCultivo}: ${c.hectareas} ha`)
          .join('<br/>')
        cultivosText = `<br/>${cs}`
      }

      const tooltipContent = `
        <div style="
          background: white;
          padding: 8px 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          border: 2px solid ${potrero.color || '#10b981'};
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
          min-width: 120px;
        ">
          <div style="font-weight: bold; font-size: 16px; color: ${potrero.color || '#10b981'}; margin-bottom: 4px;">
            ${potrero.nombre}
          </div>
          ${animalesText}
          ${cultivosText}
        </div>
      `

      const tooltip = (L as any).tooltip({
        permanent: true,
        direction: 'center',
        className: 'potrero-label',
        opacity: 0.95,
      }).setContent(tooltipContent)

      tooltip.setLatLng(center)
      existingLayersRef.current.addLayer(tooltip)
    })

    if (existingPolygons.length > 0 && existingLayersRef.current.getLayers().length > 0) {
      try {
        const bounds = (existingLayersRef.current as any).getBounds()
        mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
      } catch {}
    }
  }, [existingPolygons, isReady])

  /** Buscar ubicación */
  const buscarUbicacion = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=uy&limit=5`
      )
      setSearchResults(await r.json())
    } finally {
      setSearching(false)
    }
  }

  const confirmarPoligono = () => {
    if (!drawnItemsRef.current) return
    if (drawnItemsRef.current.getLayers().length === 0)
      return alert('Dibuje el potrero primero')

    const layer = drawnItemsRef.current.getLayers()[0]
    const latlngs = layer.getLatLngs()[0]
    const coordinates = latlngs.map((ll: any) => [ll.lat, ll.lng])

    if (areaHectareas && onPolygonComplete) {
      onPolygonComplete(coordinates, areaHectareas)
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col">
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
              <button onClick={buscarUbicacion} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
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

      {readOnly && (
        <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-gray-200 text-sm text-gray-600 z-[1000]">
          🗺️ Vista del mapa
        </div>
      )}

      {!readOnly && areaHectareas !== null && (
        <div className="absolute top-4 right-4 z-[1000] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm">Área:</div>
          <div className="text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      <div id="map" className="flex-1 w-full h-full" />

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