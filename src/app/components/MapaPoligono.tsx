'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import * as turf from '@turf/turf'


if (typeof window !== 'undefined') {
  require('leaflet-draw')
  require('leaflet-geometryutil')

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
      /* 📍 MOVER CONTROLES DE LEAFLET HACIA ABAJO para no superponerse con pantalla completa */
      .leaflet-top.leaflet-left {
        top: 50px !important;
      }
      /* 📏 Quitar fondo azul de los marcadores de medición */
      .medicion-label {
        background: transparent !important;
        border: none !important;
      }
      .medicion-label::before {
        display: none !important;
      }
      .leaflet-marker-icon.medicion-label {
        background: transparent !important;
        border: none !important;
      }
        /* 📐 Quitar punto azul del marcador de área */
      .medicion-area {
        background: transparent !important;
        border: none !important;
      }
      .medicion-area::before {
        display: none !important;
      }
      .leaflet-marker-icon.medicion-area {
        background: transparent !important;
        border: none !important;
      }
    `
    document.head.appendChild(style)
  }
}


// 🎨 Colores por módulo de pastoreo (mismos que en page.tsx)
const COLORES_MODULOS: string[] = [
  '#8B5CF6', // Violeta
  '#EC4899', // Rosa
  '#F59E0B', // Ámbar
  '#10B981', // Esmeralda
  '#3B82F6', // Azul
  '#EF4444', // Rojo
  '#14B8A6', // Teal
  '#F97316', // Naranja
  '#6366F1', // Índigo
  '#84CC16', // Lima
]

interface ModuloLeyenda {
  id: string
  nombre: string
  color: string
  cantidadPotreros: number
  hectareas: number
  totalAnimales?: number
  animalesPorCategoria?: Record<string, number>
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
  moduloPastoreoId?: string | null
  isDashed?: boolean      // 🆕 NUEVO
  isEditing?: boolean     // 🆕 NUEVO
  info?: {
    hectareas?: number
    cultivos?: any[]
    animales?: any[]
    ndviMatriz?: any
  }
}>
  readOnly?: boolean
  modulosLeyenda?: ModuloLeyenda[]
  mostrarLeyendaModulos?: boolean
  mostrarCurvasNivel?: boolean
  mostrarConeat?: boolean
  opacidadCurvas?: number
  onOpacidadCurvasChange?: (opacity: number) => void
}

function calcularAreaPoligono(latlngs: any[]): number {
  if (latlngs.length < 3) return 0
  
  // ✅ TURF.JS - MÁXIMA PRECISIÓN GEODÉSICA
  // Convertir a formato GeoJSON [lng, lat]
  const coords = latlngs.map(ll => [ll.lng, ll.lat])
  coords.push(coords[0]) // Cerrar el polígono
  
  const polygon = turf.polygon([coords])
  return turf.area(polygon) // Retorna m² con precisión geodésica
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
  // coords viene en formato [lng, lat]
  function puntoEnPoligono(lat: number, lng: number, coords: number[][]): boolean {
    let dentro = false
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1]  // [0] = lng, [1] = lat
      const xj = coords[j][0], yj = coords[j][1]
      
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
  modulosLeyenda = [],
  mostrarLeyendaModulos = false,
  mostrarCurvasNivel = false,
  mostrarConeat = false,  // 🔥 NUEVO
  opacidadCurvas = 95,
  onOpacidadCurvasChange,
}: MapaPoligonoProps) {

  const mapRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const existingLayersRef = useRef<any>(null)
  const locationLayersRef = useRef<any[]>([])
  const curvasLayerRef = useRef<any>(null)  // 🔥 NUEVO
  const coneatLayerRef = useRef<any>(null)  // 🔥 NUEVO

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [ubicandoUsuario, setUbicandoUsuario] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const [midiendo, setMidiendo] = useState(false)
  const [puntosMedicion, setPuntosMedicion] = useState<any[]>([])

  // 🖥️ Función para entrar/salir de pantalla completa
  const toggleFullscreen = () => {
    const mapContainer = document.getElementById('map-container')
    
    console.log('🖥️ FULLSCREEN DEBUG:')
    console.log('  - mapContainer encontrado:', !!mapContainer)
    console.log('  - existingLayersRef:', !!existingLayersRef.current)
    
    if (existingLayersRef.current) {
  let tooltipCount = 0
  existingLayersRef.current.eachLayer((layer: any) => {
    const isTooltip = layer instanceof (L as any).Tooltip || 
                      layer._tooltip || 
                      (layer.getContent && typeof layer.getContent === 'function')
    if (isTooltip) {
      tooltipCount++
      console.log('  - Tooltip encontrado, opacity actual:', layer.options?.opacity)
    }
  })
  console.log('  - Total tooltips:', tooltipCount)
}
    
    if (!mapContainer) return
    
    if (!document.fullscreenElement) {
      mapContainer.requestFullscreen()
        .then(() => {
          setIsFullscreen(true)
          console.log('✅ Entró en fullscreen')
          
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize()
              console.log('📐 invalidateSize ejecutado')
              
              if (existingLayersRef.current) {
  let count = 0
  existingLayersRef.current.eachLayer((layer: any) => {
    // Detectar tooltips de cualquier forma
    if (layer instanceof (L as any).Tooltip || 
        layer._tooltip || 
        layer.options?.permanent === true ||
        (layer.getContent && typeof layer.getContent === 'function')) {
      layer.setOpacity(1)
      count++
      console.log('  👁️ Tooltip mostrado')
    }
  })
  console.log('👁️ Tooltips forzados a visible:', count)
}
            }
          }, 300)
        })
        .catch((err) => console.error('Error:', err))
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error('Error:', err))
    }
  }

  useEffect(() => {
    if (initialCenter) setIsReady(true)
  }, [initialCenter])

  // 🖥️ Detectar cuando el usuario sale de pantalla completa (ESC)
useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement)
    
    // 🔥 FORZAR RECALCULO DE DIMENSIONES DEL MAPA
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize()
      }, 100)
    }
  }
  
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  return () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }
}, [])

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

const osmLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap', maxZoom: 19 }
)

const curvasLayer = L.tileLayer(
  'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  { 
    attribution: '© OpenTopoMap', 
    maxZoom: 17,
    opacity: opacidadCurvas / 100,
    zIndex: 1000
  }
)

// 🔥 Capa de CONEAT - ArcGIS Dynamic MapServer del MGAP (sin esri-leaflet)
const coneatLayer = (L as any).tileLayer('', {
  opacity: 0.7,
  zIndex: 1000,
  attribution: '© MGAP Uruguay'
})

// Sobrescribir getTileUrl para generar URLs de ArcGIS Export
coneatLayer.getTileUrl = function(coords: any) {
  const map = this._map
  const bounds = this._tileCoordsToBounds(coords)
  const sw = map.options.crs.project(bounds.getSouthWest())
  const ne = map.options.crs.project(bounds.getNorthEast())
  
  const url = 'https://dgrn.mgap.gub.uy/arcgis/rest/services/CONEAT/SuelosConeat/MapServer/export'
  const params = new URLSearchParams({
    bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: '256,256',
    dpi: '96',
    format: 'png8',
    transparent: 'true',
    layers: 'show:1',
    f: 'image'
  })
  
  return `${url}?${params.toString()}`
}

// Agregar capa base por defecto
satelitalLayer.addTo(map)

// Control de capas base
L.control.layers({ 'Satélite': satelitalLayer, 'Mapa': osmLayer }).addTo(map)



    const existingLayers = new L.FeatureGroup()
    map.addLayer(existingLayers)
    existingLayersRef.current = existingLayers

    existingPolygons.forEach((potrero) => {
  if (!potrero.coordinates?.length) return

  // 🔥 CONVERTIR de [lng, lat] a [lat, lng] para Leaflet
  const coordsParaMapa = potrero.coordinates.map(coord => [coord[1], coord[0]])

  // 🗺️ PRIMERO: Agregar imagen NDVI si hay datos (solo si NO está editando)
  if (potrero.info?.ndviMatriz?.matriz?.length > 0 && !potrero.isEditing) {
    const imageOverlay = crearImagenNDVI(
      potrero.info.ndviMatriz,
      potrero.coordinates
    )
    if (imageOverlay) {
      existingLayersRef.current.addLayer(imageOverlay)
    }
  }

  // DESPUÉS: Dibujar el polígono encima (borde visible)
  const polygon = (L as any).polygon(coordsParaMapa, {
    color: potrero.isEditing ? '#9ca3af' : (potrero.color || '#10b981'), // 🔥 Gris si está editando
    fillColor: potrero.isEditing ? '#e5e7eb' : 'transparent', // 🔥 Gris claro si está editando
    fillOpacity: potrero.isEditing ? 0.15 : 0, // 🔥 Ligeramente visible si está editando
    weight: potrero.isEditing ? 2 : 3, // 🔥 Más delgado si está editando
    opacity: potrero.isEditing ? 0.6 : 1, // 🔥 Más transparente si está editando
    dashArray: potrero.isDashed ? '10, 10' : undefined, // 🔥 LÍNEA PUNTEADA
  })

  existingLayersRef.current.addLayer(polygon)
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
      showArea: false,  // ✅ DESHABILITAR para evitar confusión
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
  // 🔥 Guardar referencias a las capas en refs
    curvasLayerRef.current = curvasLayer
    coneatLayerRef.current = coneatLayer
    console.log('📦 Referencia de curvas guardada:', curvasLayer)
    console.log('📦 Referencia de CONEAT guardada:', coneatLayer)

    return () => {
  // Limpiar handlers antes de destruir el mapa
  if (mapRef.current) {
    mapRef.current.off('zoomend')
    mapRef.current.off('moveend')
    mapRef.current._tooltipZoomHandler = false
  }
  map.remove()
  mapRef.current = null
}
  }, [isReady, initialCenter, initialZoom, readOnly, existingPolygons])

  /**
   * 🔄 Redibujar polígonos cuando cambian
   */
  useEffect(() => {
  if (!mapRef.current || !existingLayersRef.current) return
  if (!isReady) return
  
  // Verificar que el mapa sigue siendo válido
  try {
    mapRef.current.getCenter()
  } catch (e) {
    console.warn('Mapa no disponible, saltando actualización')
    return
  }

    existingLayersRef.current.clearLayers()

    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates?.length) return
     // 🔥 CONVERTIR de [lng, lat] a [lat, lng]
  const coordsParaMapa = potrero.coordinates.map(coord => [coord[1], coord[0]])

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
      const polygon = (L as any).polygon(coordsParaMapa, {
        color: potrero.color || '#10b981',
        fillColor: 'transparent', // ✅ Totalmente transparente para ver el NDVI
        fillOpacity: 0,
        weight: 3,
      })

      existingLayersRef.current.addLayer(polygon)

      // 🏷️ Tooltip con nombre Y DETALLE COMPLETO de animales
const center = polygon.getBounds().getCenter()

let animalesText = ''
if (potrero.info?.animales?.length) {
  const lineas = potrero.info.animales
    .map((a: any) => `${a.categoria}: ${a.cantidad}`)
    .join('<br>')
  animalesText = lineas
}

// Función para determinar tamaño según zoom
const getFontSizes = () => {
  const currentZoom = mapRef.current?.getZoom() || 14
  
  if (currentZoom >= 16) return { nombre: '20px', animales: '18px' }
  if (currentZoom >= 14) return { nombre: '18px', animales: '16px' }
  if (currentZoom >= 13) return { nombre: '16px', animales: '14px' }
  return { nombre: '14px', animales: '12px' }
}

const sizes = getFontSizes()

const tooltipContent = `
  <div style="
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    white-space: nowrap;
  ">
    <div style="
      font-weight: 700; 
      font-size: ${sizes.nombre}; 
      color: white; 
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      margin-bottom: 2px;
    ">
      ${potrero.nombre}
    </div>
    <div style="
      font-size: ${sizes.animales}; 
      color: white; 
      font-weight: 500;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
      line-height: 1.4;
    ">
      ${animalesText}
    </div>
  </div>
`

// 🔥 NO mostrar tooltip si está editando
if (!potrero.isEditing) {
  const tooltip = (L as any).tooltip({
    permanent: true,
    direction: 'center',
    className: 'potrero-label-transparent',
    opacity: 1,
  }).setContent(tooltipContent)

  // Guardar metadata en el tooltip para decisiones de visibilidad
  tooltip._potreroData = {
    id: potrero.id,
    hectareas: potrero.info?.hectareas || 0,
    center: center
  }

  tooltip.setLatLng(center)
  existingLayersRef.current.addLayer(tooltip)

  // 🎯 MAGIA: Ocultar/mostrar tooltips según zoom para evitar superposición
  if (!mapRef.current._tooltipZoomHandler) {
    mapRef.current._tooltipZoomHandler = true
    mapRef.current.on('zoomend', () => {
      const currentZoom = mapRef.current.getZoom()
      
      existingLayersRef.current.eachLayer((layer: any) => {
        if (layer instanceof (L as any).Tooltip) {
          // Ocultar en zoom bajo, mostrar en zoom medio/alto
          if (currentZoom < 13) {
            layer.setOpacity(0) // Invisible en zoom bajo
          } else {
            layer.setOpacity(1) // Visible en zoom medio/alto
          }
        }
      })
    })
  }

  // Aplicar visibilidad inicial según zoom actual
  const initialZoom = mapRef.current?.getZoom() || 14
  if (initialZoom < 13) {
    tooltip.setOpacity(0)
  }
}
    })
    
    // 🎯 SISTEMA INTELIGENTE: Gestionar visibilidad de tooltips según zoom
const gestionarVisibilidadTooltips = () => {
  if (!mapRef.current) return
  
  // EN FULLSCREEN, MOSTRAR TODOS LOS TOOLTIPS
  if (document.fullscreenElement) {
    existingLayersRef.current?.eachLayer((layer: any) => {
      if (layer instanceof (L as any).Tooltip) {
        layer.setOpacity(1)
      }
    })
    return
  }
  
  const currentZoom = mapRef.current.getZoom()
  const mapCenter = mapRef.current.getCenter()
  
  // Recopilar todos los tooltips
  const tooltips: any[] = []
  existingLayersRef.current.eachLayer((layer: any) => {
    if (layer instanceof (L as any).Tooltip && layer._potreroData) {
      tooltips.push(layer)
    }
  })
  
  if (tooltips.length === 0) return
  
  // 🔍 ZOOM BAJO (< 13): Mostrar solo el potrero MÁS GRANDE
  if (currentZoom < 13) {
    // Encontrar el potrero más grande
    let mayorTooltip = tooltips[0]
    tooltips.forEach(t => {
      if (t._potreroData.hectareas > mayorTooltip._potreroData.hectareas) {
        mayorTooltip = t
      }
    })
    
    // Ocultar todos excepto el más grande
    tooltips.forEach(t => {
      if (t === mayorTooltip) {
        t.setOpacity(1)
      } else {
        t.setOpacity(0)
      }
    })
  }
  // 🔍 ZOOM MEDIO (13-15): Evitar colisiones
  else if (currentZoom < 15) {
    // Ordenar por tamaño (más grandes primero)
    tooltips.sort((a, b) => b._potreroData.hectareas - a._potreroData.hectareas)
    
    const visibles: any[] = []
    
    tooltips.forEach(tooltip => {
      const pos = mapRef.current.latLngToContainerPoint(tooltip._potreroData.center)
      
      // Verificar si colisiona con algún tooltip ya visible
      let colisiona = false
      const margen = 80 // píxeles de separación mínima
      
      for (const visible of visibles) {
        const visiblePos = mapRef.current.latLngToContainerPoint(visible._potreroData.center)
        const distancia = Math.sqrt(
          Math.pow(pos.x - visiblePos.x, 2) + 
          Math.pow(pos.y - visiblePos.y, 2)
        )
        
        if (distancia < margen) {
          colisiona = true
          break
        }
      }
      
      if (!colisiona) {
        tooltip.setOpacity(1)
        visibles.push(tooltip)
      } else {
        tooltip.setOpacity(0)
      }
    })
  }
  // 🔍 ZOOM ALTO (≥ 15): Mostrar TODOS
  else {
    tooltips.forEach(t => t.setOpacity(1))
  }
}

// Aplicar lógica inicial
gestionarVisibilidadTooltips()


// RE-APLICAR CUANDO CAMBIA FULLSCREEN
const fullscreenHandler = () => {
  setTimeout(() => {
    if (document.fullscreenElement && existingLayersRef.current) {
      existingLayersRef.current.eachLayer((layer: any) => {
        if (layer.options?.permanent === true) {
          layer.setOpacity(1)
        }
      })
    }
  }, 300)
}
document.addEventListener('fullscreenchange', fullscreenHandler)

// Actualizar cuando cambia el zoom o se mueve el mapa
if (!mapRef.current._tooltipZoomHandler) {
  mapRef.current._tooltipZoomHandler = true
  mapRef.current.on('zoomend', gestionarVisibilidadTooltips)
  mapRef.current.on('moveend', gestionarVisibilidadTooltips)
}
    if (existingPolygons.length > 0 && existingLayersRef.current.getLayers().length > 0) {
      try {
        const bounds = (existingLayersRef.current as any).getBounds()
        mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
      } catch {}
    }
   }, [existingPolygons, isReady])

  /**
   * 🗺️ Controlar capa de curvas de nivel
   */
  useEffect(() => {
    console.log('🔄 useEffect curvas ejecutado. mostrarCurvasNivel:', mostrarCurvasNivel, 'isReady:', isReady)
    
    if (!isReady || !mapRef.current) {
      console.log('⚠️ Esperando que el mapa esté listo... isReady:', isReady, 'mapRef:', !!mapRef.current)
      return
    }
    
    const curvasLayer = curvasLayerRef.current
    
    if (!curvasLayer) {
      console.log('⚠️ No hay capa de curvas guardada')
      return
    }
    
    if (mostrarCurvasNivel) {
      console.log('🗺️ Intentando mostrar curvas...')
      
      if (!mapRef.current.hasLayer(curvasLayer)) {
        console.log('➕ Agregando capa de curvas al mapa...')
        curvasLayer.addTo(mapRef.current)
        curvasLayer.setZIndex(1000)
        curvasLayer.setOpacity(opacidadCurvas / 100) // 🔥 AGREGADO
        console.log('✅ Capa de curvas agregada exitosamente con opacidad:', opacidadCurvas) // 🔥 MODIFICADO
      } else {
        console.log('ℹ️ La capa de curvas ya estaba en el mapa')
      }
    } else {
      console.log('🗺️ Ocultando curvas...')
      
      if (mapRef.current.hasLayer(curvasLayer)) {
        console.log('➖ Removiendo capa de curvas del mapa...')
        mapRef.current.removeLayer(curvasLayer)
        console.log('✅ Capa de curvas removida exitosamente')
      } else {
        console.log('ℹ️ La capa de curvas no estaba en el mapa')
      }
    }
  }, [mostrarCurvasNivel, isReady, opacidadCurvas])

  /**
   * 🌱 Controlar capa de CONEAT
   */
  useEffect(() => {
    console.log('🔄 useEffect CONEAT ejecutado. mostrarConeat:', mostrarConeat, 'isReady:', isReady)
    
    if (!isReady || !mapRef.current) {
      console.log('⚠️ Esperando que el mapa esté listo... isReady:', isReady, 'mapRef:', !!mapRef.current)
      return
    }
    
    const coneatLayer = coneatLayerRef.current
    
    if (!coneatLayer) {
      console.log('⚠️ No hay capa de CONEAT guardada')
      return
    }
    
    if (mostrarConeat) {
      console.log('🌱 Intentando mostrar CONEAT...')
      
      if (!mapRef.current.hasLayer(coneatLayer)) {
        console.log('➕ Agregando capa CONEAT al mapa...')
        coneatLayer.addTo(mapRef.current)
        coneatLayer.setZIndex(1000)
        console.log('✅ Capa CONEAT agregada exitosamente')
      } else {
        console.log('ℹ️ La capa CONEAT ya estaba en el mapa')
      }
    } else {
      console.log('🌱 Ocultando CONEAT...')
      
      if (mapRef.current.hasLayer(coneatLayer)) {
        console.log('➖ Removiendo capa CONEAT del mapa...')
        mapRef.current.removeLayer(coneatLayer)
        console.log('✅ Capa CONEAT removida exitosamente')
      } else {
        console.log('ℹ️ La capa CONEAT no estaba en el mapa')
      }
    }
  }, [mostrarConeat, isReady])

  /**
   * 🎨 Actualizar opacidad de curvas dinámicamente
   */
  useEffect(() => {
    const curvasLayer = curvasLayerRef.current
    if (curvasLayer) {
      curvasLayer.setOpacity(opacidadCurvas / 100)
      console.log('🎨 Opacidad actualizada a:', opacidadCurvas)
    }
  }, [opacidadCurvas])
  

  /**
   * 📏 Manejar clicks para medición
   */
  useEffect(() => {
    if (!mapRef.current) return
    
    const handleClick = (e: any) => {
      if (!midiendo) return
      
      // Verificar si clickeó cerca del primer punto (cerrar polígono)
      const primerPunto = puntosMedicion[0]
      const distanciaAlPrimero = primerPunto ? e.latlng.distanceTo(primerPunto) : Infinity
      const esCierre = puntosMedicion.length >= 3 && distanciaAlPrimero < 20 // 20 metros de tolerancia
      
      let newPuntos
      if (esCierre) {
        // Cerrar el polígono
        newPuntos = [...puntosMedicion, primerPunto]
      } else {
        newPuntos = [...puntosMedicion, e.latlng]
      }
      
      setPuntosMedicion(newPuntos)
      
      if (newPuntos.length > 1) {
  // Dibujar la línea completa
  const linea = (L as any).polyline(newPuntos, {
    color: '#3b82f6',
    weight: 3,
    className: 'linea-medicion',
    fill: esCierre,
    fillColor: '#3b82f6',
    fillOpacity: 0.1
  }).addTo(mapRef.current)
  
  // Dibujar tooltips para cada segmento
  for (let i = 0; i < newPuntos.length - 1; i++) {
    const p1 = newPuntos[i]
    const p2 = newPuntos[i + 1]
    
    // ✅ Usar Turf.js para distancia geodésica precisa
    const from = turf.point([p1.lng, p1.lat])
    const to = turf.point([p2.lng, p2.lat])
    const distanciaMetros = turf.distance(from, to, { units: 'meters' })
    
    const puntoMedio = (L as any).latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    )
    
    let textoDistancia = ""
    if (distanciaMetros > 1000) {
      textoDistancia = (distanciaMetros / 1000).toFixed(2) + " km"
    } else {
      textoDistancia = Math.round(distanciaMetros) + " m"
    }
          
          // Tooltip para cada segmento
          (L as any).marker(puntoMedio, {
            icon: (L as any).divIcon({
              className: 'medicion-label',
              html: `<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: inline-block;">${textoDistancia}</span>`,
              iconSize: [0, 0]
            }),
            className: 'linea-medicion',
            interactive: false
          }).addTo(mapRef.current)
        }
        
        // Si es polígono cerrado, mostrar área
if (esCierre) {
  // ✅ Usar Turf.js para consistencia
  const coords = newPuntos.map((p: any) => [p.lng, p.lat])
  coords.push(coords[0])
  const polygon = turf.polygon([coords])
  const area = turf.area(polygon)
  const areaHa = area / 10000
  const centroide = linea.getBounds().getCenter()
          
          const areaNum = Number(area) || 0
          let textoArea = ""
          if (areaHa >= 0.01) {
            // Mostrar hectáreas desde 0.01 ha (100 m²)
            textoArea = areaHa.toFixed(2) + " ha"
          } else {
            textoArea = Math.round(areaNum) + " m²"
          }
          
          (L as any).marker(centroide, {
            icon: (L as any).divIcon({
              className: 'medicion-area',
              html: `<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; white-space: nowrap; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📐 ${textoArea}</span>`,
              iconSize: [0, 0]
            }),
            className: 'linea-medicion',
            interactive: false
          }).addTo(mapRef.current)
          
          // Terminar medición automáticamente
          setTimeout(() => {
            setMidiendo(false)
          }, 100)
        }
      }
      
      // Agregar marcador en el punto (excepto si es cierre)
      if (!esCierre) {
        (L as any).circleMarker(e.latlng, {
          radius: 5,
          color: '#3b82f6',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
          className: 'linea-medicion'
        }).addTo(mapRef.current)
      }
    }
    
    if (midiendo) {
      mapRef.current.on('click', handleClick)
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleClick)
      }
    }
  }, [midiendo, puntosMedicion])

  

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
  
  const ubicarUsuario = async () => {
    if (!mapRef.current) return
    
    setUbicandoUsuario(true)

    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización')
      setUbicandoUsuario(false)
      return
    }

    // 🔐 VERIFICAR PERMISOS PRIMERO (si el navegador lo soporta)
    try {
      if ('permissions' in navigator) {
        const permission = await (navigator as any).permissions.query({ name: 'geolocation' })
        
        if (permission.state === 'denied') {
          alert('❌ Permiso de ubicación denegado.\n\n📍 Para habilitarlo:\n1. Hacé clic en el ícono 🔒 o ⓘ en la barra de direcciones\n2. Buscá "Ubicación" y cambialo a "Permitir"\n3. Recargá la página')
          setUbicandoUsuario(false)
          return
        }
      }
    } catch (e) {
      // Si no soporta la API de permisos, continuar igual
      console.log('API de permisos no disponible, continuando...')
    }

    // 📍 OBTENER UBICACIÓN
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
          console.error('Error mostrando ubicación:', error)
          alert('Error mostrando la ubicación en el mapa')
          setUbicandoUsuario(false)
        }
      },
      (error) => {
        console.error('Error de geolocalización:', error)
        
        let mensaje = ''
        switch (error.code) {
          case error.PERMISSION_DENIED:
            mensaje = '❌ Permiso de ubicación denegado.\n\n📍 Para habilitarlo:\n1. Hacé clic en el ícono 🔒 en la barra de direcciones\n2. Buscá "Ubicación" y cambialo a "Permitir"\n3. Volvé a intentar'
            break
          case error.POSITION_UNAVAILABLE:
            mensaje = '📍 No se pudo determinar tu ubicación.\nAsegurate de tener GPS/WiFi activado.'
            break
          case error.TIMEOUT:
            mensaje = '⏱️ Se agotó el tiempo esperando la ubicación.\nIntentá de nuevo.'
            break
          default:
            mensaje = '❌ Error desconocido obteniendo ubicación.'
        }
        
        alert(mensaje)
        setUbicandoUsuario(false)
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 0 
      }
    )
  }

  const confirmarPoligono = () => {
    if (!drawnItemsRef.current) return
    if (drawnItemsRef.current.getLayers().length === 0)
      return alert('Dibuje el potrero primero')

    const layer = drawnItemsRef.current.getLayers()[0]
    const latlngs = layer.getLatLngs()[0]
    // ✅ Convertir a [lng, lat] - formato GeoJSON estándar
    const coordinates = latlngs.map((ll: any) => [ll.lng, ll.lat])

    if (areaHectareas && onPolygonComplete) {
      onPolygonComplete(coordinates, areaHectareas)
    }
  }
  
  // 📏 Activar/desactivar medición
  const toggleMedicion = () => {
    setMidiendo(!midiendo)
    setPuntosMedicion([])
    
    // Limpiar líneas anteriores
    if (mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if ((layer as any).options?.className === 'linea-medicion') {
          mapRef.current?.removeLayer(layer)
        }
      })
    }
  }

  return (
    <div id="map-container" className="relative w-full h-full flex flex-col">
      
      {/* 🖥️ BOTÓN DE PANTALLA COMPLETA - Arriba a la izquierda */}
<button
  onClick={toggleFullscreen}
  className="hidden sm:flex absolute top-3 left-3 z-[10] bg-white rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] items-center justify-center border-2 border-gray-300"
  title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
>
        {isFullscreen ? (
          // Ícono para SALIR de pantalla completa
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          // Ícono para ENTRAR en pantalla completa
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
      {/* 📏 BOTÓN DE MEDICIÓN - Solo visible en modo lectura */}
{readOnly && (
  <button
    onClick={toggleMedicion}
    className={`absolute top-3 left-3 z-[10] rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] flex items-center justify-center border-2 text-lg ${
      midiendo 
        ? 'bg-blue-600 border-blue-600' 
        : 'bg-white border-gray-300'
    }`}
    style={{ marginTop: '124px' }}
    title={midiendo ? "Terminar medición" : "Medir distancia"}
  >
    📏
  </button>
)}

      {/* 🎯 BOTÓN DE UBICACIÓN - Debajo del control de capas */}
      <button
        onClick={ubicarUsuario}
        disabled={ubicandoUsuario}
        className="absolute top-[70px] right-3 z-[10] bg-white rounded-lg shadow-lg hover:shadow-xl transition-all w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] flex items-center justify-center disabled:opacity-50 border-2 border-gray-300"
        title="Mi ubicación"
      >
        {ubicandoUsuario ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:stroke-current stroke-gray-700">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>

      {/* 🎨 CONTROL DE OPACIDAD - Solo en pantalla completa y vista Curvas */}
      {isFullscreen && mostrarCurvasNivel && (
        <div className="absolute top-[120px] right-3 z-[10] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-800">
              📏 Opacidad Curvas
            </label>
            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
              {opacidadCurvas}%
            </span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="100" 
            value={opacidadCurvas}
            onChange={(e) => {
              const newOpacity = Number(e.target.value)
              if (onOpacidadCurvasChange) {
                onOpacidadCurvasChange(newOpacity)
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            style={{
              background: `linear-gradient(to right, #d97706 0%, #d97706 ${opacidadCurvas}%, #e5e7eb ${opacidadCurvas}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Transparente</span>
            <span>Opaco</span>
          </div>
        </div>
      )}

      {/* 📦 LEYENDA DE MÓDULOS - Solo visible en PANTALLA COMPLETA */}
{isFullscreen && mostrarLeyendaModulos && modulosLeyenda.length > 0 && (
  <div className="absolute top-[120px] right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[320px]">
    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
      <span>📦</span> Módulos de Pastoreo
    </h3>
    <div className="space-y-3">
      {modulosLeyenda.map((modulo) => (
        <div
          key={modulo.id}
          className="p-3 rounded-lg transition-colors"
          style={{
            backgroundColor: `${modulo.color}15`,
          }}
        >
          {/* Header del módulo */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: modulo.color }}
            />
            <span className="font-semibold text-gray-900 text-sm">
              {modulo.nombre}
            </span>
          </div>
          
          {/* Stats en pills */}
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
              {modulo.cantidadPotreros} potrero{modulo.cantidadPotreros !== 1 ? 's' : ''}
            </span>
            <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
              {modulo.hectareas.toFixed(0)} ha
            </span>
            {modulo.totalAnimales && modulo.totalAnimales > 0 && (
              <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
                {modulo.totalAnimales} animales
              </span>
            )}
          </div>
          
          {/* Desglose de animales */}
          {modulo.animalesPorCategoria && Object.keys(modulo.animalesPorCategoria).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(modulo.animalesPorCategoria).map(([categoria, cantidad]) => (
                <span 
                  key={categoria}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  {cantidad} {categoria}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

      {!readOnly && (
        <div className="absolute top-4 left-4 right-4 z-[10] md:left-16 md:w-96">
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


      {!readOnly && areaHectareas !== null && (
        <div className="absolute top-4 right-4 z-[10] bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm">Área:</div>
          <div className="text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      <div id="map" className="flex-1 w-full h-full relative z-0" />

      {!readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-[10] flex flex-col sm:flex-row gap-3">
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