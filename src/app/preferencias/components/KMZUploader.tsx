'use client'

import { useState, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import * as turf from '@turf/turf'
import dynamic from 'next/dynamic'

// Importar mapa dinámicamente para evitar SSR issues
const MapaPreview = dynamic(() => import('./MapaPreviewKMZ'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Cargando mapa...</span>
    </div>
  )
})

type LotePreview = {
  nombre: string
  hectareas: number
  poligono: number[][]
  incluir: boolean // 🆕 Para trackear si el usuario quiere incluirlo
}

type Paso = 'upload' | 'resumen' | 'revision' | 'completado'

export default function KMZUploader({ 
  onComplete,
  potrerosExistentes = []
}: { 
  onComplete: () => void
  potrerosExistentes?: Array<{ nombre: string; poligono: number[][] }>
}) {
  const [uploading, setUploading] = useState(false)
  const [previews, setPreviews] = useState<LotePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [paso, setPaso] = useState<Paso>('upload')
  const [indiceActual, setIndiceActual] = useState(0)
  const [nombreEditado, setNombreEditado] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Potrero actual en revisión
  const potreroActual = previews[indiceActual]
  
  // Contar cuántos se van a incluir
  const potrerosAIncluir = previews.filter(p => p.incluir)
  
  // Detectar si el nombre ya existe
  const nombreYaExiste = useMemo(() => {
    if (!potreroActual) return false
    const nombreBuscar = nombreEditado.toLowerCase().trim()
    return potrerosExistentes.some(p => 
      p.nombre.toLowerCase().trim() === nombreBuscar
    )
  }, [nombreEditado, potrerosExistentes, potreroActual])

  // Actualizar nombre editado cuando cambia el potrero actual
  useEffect(() => {
    if (potreroActual) {
      setNombreEditado(potreroActual.nombre)
    }
  }, [indiceActual, potreroActual])

  // Manejar fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      
      // Forzar redimensionamiento del mapa después del cambio
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 100)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    const container = document.getElementById('revision-container')
    if (!container) return
    
    if (!document.fullscreenElement) {
      container.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  async function parseKMZ(file: File): Promise<LotePreview[]> {
    try {
      let kmlContent = ''

      if (file.name.endsWith('.kml')) {
        kmlContent = await file.text()
      } else {
        const zip = await JSZip.loadAsync(file)
        for (const filename in zip.files) {
          if (filename.endsWith('.kml')) {
            kmlContent = await zip.files[filename].async('text')
            break
          }
        }
      }

      if (!kmlContent) {
        throw new Error('No se encontró archivo KML dentro del KMZ')
      }

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(kmlContent, 'text/xml')

      const parseError = xmlDoc.querySelector('parsererror')
      if (parseError) {
        throw new Error('Error al parsear el archivo KML')
      }

      const placemarks = xmlDoc.getElementsByTagName('Placemark')
      const lotes: LotePreview[] = []

      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i]
        
        const nameElement = placemark.getElementsByTagName('name')[0]
        const nombre = nameElement?.textContent?.trim() || `Potrero ${i + 1}`

        let coordinatesElement = placemark.getElementsByTagName('coordinates')[0]
        
        if (!coordinatesElement) {
          const polygon = placemark.getElementsByTagName('Polygon')[0]
          if (polygon) {
            coordinatesElement = polygon.getElementsByTagName('coordinates')[0]
          }
        }

        if (!coordinatesElement) continue

        const coordsText = coordinatesElement.textContent?.trim()
        if (!coordsText) continue

        const coords = coordsText
          .trim()
          .split(/[\s\n\r]+/)
          .map(coord => coord.trim())
          .filter(coord => coord.length > 0)
          .map(coord => {
            const parts = coord.split(',').map(s => parseFloat(s.trim()))
            const [lng, lat] = parts
            return [lng, lat]
          })
          .filter(coord => {
            const [lng, lat] = coord
            return !isNaN(lng) && !isNaN(lat) && 
                   lng >= -180 && lng <= 180 && 
                   lat >= -90 && lat <= 90
          })

        if (coords.length < 3) continue

        const firstCoord = coords[0]
        const lastCoord = coords[coords.length - 1]
        const tolerance = 0.0000001
        
        if (Math.abs(firstCoord[0] - lastCoord[0]) > tolerance || 
            Math.abs(firstCoord[1] - lastCoord[1]) > tolerance) {
          coords.push([firstCoord[0], firstCoord[1]])
        }

        try {
          const polygon = turf.polygon([coords])
          const areaM2 = turf.area(polygon)
          const hectareas = parseFloat((areaM2 / 10000).toFixed(2))

          lotes.push({
            nombre,
            hectareas,
            poligono: coords,
            incluir: true // Por defecto incluir
          })
        } catch (turfError) {
          lotes.push({
            nombre,
            hectareas: 0,
            poligono: coords,
            incluir: true
          })
        }
      }

      return lotes
    } catch (err) {
      console.error('Error parseando KMZ:', err)
      throw new Error(`Error al procesar el archivo: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isKMZ = file.name.endsWith('.kmz')
    const isKML = file.name.endsWith('.kml')

    if (!isKMZ && !isKML) {
      setError('Por favor selecciona un archivo .kmz o .kml')
      return
    }

    setUploading(true)
    setError(null)
    setPreviews([])

    try {
      const lotes = await parseKMZ(file)
      
      if (lotes.length === 0) {
        setError('No se encontraron potreros en el archivo.')
        return
      }

      setPreviews(lotes)
      setPaso('resumen')
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo')
    } finally {
      setUploading(false)
    }
  }

  function iniciarRevision() {
    setIndiceActual(0)
    setPaso('revision')
  }

  function agregarPotrero() {
    // Actualizar nombre si fue editado
    const nuevasPreviews = [...previews]
    nuevasPreviews[indiceActual] = {
      ...nuevasPreviews[indiceActual],
      nombre: nombreEditado,
      incluir: true
    }
    setPreviews(nuevasPreviews)
    avanzar()
  }

  function noIncluirPotrero() {
    const nuevasPreviews = [...previews]
    nuevasPreviews[indiceActual] = {
      ...nuevasPreviews[indiceActual],
      incluir: false
    }
    setPreviews(nuevasPreviews)
    avanzar()
  }

  function avanzar() {
    if (indiceActual < previews.length - 1) {
      setIndiceActual(indiceActual + 1)
    } else {
      // Salir de fullscreen si está activo
      if (document.fullscreenElement) {
        document.exitFullscreen()
      }
      setPaso('completado')
    }
  }

  async function handleConfirm() {
    setUploading(true)
    setError(null)

    const potrerosParaCrear = previews.filter(p => p.incluir)

    try {
      for (const lote of potrerosParaCrear) {
        const response = await fetch('/api/lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: lote.nombre,
            hectareas: lote.hectareas,
            poligono: lote.poligono,
            cultivos: [],
            animales: [],
            esPastoreable: true
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al crear potrero')
        }
      }

      alert(`✅ Se crearon ${potrerosParaCrear.length} potreros exitosamente`)
      setPreviews([])
      setPaso('upload')
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Error al guardar los potreros')
    } finally {
      setUploading(false)
    }
  }

  // ==================== RENDER ====================

  // PASO 1: Upload
  if (paso === 'upload') {
    return (
      <div className="space-y-6">
        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              ?
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-3">Instrucciones</h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Subí un archivo de Google Earth <strong>(formato .KMZ o .KML)</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>Cada potrero debe ser un polígono diferente.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>El nombre del potrero debe coincidir con el nombre del polígono.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Zona de carga */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition">
          <div className="text-5xl mb-4">☁️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Subir Archivo</h3>
          <p className="text-sm text-gray-500 mb-4">Hacé clic o arrastrá el archivo acá</p>
          
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept=".kmz,.kml"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-block">
              {uploading ? 'Procesando...' : 'Subir Archivo'}
            </span>
          </label>

          <p className="text-xs text-gray-400 mt-4">Permitidos: KMZ o KML</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // PASO 2: Resumen inicial
  if (paso === 'resumen') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-2">
          <span className="text-sm text-gray-500">KMZ Analizado</span>
        </div>

        {/* Mapa con todos los potreros */}
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <MapaPreview 
            poligonos={previews.map(p => ({
              coordinates: p.poligono,
              color: '#22c55e',
              nombre: p.nombre
            }))}
          />
        </div>

        {/* Badges de resumen */}
        <div className="flex gap-2 justify-center">
          <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium">
            {previews.length} Potreros Detectados
          </span>
        </div>

        {/* Botón para revisar */}
        <button
          onClick={iniciarRevision}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Revisar Los {previews.length} Potreros
        </button>
      </div>
    )
  }

  // PASO 3: Revisión uno por uno
  if (paso === 'revision' && potreroActual) {
    const potrerosRestantes = previews.length - indiceActual - 1

    return (
      <div 
        id="revision-container"
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'space-y-4'}`}
      >
        {/* Mapa */}
<div className={`${isFullscreen ? 'absolute inset-0 bottom-[280px]' : 'rounded-lg overflow-hidden border border-gray-200'}`}>
          <div className={`${isFullscreen ? 'hidden' : 'text-xs text-gray-500 px-3 py-1 bg-gray-50 border-b'}`}>
            POLÍGONO DEL POTRERO
          </div>
          <div className="h-full">
            <MapaPreview 
              poligonos={previews.map((p, idx) => ({
                coordinates: p.poligono,
                color: idx === indiceActual ? '#eab308' : '#22c55e',
                nombre: p.nombre,
                opacity: idx === indiceActual ? 0.8 : 0.5,
                weight: idx === indiceActual ? 3 : 1
              }))}
              resaltarIndice={indiceActual}
              mostrarVertices={true}
              editable={true}
              onPoligonoEditado={(nuevasCoords) => {
  // Recalcular hectáreas con las nuevas coordenadas
  let nuevasHectareas = previews[indiceActual].hectareas
  try {
    const polygon = turf.polygon([nuevasCoords])
    const areaM2 = turf.area(polygon)
    nuevasHectareas = parseFloat((areaM2 / 10000).toFixed(2))
  } catch (e) {
    console.error('Error recalculando área:', e)
  }
  
  const nuevasPreviews = [...previews]
  nuevasPreviews[indiceActual] = {
    ...nuevasPreviews[indiceActual],
    poligono: nuevasCoords,
    hectareas: nuevasHectareas
  }
  setPreviews(nuevasPreviews)
}}
            />
          </div>
        </div>

        {/* Panel de controles - flotante en fullscreen */}
        <div className={`
          ${isFullscreen 
            ? 'absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-2xl rounded-t-2xl p-4 space-y-3' 
            : 'space-y-3'
          }
        `}>
          {/* Header con contador y botón fullscreen */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">
              POTRERO {indiceActual + 1} DE {previews.length}
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>

          {/* Input nombre editable */}
          <div>
            <label className="text-xs text-gray-500">Nombre</label>
            <input
              type="text"
              value={nombreEditado}
              onChange={(e) => setNombreEditado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Info compacta */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              📐 {potreroActual.hectareas} hectáreas
            </div>
            
            {/* Advertencia si nombre ya existe */}
            {nombreYaExiste && (
              <span className="text-sm text-amber-600">
                ⚠️ Nombre duplicado
              </span>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="space-y-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${((indiceActual + 1) / previews.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              {potrerosRestantes} potrero{potrerosRestantes !== 1 ? 's' : ''} para revisar
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            {/* Botón atrás */}
            <button
              onClick={() => {
                if (indiceActual > 0) {
                  setIndiceActual(indiceActual - 1)
                }
              }}
              disabled={indiceActual === 0}
              className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Potrero anterior"
            >
              ←
            </button>
            
            <button
              onClick={noIncluirPotrero}
              className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              No Incluir
            </button>
            <button
              onClick={agregarPotrero}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              Agregar
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PASO 4: Completado - Resumen final
  if (paso === 'completado') {
    const incluidos = previews.filter(p => p.incluir)
    const excluidos = previews.filter(p => !p.incluir)

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-gray-900">Revisión Completada</h3>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Potreros a crear:</span>
            <span className="font-semibold text-green-600">{incluidos.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Potreros excluidos:</span>
            <span className="font-semibold text-gray-500">{excluidos.length}</span>
          </div>
        </div>

        {/* Lista de incluidos */}
        {incluidos.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-4 py-2 border-b border-gray-200">
              <span className="text-sm font-medium text-green-800">
                Potreros a crear ({incluidos.length})
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {incluidos.map((p, idx) => (
                <div key={idx} className="px-4 py-2 border-b border-gray-100 last:border-0 flex justify-between">
                  <span className="text-sm text-gray-900">{p.nombre}</span>
                  <span className="text-sm text-gray-500">{p.hectareas} ha</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              setPaso('upload')
              setPreviews([])
            }}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={uploading || incluidos.length === 0}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Creando...' : `Crear ${incluidos.length} Potreros`}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return null
}