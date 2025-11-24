'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

if (typeof window !== 'undefined') {
  require('leaflet-draw')
  
  // Agregar estilos para tooltips sin fondo
  if (!document.getElementById('leaflet-tooltip-override')) {
    const style = document.createElement('style')
    style.id = 'leaflet-tooltip-override'
    style.innerHTML = `
      .potrero-label-transparent {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .potrero-label-transparent::before {
        display: none !important;
      }
      .leaflet-editing-icon {
        width: 8px !important;
        height: 8px !important;
        margin-left: -4px !important;
        margin-top: -4px !important;
        border-radius: 50% !important;
        background: white !important;
        border: 2px solid #3b82f6 !important;
      }
      .leaflet-touch-icon {
        width: 12px !important;
        height: 12px !important;
        margin-left: -6px !important;
        margin-top: -6px !important;
      }
      .leaflet-draw-guide-dash {
        stroke: #3b82f6 !important;
        stroke-opacity: 0.6 !important;
        stroke-dasharray: 5, 5 !important;
      }
    `
    document.head.appendChild(style)
  }
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

// 🎨 FUNCIÓN PROFESIONAL: Renderizar NDVI con Canvas
function crearImagenNDVI(
  ndviData: any,
  poligonoCoords: number[][]
) {
  if (!ndviData.matriz || ndviData.matriz.length === 0) return null

  const { matriz, width, height, bbox } = ndviData
  const [west, south, east, north] = bbox

  console.log('🎨 Creando imagen NDVI profesional:', {
    dimensiones: `${width}x${height}`,
    bbox: bbox,
    totalPixels: width * height
  })

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

  // 🎨 Colores basados en estándares científicos NDVI
  function getColorFromNDVI(ndvi: number): { r: number, g: number, b: number, a: number } {
    if (ndvi < 0) return { r: 0, g: 0, b: 255, a: 180 }           // Azul (agua)
    if (ndvi < 0.1) return { r: 165, g: 42, b: 42, a: 220 }       // Marrón oscuro
    if (ndvi < 0.2) return { r: 210, g: 105, b: 30, a: 220 }      // Chocolate
    if (ndvi < 0.3) return { r: 218, g: 165, b: 32, a: 220 }      // Dorado
    if (ndvi < 0.4) return { r: 255, g: 215, b: 0, a: 220 }       // Amarillo
    if (ndvi < 0.5) return { r: 173, g: 255, b: 47, a: 220 }      // Verde-amarillo
    if (ndvi < 0.6) return { r: 127, g: 255, b: 0, a: 220 }       // Verde lima
    if (ndvi < 0.7) return { r: 50, g: 205, b: 50, a: 220 }       // Verde medio
    if (ndvi < 0.8) return { r: 34, g: 139, b: 34, a: 220 }       // Verde bosque
    return { r: 0, g: 100, b: 0, a: 220 }                         // Verde oscuro
  }

  let minValue = Infinity
  let maxValue = -Infinity
  let validCount = 0
  let pixelesDentro = 0

  // Crear canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // ✅ Pintar pixel por pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = matriz[y][x]
      
      const lng = west + (x / width) * (east - west)
      const lat = north - (y / height) * (north - south)
      
      if (puntoEnPoligono(lat, lng, poligonoCoords)) {
        pixelesDentro++
        
        if (value !== -999 && !isNaN(value)) {
          const color = getColorFromNDVI(value)
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`
          ctx.fillRect(x, y, 1, 1)
          
          validCount++
          minValue = Math.min(minValue, value)
          maxValue = Math.max(maxValue, value)
        } else {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.3)'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }

  console.log('✅ Imagen NDVI renderizada:', {
    pixelesDentro: pixelesDentro,
    pixelesConDatos: validCount,
    cobertura: `${((validCount / pixelesDentro) * 100).toFixed(1)}%`,
    minNDVI: minValue.toFixed(3),
    maxNDVI: maxValue.toFixed(3)
  })

  if (validCount === 0) {
    console.warn('⚠️ No hay datos NDVI válidos dentro del polígono')
    return null
  }

  const bounds = (L as any).latLngBounds(
    [south, west],
    [north, east]
  )

  const imageOverlay = (L as any).imageOverlay(canvas.toDataURL(), bounds, {
    opacity: 0.75,
    interactive: false,
    crossOrigin: 'anonymous'
  })

  return imageOverlay
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
  const locationLayersRef = useRef<any[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [ubicandoUsuario, setUbicandoUsuario] = useState(false)

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
            icon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon'
            }),
            touchIcon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
            }),
            guidelineDistance: 20,
            showLength: true,
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
          poly: {
            icon: new (L as any).DivIcon({
              iconSize: new (L as any).Point(8, 8),
              className: 'leaflet-div-icon leaflet-editing-icon'
            })
          }
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
        event.layers.eachLayer((layer: any) => {
          const latlngs = layer.getLatLngs()[0]
          const areaM2 = calcularAreaPoligono(latlngs)
          setAreaHectareas(areaM2 / 10000)
        })
      })

      map.on(DrawEvent.DELETED, () => setAreaHectareas(null))
    }

    return () => map.remove()
  }, [isReady, initialCenter, initialZoom, readOnly, existingPolygons])

  /**
   * 🔄 Redibujar polígonos cuando cambian
   */
  useEffect(() => {
    if (!mapRef.current || !existingLayersRef.current) return
    if (!isReady) return

    existingLayersRef.current.clearLayers()

    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates?.length) return

      // 🗺️ PRIMERO: Agregar imagen NDVI si hay datos
      if (potrero.info?.ndviMatriz?.matriz?.length > 0) {
        const imageOverlay = crearImagenNDVI(
          potrero.info.ndviMatriz,
          potrero.coordinates
        )
        if (imageOverlay) {
          existingLayersRef.current.addLayer(imageOverlay)
        }
      }

      // DESPUÉS: Dibujar el polígono encima (borde visible)
      const polygon = (L as any).polygon(potrero.coordinates, {
        color: potrero.color || '#10b981',
        fillColor: 'transparent', // ✅ Totalmente transparente para ver el NDVI
        fillOpacity: 0,
        weight: 3,
      })

      existingLayersRef.current.addLayer(polygon)

      // 🏷️ Tooltip con nombre
      const center = polygon.getBounds().getCenter()
      
      let animalesText = ''
      if (potrero.info?.animales?.length) {
        const lineas = potrero.info.animales
          .map((a: any) => `${a.categoria}: ${a.cantidad}`)
          .join('<br>')
        animalesText = lineas
      }

      const tooltipContent = `
        <div style="
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
          white-space: nowrap;
        ">
          <div style="
            font-weight: bold; 
            font-size: 18px; 
            color: black; 
            text-shadow: 
              -1px -1px 0 white,
              1px -1px 0 white,
              -1px 1px 0 white,
              1px 1px 0 white,
              -2px 0 0 white,
              2px 0 0 white,
              0 -2px 0 white,
              0 2px 0 white;
            margin-bottom: 2px;
          ">
            ${potrero.nombre}
          </div>
          <div style="
            font-size: 18px; 
            color: black; 
            text-shadow: 
              -1px -1px 0 white,
              1px -1px 0 white,
              -1px 1px 0 white,
              1px 1px 0 white;
            line-height: 1.3;
          ">
            ${animalesText}
          </div>
        </div>
      `

      const tooltip = (L as any).tooltip({
        permanent: true,
        direction: 'center',
        className: 'potrero-label-transparent',
        opacity: 1,
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
  
  const ubicarUsuario = () => {
  if (!mapRef.current) return
  
  setUbicandoUsuario(true)

  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización')
    setUbicandoUsuario(false)
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords

      try {
        // 🧹 LIMPIAR MARCADORES ANTERIORES
        locationLayersRef.current.forEach(layer => {
          mapRef.current.removeLayer(layer)
        })
        locationLayersRef.current = []

        // Centrar mapa
        mapRef.current.setView([latitude, longitude], 17)

        // Círculo de precisión
        const precisionCircle = (L as any).circle([latitude, longitude], {
          radius: accuracy,
          color: '#4285f4',
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          weight: 1
        })
        precisionCircle.addTo(mapRef.current)
        locationLayersRef.current.push(precisionCircle)

        // Punto azul
        const marker = (L as any).circleMarker([latitude, longitude], {
          radius: 10,
          fillColor: '#4285f4',
          color: 'white',
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        })
        marker.addTo(mapRef.current)
        locationLayersRef.current.push(marker)

        setUbicandoUsuario(false)
      } catch (error) {
        console.error('Error:', error)
        alert('Error mostrando la ubicación en el mapa')
        setUbicandoUsuario(false)
      }
    },
    (error) => {
      alert('No se pudo obtener tu ubicación')
      setUbicandoUsuario(false)
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )
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
      {/* 🎯 BOTÓN DE UBICACIÓN */}
<button
  onClick={ubicarUsuario}
  disabled={ubicandoUsuario}
  className="absolute top-[80px] left-3 z-[1000] bg-white rounded-lg shadow-lg hover:shadow-xl transition-all w-10 h-10 flex items-center justify-center disabled:opacity-50"
  title="Mi ubicación"
>
  {ubicandoUsuario ? (
    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="2"/>
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="22" y2="12"/>
    </svg>
  )}
</button>
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