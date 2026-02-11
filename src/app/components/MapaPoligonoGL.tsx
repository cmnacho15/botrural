'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import * as turf from '@turf/turf'
import { toast } from '@/app/components/Toast'

// Tipos
interface Potrero {
  id: string
  nombre: string
  coordinates: number[][] // [lng, lat][]
  color?: string
  isDimmed?: boolean
  moduloPastoreoId?: string | null
  info?: {
    hectareas?: number
    cultivos?: any[]
    animales?: any[]
    ndviMatriz?: {
      promedio?: number
      imagenUrl?: string
      imagenBase64?: string
      bbox?: number[]
      fromCache?: boolean
    }
    altimetriaData?: {
      heatmapUrl?: string
      slopeUrl?: string
      bbox?: number[]
      elevacionMin?: number
      elevacionMax?: number
      elevacionPromedio?: number
      pendientePromedio?: number
    }
  }
  isEditing?: boolean
}

interface ModuloLeyenda {
  id: string
  nombre: string
  color: string
  cantidadPotreros: number
  hectareas: number
  totalAnimales?: number
  animalesPorCategoria?: Record<string, number>
}

interface MapaPoligonoGLProps {
  onPolygonComplete?: (coordinates: number[][], areaHectareas: number) => void
  initialCenter?: [number, number] // [lat, lng]
  initialZoom?: number
  existingPolygons?: Potrero[]
  readOnly?: boolean
  showNDVI?: boolean
  // 🏔️ Altimetría
  showAltimetria?: boolean
  subVistaAltimetria?: 'elevacion' | 'pendiente'
  // Nuevas props para compatibilidad con MapaPoligono
  modulosLeyenda?: ModuloLeyenda[]
  mostrarLeyendaModulos?: boolean
  mostrarCurvasNivel?: boolean
  mostrarConeat?: boolean
  opacidadCurvas?: number
  onOpacidadCurvasChange?: (opacity: number) => void
  mostrarResumenCultivos?: boolean
  resumenCultivos?: Array<{
    tipo: string
    hectareas: number
    color: string
    potreros?: Array<{ nombre: string; hectareas: number }>
  }>
  cultivoSeleccionado?: string | null
  onCultivoClick?: (tipo: string | null) => void
  // 🏷️ Nuevas props para controlar visibilidad de labels
  mostrarNombres?: boolean
  mostrarAnimales?: boolean
  onMostrarNombresChange?: (value: boolean) => void
  onMostrarAnimalesChange?: (value: boolean) => void
}

export default function MapaPoligonoGL({
  onPolygonComplete,
  initialCenter = [-32.5, -56.0],
  initialZoom = 14,
  existingPolygons = [],
  readOnly = false,
  showNDVI = false,
  showAltimetria = false,
  subVistaAltimetria = 'elevacion',
  modulosLeyenda = [],
  mostrarLeyendaModulos = false,
  mostrarCurvasNivel = false,
  mostrarConeat = false,
  opacidadCurvas = 95,
  onOpacidadCurvasChange,
  mostrarResumenCultivos = false,
  resumenCultivos = [],
  cultivoSeleccionado = null,
  onCultivoClick,
  mostrarNombres = true,
  mostrarAnimales = true,
  onMostrarNombresChange,
  onMostrarAnimalesChange,
}: MapaPoligonoGLProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<any>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const locationMarkersRef = useRef<maplibregl.Marker[]>([])
  const measureMarkersRef = useRef<maplibregl.Marker[]>([])

  const [mapLoaded, setMapLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'streets'>('satellite')
  const [ubicandoUsuario, setUbicandoUsuario] = useState(false)
  const [midiendo, setMidiendo] = useState(false)
  const [puntosMedicion, setPuntosMedicion] = useState<[number, number][]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [leyendaExpandida, setLeyendaExpandida] = useState(false)
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(null)

  // Estados para modo dibujo (cuando !readOnly)
  const [areaHectareas, setAreaHectareas] = useState<number | null>(null)
  const [drawnPolygon, setDrawnPolygon] = useState<number[][] | null>(null)

  const ndviLayersRef = useRef<string[]>([])
  const altimetriaLayersRef = useRef<string[]>([])

  // Calcular bounds inicial de los polígonos
  const getInitialBounds = useCallback(() => {
    if (existingPolygons.length === 0) return null

    const allCoords = existingPolygons.flatMap((p) => p.coordinates || [])
    if (allCoords.length === 0) return null

    const lngs = allCoords.map((c) => c[0])
    const lats = allCoords.map((c) => c[1])

    return new maplibregl.LngLatBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    )
  }, [existingPolygons])

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const bounds = getInitialBounds()
    let center: [number, number] = [initialCenter[1], initialCenter[0]]
    let zoom = initialZoom

    if (bounds) {
      center = [bounds.getCenter().lng, bounds.getCenter().lat]
      const lngSpan = bounds.getEast() - bounds.getWest()
      const latSpan = bounds.getNorth() - bounds.getSouth()
      const maxSpan = Math.max(lngSpan, latSpan)
      zoom = Math.min(15, Math.max(10, 14 - Math.log2(maxSpan * 100)))
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '&copy; Esri',
          },
          'streets': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap',
          },
          'curvas': {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 17,
            attribution: '&copy; OpenTopoMap',
          },
          // 🏔️ Mapbox Terrain DEM - Para hillshade y 3D
          'terrain-dem': {
            type: 'raster-dem',
            tiles: [
              'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=pk.eyJ1IjoiY21uYWNobzE1IiwiYSI6ImNtanRrY3N6NjVoZ24zZW90OW1jeTVkdDEifQ.AsXfoIjVJP7aiCowUFZNhA',
            ],
            tileSize: 256,
            maxzoom: 14,
            attribution: '&copy; Mapbox',
          },
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center,
      zoom,
      attributionControl: false,
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    )

    map.current.on('load', () => {
      setMapLoaded(true)

      // Agregar capa de calles (oculta inicialmente)
      if (map.current) {
        map.current.addLayer({
          id: 'streets-layer',
          type: 'raster',
          source: 'streets',
          minzoom: 0,
          maxzoom: 19,
          layout: { visibility: 'none' },
        })

        // Agregar capa de curvas (oculta inicialmente)
        map.current.addLayer({
          id: 'curvas-layer',
          type: 'raster',
          source: 'curvas',
          minzoom: 0,
          maxzoom: 17,
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': opacidadCurvas / 100 },
        })

        // 🏔️ Capa de hillshade nativo MapLibre (oculta inicialmente)
        map.current.addLayer({
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'terrain-dem',
          layout: { visibility: 'none' },
          paint: {
            'hillshade-illumination-direction': 315,
            'hillshade-exaggeration': 0.5,
            'hillshade-shadow-color': '#000000',
            'hillshade-highlight-color': '#ffffff',
          },
        })

        // 🎨 Agregar control de dibujo si no es readOnly
        if (!readOnly && map.current) {
          // Shim para que mapbox-gl-draw funcione con maplibre-gl
          // DEBE ejecutarse ANTES de importar MapboxDraw
          (window as any).mapboxgl = maplibregl

          // Importar dinámicamente para que el shim se aplique primero
          import('@mapbox/mapbox-gl-draw').then((MapboxDrawModule) => {
            const MapboxDraw = MapboxDrawModule.default

            if (!map.current) return

            const draw = new MapboxDraw({
              displayControlsDefault: false,
              controls: {
                polygon: true,
                trash: true,
              },
              styles: [
                // Polígono activo (mientras se dibuja)
                {
                  id: 'gl-draw-polygon-fill-active',
                  type: 'fill',
                  filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
                  paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.1,
                  },
                },
                // Polígono inactivo (ya dibujado)
                {
                  id: 'gl-draw-polygon-fill-inactive',
                  type: 'fill',
                  filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
                  paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.1,
                  },
                },
                // Borde del polígono activo
                {
                  id: 'gl-draw-polygon-stroke-active',
                  type: 'line',
                  filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
                  paint: {
                    'line-color': '#3b82f6',
                    'line-width': 3,
                  },
                },
                // Borde del polígono inactivo
                {
                  id: 'gl-draw-polygon-stroke-inactive',
                  type: 'line',
                  filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
                  paint: {
                    'line-color': '#3b82f6',
                    'line-width': 3,
                  },
                },
                // Línea mientras se dibuja
                {
                  id: 'gl-draw-line-active',
                  type: 'line',
                  filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
                  paint: {
                    'line-color': '#3b82f6',
                    'line-width': 3,
                    'line-dasharray': [2, 2],
                  },
                },
                // Vértices
                {
                  id: 'gl-draw-point-active',
                  type: 'circle',
                  filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
                  paint: {
                    'circle-radius': 6,
                    'circle-color': '#fff',
                    'circle-stroke-color': '#3b82f6',
                    'circle-stroke-width': 2,
                  },
                },
                // Punto medio
                {
                  id: 'gl-draw-point-midpoint',
                  type: 'circle',
                  filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
                  paint: {
                    'circle-radius': 4,
                    'circle-color': '#3b82f6',
                  },
                },
              ],
            })

            map.current!.addControl(draw as any, 'top-left')
            drawRef.current = draw

            // Eventos de dibujo
            map.current!.on('draw.create', (e: any) => {
              const feature = e.features[0]
              if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0]
                // Convertir a formato [lng, lat] sin el punto de cierre
                const coordsSinCierre = coords.slice(0, -1)
                setDrawnPolygon(coordsSinCierre)

                // Calcular área con Turf.js
                const polygon = turf.polygon([coords])
                const areaM2 = turf.area(polygon)
                const areaHa = areaM2 / 10000
                setAreaHectareas(areaHa)
              }
            })

            map.current!.on('draw.update', (e: any) => {
              const feature = e.features[0]
              if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0]
                const coordsSinCierre = coords.slice(0, -1)
                setDrawnPolygon(coordsSinCierre)

                const polygon = turf.polygon([coords])
                const areaM2 = turf.area(polygon)
                const areaHa = areaM2 / 10000
                setAreaHectareas(areaHa)
              }
            })

            map.current!.on('draw.delete', () => {
              setDrawnPolygon(null)
              setAreaHectareas(null)
            })
          })
        }
      }

      if (bounds && map.current) {
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 })
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Cambiar capa base
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (baseLayer === 'satellite') {
      map.current.setLayoutProperty('satellite-layer', 'visibility', 'visible')
      map.current.setLayoutProperty('streets-layer', 'visibility', 'none')
    } else {
      map.current.setLayoutProperty('satellite-layer', 'visibility', 'none')
      map.current.setLayoutProperty('streets-layer', 'visibility', 'visible')
    }
  }, [baseLayer, mapLoaded])

  // Controlar capa de curvas
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    try {
      if (mostrarCurvasNivel) {
        map.current.setLayoutProperty('curvas-layer', 'visibility', 'visible')
        map.current.setPaintProperty('curvas-layer', 'raster-opacity', opacidadCurvas / 100)
      } else {
        map.current.setLayoutProperty('curvas-layer', 'visibility', 'none')
      }
    } catch (e) {
      console.log('Capa curvas no disponible aún')
    }
  }, [mostrarCurvasNivel, opacidadCurvas, mapLoaded])

  // 🏔️ Controlar Hillshade + Terreno 3D (altimetría)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current
    const maskSourceId = 'hillshade-mask-source'
    const maskLayerId = 'hillshade-mask-layer'

    try {
      if (showAltimetria && existingPolygons.length > 0) {
        // Activar hillshade para efecto 3D sobre satélite
        mapInstance.setLayoutProperty('hillshade-layer', 'visibility', 'visible')

        // Activar terreno 3D (extrusión al inclinar)
        if (!mapInstance.getTerrain()) {
          mapInstance.setTerrain({
            source: 'terrain-dem',
            exaggeration: 2.0,
          })
        }

        // 🎭 Calcular bbox de todos los polígonos + margen 30%
        const allCoords = existingPolygons.flatMap(p => p.coordinates || [])
        if (allCoords.length > 0) {
          const lngs = allCoords.map(c => c[0])
          const lats = allCoords.map(c => c[1])
          const minLng = Math.min(...lngs)
          const maxLng = Math.max(...lngs)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)

          // Margen 300% para cubrir pantalla completa sin bordes negros
          const lngSpan = maxLng - minLng
          const latSpan = maxLat - minLat
          const margin = Math.max(lngSpan, latSpan) * 3.0

          const bboxWest = minLng - margin
          const bboxEast = maxLng + margin
          const bboxSouth = minLat - margin
          const bboxNorth = maxLat + margin

          // Polígono del mundo con agujero en el bbox del campo
          const worldPolygon: [number, number][] = [
            [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]
          ]
          // Agujero: el bbox del campo (orden inverso para que sea agujero)
          const bboxHole: [number, number][] = [
            [bboxWest, bboxSouth],
            [bboxWest, bboxNorth],
            [bboxEast, bboxNorth],
            [bboxEast, bboxSouth],
            [bboxWest, bboxSouth],
          ]

          const maskGeoJSON: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [worldPolygon, bboxHole],
            },
          }

          // Crear o actualizar source de máscara
          if (mapInstance.getSource(maskSourceId)) {
            (mapInstance.getSource(maskSourceId) as maplibregl.GeoJSONSource).setData(maskGeoJSON)
          } else {
            mapInstance.addSource(maskSourceId, { type: 'geojson', data: maskGeoJSON })
          }

          // Crear capa de máscara si no existe
          if (!mapInstance.getLayer(maskLayerId)) {
            mapInstance.addLayer({
              id: maskLayerId,
              type: 'fill',
              source: maskSourceId,
              paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.85,
              },
            })
          }

          mapInstance.setLayoutProperty(maskLayerId, 'visibility', 'visible')
        }

      } else {
        // Desactivar hillshade
        if (mapInstance.getLayer('hillshade-layer')) {
          mapInstance.setLayoutProperty('hillshade-layer', 'visibility', 'none')
        }

        // Ocultar máscara
        if (mapInstance.getLayer(maskLayerId)) {
          mapInstance.setLayoutProperty(maskLayerId, 'visibility', 'none')
        }

        // Desactivar terreno 3D
        if (mapInstance.getTerrain()) {
          mapInstance.setTerrain(null)
        }
      }
    } catch (e) {
      console.log('Hillshade/Terreno no disponible:', e)
    }
  }, [showAltimetria, mapLoaded, existingPolygons])

  // Controlar capa CONEAT
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current
    const coneatLayerId = 'coneat-layer'
    const coneatSourceId = 'coneat-source'

    if (mostrarConeat) {
      // Agregar fuente y capa CONEAT si no existen
      if (!mapInstance.getSource(coneatSourceId)) {
        // Usar endpoint export de ArcGIS con bbox dinámico
        // MapLibre reemplaza {bbox-epsg-3857} automáticamente con el bbox del tile
        mapInstance.addSource(coneatSourceId, {
          type: 'raster',
          tiles: [
            'https://dgrn.mgap.gub.uy/arcgis/rest/services/CONEAT/SuelosConeat/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&dpi=96&format=png32&transparent=true&layers=show:1&f=image'
          ],
          tileSize: 256,
        })

        mapInstance.addLayer({
          id: coneatLayerId,
          type: 'raster',
          source: coneatSourceId,
          paint: { 'raster-opacity': 0.7 },
        })
      } else {
        mapInstance.setLayoutProperty(coneatLayerId, 'visibility', 'visible')
      }
    } else {
      if (mapInstance.getLayer(coneatLayerId)) {
        mapInstance.setLayoutProperty(coneatLayerId, 'visibility', 'none')
      }
    }
  }, [mostrarConeat, mapLoaded])

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = document.getElementById('map-container-gl')
    if (!container) return

    const activarFullscreen = () => {
      setIsFullscreen(true)
      setTimeout(() => map.current?.resize(), 300)
    }

    const desactivarFullscreen = () => {
      setIsFullscreen(false)
      container.classList.remove('mobile-fullscreen')
      setTimeout(() => map.current?.resize(), 300)
    }

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen()
          .then(() => activarFullscreen())
          .catch(() => {
            // Fallback CSS para iOS Safari
            container.classList.add('mobile-fullscreen')
            activarFullscreen()
          })
      } else {
        // Fallback CSS para iOS Safari
        container.classList.add('mobile-fullscreen')
        activarFullscreen()
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen()
          .then(() => desactivarFullscreen())
          .catch(() => desactivarFullscreen())
      } else {
        desactivarFullscreen()
      }
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const container = document.getElementById('map-container-gl')
      const isNowFullscreen = !!document.fullscreenElement || !!container?.classList.contains('mobile-fullscreen')
      setIsFullscreen(isNowFullscreen)
      setTimeout(() => map.current?.resize(), 200)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Ubicar usuario
  const ubicarUsuario = () => {
    if (!map.current) return
    setUbicandoUsuario(true)

    if (!navigator.geolocation) {
      toast.info('Tu navegador no soporta geolocalización')
      setUbicandoUsuario(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords

        // Limpiar marcadores anteriores
        locationMarkersRef.current.forEach(m => m.remove())
        locationMarkersRef.current = []

        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 17 })

          // Marcador de ubicación
          const el = document.createElement('div')
          el.innerHTML = `
            <div style="
              width: 20px;
              height: 20px;
              background: #4285f4;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            "></div>
          `
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current)
          locationMarkersRef.current.push(marker)
        }

        setUbicandoUsuario(false)
      },
      (error) => {
        console.error('Error de geolocalización:', error)
        toast.error('No se pudo obtener tu ubicación')
        setUbicandoUsuario(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  // Buscar ubicación
  const buscarUbicacion = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)

    try {
      const queryLimpio = searchQuery.trim().replace(/\bkm\.?\s*[\d.,]+/gi, '').trim()
      const r = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(queryLimpio)}&bbox=-58.5,-35.0,-53.0,-30.0&limit=5`
      )
      const data = await r.json()
      let resultados = (data.features || []).map((f: any) => ({
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        display_name: [f.properties.name, f.properties.city, f.properties.state].filter(Boolean).join(', '),
      }))

      if (resultados.length === 0) {
        const r2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryLimpio)}&countrycodes=uy&limit=5`
        )
        resultados = await r2.json()
      }

      setSearchResults(resultados)
    } catch (error) {
      console.error('Error buscando ubicación:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Confirmar polígono dibujado
  const confirmarPoligono = () => {
    if (!drawnPolygon || !areaHectareas) {
      toast.info('Dibujá el potrero primero')
      return
    }
    if (onPolygonComplete) {
      onPolygonComplete(drawnPolygon, areaHectareas)
    }
  }

  // Toggle medición
  const toggleMedicion = () => {
    setMidiendo(!midiendo)
    setPuntosMedicion([])

    // Limpiar marcadores de medición
    measureMarkersRef.current.forEach(m => m.remove())
    measureMarkersRef.current = []

    // Limpiar líneas de medición
    if (map.current) {
      if (map.current.getLayer('measure-line')) {
        map.current.removeLayer('measure-line')
      }
      if (map.current.getSource('measure-line')) {
        map.current.removeSource('measure-line')
      }
      if (map.current.getLayer('measure-fill')) {
        map.current.removeLayer('measure-fill')
      }
      if (map.current.getSource('measure-fill')) {
        map.current.removeSource('measure-fill')
      }
    }
  }

  // Manejar clicks para medición
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!midiendo) return

      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat]

      // Verificar si es cierre del polígono
      const primerPunto = puntosMedicion[0]
      let esCierre = false
      if (primerPunto && puntosMedicion.length >= 3) {
        const distancia = turf.distance(
          turf.point(newPoint),
          turf.point(primerPunto),
          { units: 'meters' }
        )
        esCierre = distancia < 30
      }

      const newPuntos = esCierre ? [...puntosMedicion, primerPunto] : [...puntosMedicion, newPoint]
      setPuntosMedicion(newPuntos)

      // Agregar marcador del punto
      if (!esCierre) {
        const el = document.createElement('div')
        el.innerHTML = `
          <div style="
            width: 10px;
            height: 10px;
            background: white;
            border: 2px solid #3b82f6;
            border-radius: 50%;
          "></div>
        `
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(newPoint)
          .addTo(map.current!)
        measureMarkersRef.current.push(marker)
      }

      // Dibujar línea
      if (newPuntos.length > 1 && map.current) {
        const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: newPuntos,
          },
        }

        if (map.current.getSource('measure-line')) {
          (map.current.getSource('measure-line') as maplibregl.GeoJSONSource).setData(lineData)
        } else {
          map.current.addSource('measure-line', { type: 'geojson', data: lineData })
          map.current.addLayer({
            id: 'measure-line',
            type: 'line',
            source: 'measure-line',
            paint: {
              'line-color': '#3b82f6',
              'line-width': 3,
            },
          })
        }

        // Mostrar distancias
        for (let i = 0; i < newPuntos.length - 1; i++) {
          const p1 = newPuntos[i]
          const p2 = newPuntos[i + 1]
          const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' })
          const midPoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]

          const distText = dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`

          const el = document.createElement('div')
          el.innerHTML = `
            <span style="
              background: #3b82f6;
              color: white;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">${distText}</span>
          `
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(midPoint)
            .addTo(map.current!)
          measureMarkersRef.current.push(marker)
        }

        // Si es polígono cerrado, mostrar área
        if (esCierre && newPuntos.length >= 4) {
          const polygon = turf.polygon([newPuntos])
          const area = turf.area(polygon)
          const areaHa = area / 10000
          const centroid = turf.centroid(polygon)

          const areaText = areaHa >= 0.01 ? `${areaHa.toFixed(2)} ha` : `${Math.round(area)} m²`

          const el = document.createElement('div')
          el.innerHTML = `
            <span style="
              background: #3b82f6;
              color: white;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">📐 ${areaText}</span>
          `
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(centroid.geometry.coordinates as [number, number])
            .addTo(map.current!)
          measureMarkersRef.current.push(marker)

          // Dibujar relleno
          if (map.current.getSource('measure-fill')) {
            (map.current.getSource('measure-fill') as maplibregl.GeoJSONSource).setData(polygon)
          } else {
            map.current.addSource('measure-fill', { type: 'geojson', data: polygon })
            map.current.addLayer({
              id: 'measure-fill',
              type: 'fill',
              source: 'measure-fill',
              paint: {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.1,
              },
            }, 'measure-line')
          }

          setTimeout(() => setMidiendo(false), 100)
        }
      }
    }

    if (midiendo) {
      map.current.on('click', handleClick)
      map.current.getCanvas().style.cursor = 'crosshair'
    } else {
      map.current.getCanvas().style.cursor = ''
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleClick)
        map.current.getCanvas().style.cursor = ''
      }
    }
  }, [midiendo, puntosMedicion, mapLoaded])

  // Renderizar polígonos (sin depender de showNDVI para evitar re-renders)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current

    // Limpiar marcadores anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Limpiar capas de polígonos anteriores (NO las NDVI, esas se manejan aparte)
    existingPolygons.forEach((potrero) => {
      const fillId = `fill-${potrero.id}`
      const lineId = `line-${potrero.id}`

      if (mapInstance.getLayer(fillId)) mapInstance.removeLayer(fillId)
      if (mapInstance.getLayer(lineId)) mapInstance.removeLayer(lineId)
      if (mapInstance.getSource(potrero.id)) mapInstance.removeSource(potrero.id)
    })

    // Agregar polígonos
    existingPolygons.forEach((potrero) => {
      if (!potrero.coordinates || potrero.coordinates.length < 3) return

      const coords = potrero.coordinates
      const closedCoords =
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1]
          ? coords
          : [...coords, coords[0]]

      mapInstance.addSource(potrero.id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { nombre: potrero.nombre, hectareas: potrero.info?.hectareas },
          geometry: { type: 'Polygon', coordinates: [closedCoords] },
        },
      })

      // NDVI image - crear solo si no existe ya
      const ndviData = potrero.info?.ndviMatriz
      const ndviSrc = ndviData?.imagenUrl || ndviData?.imagenBase64
      const ndviLayerId = `ndvi-${potrero.id}`

      // Solo crear si tiene datos y NO existe ya la capa
      if (ndviSrc && ndviData?.bbox && !mapInstance.getSource(ndviLayerId)) {
        try {
          const [west, south, east, north] = ndviData.bbox

          if (isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
            mapInstance.addSource(ndviLayerId, {
              type: 'image',
              url: ndviSrc,
              coordinates: [
                [west, north],
                [east, north],
                [east, south],
                [west, south],
              ],
            })

            mapInstance.addLayer({
              id: ndviLayerId,
              type: 'raster',
              source: ndviLayerId,
              paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 },
            })

            ndviLayersRef.current.push(ndviLayerId)
          }
        } catch (ndviError) {
          console.error(`❌ Error cargando NDVI para ${potrero.id}:`, ndviError)
        }
      }

      // 🏔️ Altimetría: Ahora usamos hillshade global de Mapbox (mejor calidad)
      // Las capas por potrero están desactivadas

      // Fill layer
      const fillColor = potrero.color || '#3388ff'
      const fillOpacity = 0

      mapInstance.addLayer({
        id: `fill-${potrero.id}`,
        type: 'fill',
        source: potrero.id,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': fillOpacity,
        },
      })

      // Line layer
      mapInstance.addLayer({
        id: `line-${potrero.id}`,
        type: 'line',
        source: potrero.id,
        paint: {
          'line-color': showNDVI ? '#ffffff' : fillColor,
          'line-width': 2,
          'line-opacity': potrero.isDimmed ? 0.3 : 0.9,
        },
      })

    })

    // 🏷️ LABELS INTELIGENTES CON DETECCIÓN DE COLISIONES
    // Crear GeoJSON con todos los labels
    const labelFeatures: GeoJSON.Feature[] = existingPolygons
      .filter(p => p.coordinates && p.coordinates.length >= 3)
      .map(potrero => {
        const coords = potrero.coordinates
        const closedCoords = coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]
          ? coords : [...coords, coords[0]]

        const centerLng = closedCoords.reduce((s, c) => s + c[0], 0) / closedCoords.length
        const centerLat = closedCoords.reduce((s, c) => s + c[1], 0) / closedCoords.length

        // Calcular área para priorizar labels de potreros más grandes
        const hectareas = potrero.info?.hectareas || 0

        // Texto de animales
        let animalesText = ''
        if (potrero.info?.animales?.length) {
          animalesText = potrero.info.animales
            .map((a: any) => `${a.categoria}: ${a.cantidad}`)
            .join('\n')
        }

        return {
          type: 'Feature' as const,
          properties: {
            nombre: potrero.nombre,
            nombreConHectareas: `${potrero.nombre} (${hectareas.toFixed(0)}ha)`,
            animales: animalesText,
            hectareas,
            isDimmed: potrero.isDimmed || false,
            // Prioridad: potreros más grandes tienen prioridad (se muestran primero)
            priority: Math.round(hectareas * 10),
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [centerLng, centerLat],
          },
        }
      })

    // Limpiar fuente y capas de labels anteriores
    if (mapInstance.getLayer('potrero-labels-animales')) {
      mapInstance.removeLayer('potrero-labels-animales')
    }
    if (mapInstance.getLayer('potrero-labels-nombre')) {
      mapInstance.removeLayer('potrero-labels-nombre')
    }
    if (mapInstance.getSource('potrero-labels')) {
      mapInstance.removeSource('potrero-labels')
    }

    // Agregar fuente de labels
    mapInstance.addSource('potrero-labels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: labelFeatures,
      },
    })

    // Capa de NOMBRES - con hectáreas, tamaño adaptativo
    mapInstance.addLayer({
      id: 'potrero-labels-nombre',
      type: 'symbol',
      source: 'potrero-labels',
      layout: {
        'text-field': ['get', 'nombreConHectareas'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        // Tamaño adaptativo al zoom (más grande)
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          10, 11,  // Zoom 10: 11px (más grande)
          12, 13,  // Zoom 12: 13px
          14, 16,  // Zoom 14: 16px
          16, 20,  // Zoom 16: 20px
        ],
        'text-anchor': 'center',
        'text-offset': [0, 0],
        // Permitir superposición para que siempre se vean
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'visibility': mostrarNombres ? 'visible' : 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2,
        'text-halo-blur': 1,
        'text-opacity': [
          'case',
          ['get', 'isDimmed'], 0.3,
          1
        ],
      },
    })

    // Capa de ANIMALES - visible desde zoom 12, tamaño progresivo
    mapInstance.addLayer({
      id: 'potrero-labels-animales',
      type: 'symbol',
      source: 'potrero-labels',
      filter: ['!=', ['get', 'animales'], ''],
      layout: {
        'text-field': ['get', 'animales'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          11, 0,    // Zoom < 11: oculto
          12, 10,   // Zoom 12: 10px (más grande)
          14, 13,   // Zoom 14: 13px
          16, 16,   // Zoom 16: 16px
        ],
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'visibility': mostrarAnimales ? 'visible' : 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          11, 0,
          12, ['case', ['get', 'isDimmed'], 0.2, 0.7],
          14, ['case', ['get', 'isDimmed'], 0.3, 1],
        ],
      },
    })
  }, [mapLoaded, existingPolygons])

  // 🏷️ Controlar visibilidad de labels de nombres y animales
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current

    // Actualizar visibilidad de nombres
    if (mapInstance.getLayer('potrero-labels-nombre')) {
      mapInstance.setLayoutProperty(
        'potrero-labels-nombre',
        'visibility',
        mostrarNombres ? 'visible' : 'none'
      )
    }

    // Actualizar visibilidad de animales
    if (mapInstance.getLayer('potrero-labels-animales')) {
      mapInstance.setLayoutProperty(
        'potrero-labels-animales',
        'visibility',
        mostrarAnimales ? 'visible' : 'none'
      )
    }
  }, [mapLoaded, mostrarNombres, mostrarAnimales])

  // 👁️ Toggle visibilidad NDVI (sin recrear capas)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current

    // Solo cambiar visibilidad de capas NDVI existentes
    ndviLayersRef.current.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(
          layerId,
          'visibility',
          showNDVI ? 'visible' : 'none'
        )
      }
    })
  }, [mapLoaded, showNDVI])

  // 🏔️ Toggle visibilidad Altimetría (capas propias desactivadas, usamos Mapbox hillshade)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const mapInstance = map.current

    // Ocultar siempre las capas de altimetría propias (baja calidad)
    // Ahora usamos el hillshade global de Mapbox que es mejor
    altimetriaLayersRef.current.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, 'visibility', 'none')
      }
    })
  }, [mapLoaded, showAltimetria, subVistaAltimetria])

  return (
    <div id="map-container-gl" className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Botón pantalla completa - Solo en modo lectura */}
      {readOnly && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 left-3 z-10 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition border-2 border-gray-300"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      )}

      {/* Toggle Satélite/Mapa - Solo en modo lectura */}
      {readOnly && (
        <div className="absolute top-14 left-3 z-10 bg-white rounded-lg shadow-lg border-2 border-gray-300 flex flex-col overflow-hidden">
          <button
            onClick={() => setBaseLayer('satellite')}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              baseLayer === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🛰️ Satélite
          </button>
          <button
            onClick={() => setBaseLayer('streets')}
            className={`px-3 py-1.5 text-xs font-medium transition border-t border-gray-200 ${
              baseLayer === 'streets' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🗺️ Mapa
          </button>
        </div>
      )}

      {/* Botón ubicación - Debajo del control de zoom */}
      <button
        onClick={ubicarUsuario}
        disabled={ubicandoUsuario}
        className="absolute top-[110px] right-[10px] z-10 bg-white rounded-lg shadow-lg hover:shadow-xl transition w-[34px] h-[34px] flex items-center justify-center disabled:opacity-50 border-2 border-gray-300"
        title="Mi ubicación"
      >
        {ubicandoUsuario ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        )}
      </button>

      {/* Botón medición - Solo en readOnly */}
      {readOnly && (
        <button
          onClick={toggleMedicion}
          className={`absolute z-10 rounded-lg shadow-lg transition w-[34px] h-[34px] flex items-center justify-center border-2 text-lg ${
            midiendo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'
          } ${isFullscreen ? 'top-[124px] left-3' : 'bottom-4 left-3'}`}
          title={midiendo ? 'Terminar medición' : 'Medir distancia'}
        >
          📏
        </button>
      )}

      {/* 🔍 Buscador - Solo si no es readOnly Y no hay lotes existentes (primer potrero) */}
      {!readOnly && existingPolygons.length === 0 && (
        <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-16 sm:right-auto z-10 sm:w-80">
          <div className="bg-white rounded-lg shadow-lg p-2 sm:p-3">
            <div className="flex gap-1.5 sm:gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarUbicacion()}
                placeholder="Buscar ubicación..."
                className="flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-sm min-w-0"
              />
              <button onClick={buscarUbicacion} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg text-sm shrink-0">
                {searching ? '⏳' : '🔍'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-36 sm:max-h-48 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (map.current) {
                        map.current.flyTo({ center: [parseFloat(r.lon), parseFloat(r.lat)], zoom: 16 })
                      }
                      setSearchResults([])
                    }}
                    className="w-full text-left px-2.5 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-100 rounded text-xs sm:text-sm border-b"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📐 Área calculada (cuando se dibuja un polígono) */}
      {!readOnly && areaHectareas !== null && (
        <div className="absolute bottom-16 sm:bottom-auto sm:top-4 right-2 sm:right-4 z-10 bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-lg">
          <div className="text-xs sm:text-sm">Área:</div>
          <div className="text-base sm:text-xl font-bold">{areaHectareas.toFixed(2)} ha</div>
        </div>
      )}

      {/* ✅ Botón confirmar potrero */}
      {!readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col sm:flex-row gap-3">
          <button
            onClick={confirmarPoligono}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-green-700 transition font-medium"
          >
            Confirmar Potrero
          </button>
        </div>
      )}

      {/* Control de opacidad curvas (solo en fullscreen) */}
      {isFullscreen && mostrarCurvasNivel && (
        <div className="hidden sm:block absolute top-[160px] right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-800">Opacidad Curvas</label>
            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">{opacidadCurvas}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={opacidadCurvas}
            onChange={(e) => onOpacidadCurvasChange?.(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            style={{ background: `linear-gradient(to right, #d97706 0%, #d97706 ${opacidadCurvas}%, #e5e7eb ${opacidadCurvas}%, #e5e7eb 100%)` }}
          />
        </div>
      )}

      {/* Control de visibilidad de labels (en fullscreen - móvil y desktop) */}
      {isFullscreen && readOnly && (
        <div className="absolute bottom-24 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2.5 sm:p-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 uppercase tracking-wide">Vista</span>

            {/* Toggle Nombres */}
            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={mostrarNombres}
                onChange={(e) => onMostrarNombresChange?.(e.target.checked)}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-gray-700 select-none group-hover:text-gray-900 transition">
                Nombres
              </span>
            </label>

            {/* Toggle Animales */}
            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={mostrarAnimales}
                onChange={(e) => onMostrarAnimalesChange?.(e.target.checked)}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-gray-700 select-none group-hover:text-gray-900 transition">
                Animales
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Leyenda de módulos (solo en fullscreen y vista general) */}
      {isFullscreen && mostrarLeyendaModulos && modulosLeyenda.length > 0 && (
        <>
          <button
            onClick={() => setLeyendaExpandida(!leyendaExpandida)}
            className="sm:hidden absolute top-3 right-24 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-1.5 text-xs font-semibold text-gray-800"
          >
            📦 Módulos
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${leyendaExpandida ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {leyendaExpandida && (
            <div className="sm:hidden absolute top-14 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-3 max-w-[280px] max-h-[65vh] overflow-y-auto">
              <div className="space-y-1.5">
                {modulosLeyenda.map((modulo) => (
                  <div key={modulo.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: `${modulo.color}15` }}>
                    <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: modulo.color }} />
                    <span className="text-xs font-medium text-gray-900 truncate">{modulo.nombre}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">{modulo.hectareas.toFixed(0)} ha</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hidden sm:block absolute top-[160px] right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[320px]">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>📦</span> Módulos de Pastoreo
            </h3>
            <div className="space-y-3">
              {modulosLeyenda.map((modulo) => (
                <div key={modulo.id} className="p-3 rounded-lg" style={{ backgroundColor: `${modulo.color}15` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: modulo.color }} />
                    <span className="font-semibold text-gray-900 text-sm">{modulo.nombre}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
                      {modulo.cantidadPotreros} potrero{modulo.cantidadPotreros !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">{modulo.hectareas.toFixed(0)} ha</span>
                    {modulo.totalAnimales && modulo.totalAnimales > 0 && (
                      <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">{modulo.totalAnimales} animales</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Leyenda de cultivos (solo en fullscreen) */}
      {isFullscreen && mostrarResumenCultivos && resumenCultivos.length > 0 && (
        <>
          <button
            onClick={() => setLeyendaExpandida(!leyendaExpandida)}
            className="sm:hidden absolute top-3 right-24 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-1.5 text-xs font-semibold text-gray-800"
          >
            🌾 Cultivos
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${leyendaExpandida ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Panel expandido móvil */}
          {leyendaExpandida && (
            <div className="sm:hidden absolute top-14 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-3 max-w-[280px] max-h-[65vh] overflow-y-auto">
              {!cultivoSeleccionado && (
                <p className="text-[10px] text-gray-500 mb-2 text-center">Elegí un cultivo para destacarlo en el mapa</p>
              )}
              <div className="space-y-1.5">
                {resumenCultivos
                  .filter((cultivo) => !cultivoSeleccionado || cultivoSeleccionado === cultivo.tipo)
                  .map((cultivo, idx) => (
                  <button
                    key={idx}
                    onClick={() => onCultivoClick?.(cultivoSeleccionado === cultivo.tipo ? null : cultivo.tipo)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition ${
                      cultivoSeleccionado === cultivo.tipo ? 'ring-2 ring-blue-400 shadow-md' : ''
                    }`}
                    style={{ backgroundColor: `${cultivo.color}20` }}
                  >
                    <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: cultivo.color }} />
                    <span className="text-xs font-medium text-gray-900 truncate">{cultivo.tipo}</span>
                    <span className="text-[10px] text-gray-500 ml-auto flex-shrink-0">{cultivo.hectareas.toFixed(1)} ha</span>
                  </button>
                ))}
              </div>
              {cultivoSeleccionado && (
                <button
                  onClick={() => onCultivoClick?.(null)}
                  className="mt-2 w-full text-[10px] bg-red-100 text-red-700 px-2 py-1.5 rounded-full hover:bg-red-200 transition"
                >
                  ✕ Limpiar filtro
                </button>
              )}
            </div>
          )}

          <div className="hidden sm:block absolute top-[160px] right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[360px] max-h-[calc(100vh-140px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>🌾</span> Cultivos por potrero
              </h3>
              {cultivoSeleccionado && (
                <button onClick={() => onCultivoClick?.(null)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full hover:bg-red-200 transition">
                  ✕ Limpiar
                </button>
              )}
            </div>
            <div className="space-y-2">
              {resumenCultivos.map((cultivo, idx) => (
                <button
                  key={idx}
                  onClick={() => onCultivoClick?.(cultivoSeleccionado === cultivo.tipo ? null : cultivo.tipo)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer hover:scale-[1.02] ${
                    cultivoSeleccionado === cultivo.tipo ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `${cultivo.color}25` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: cultivo.color }} />
                      <span className="font-semibold text-gray-900 text-sm">{cultivo.tipo}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-700 bg-white/80 px-2 py-1 rounded-full">{cultivo.hectareas.toFixed(1)} ha</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Indicador de carga */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Cargando mapa...</div>
        </div>
      )}

      {/* Estilo para fullscreen móvil y controles de dibujo */}
      <style jsx global>{`
        #map-container-gl.mobile-fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 99999 !important;
          background: #000 !important;
        }

        /* Posicionar controles de dibujo */
        .mapboxgl-ctrl-top-left {
          top: 10px !important;
          left: 10px !important;
        }

        /* Estilo de botones de dibujo */
        .mapbox-gl-draw_ctrl-draw-btn {
          width: 34px !important;
          height: 34px !important;
          border-radius: 8px !important;
          background-color: white !important;
          border: 2px solid #d1d5db !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
        }

        .mapbox-gl-draw_ctrl-draw-btn:hover {
          background-color: #f3f4f6 !important;
        }

        .mapbox-gl-draw_ctrl-draw-btn.active {
          background-color: #3b82f6 !important;
          border-color: #2563eb !important;
        }

        .mapboxgl-ctrl-group {
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 8px !important;
        }

        .mapboxgl-ctrl-group button {
          width: 34px !important;
          height: 34px !important;
          border-radius: 8px !important;
          margin-bottom: 4px !important;
        }
      `}</style>
    </div>
  )
}
