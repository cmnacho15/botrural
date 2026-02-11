'use client'

import { useState, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import * as turf from '@turf/turf'
import dynamic from 'next/dynamic'
import { toast } from '@/app/components/Toast'

const MapaPreview = dynamic(() => import('./MapaPreviewKMZ'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Cargando mapa...</span>
    </div>
  )
})

type AnimalConfig = {
  id: string
  categoria: string
  cantidad: string
  peso?: string
}

type CultivoConfig = {
  id: string
  tipoCultivo: string
  fechaSiembra: string
  hectareas: string
}

type LotePreview = {
  nombre: string
  hectareas: number
  poligono: number[][]
  incluir: boolean
  // Configuración adicional
  esPastoreable: boolean
  animales: AnimalConfig[]
  cultivos: CultivoConfig[]
  moduloPastoreoId: string
  diasAjuste: string
}

type Paso = 'upload' | 'resumen' | 'revision' | 'completado' | 'configuracion'

// Función para normalizar texto (quitar tildes)
function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Capitalizar primera letra
function capitalizarPrimeraLetra(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
}

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

  // Para configuración
  const [indiceConfig, setIndiceConfig] = useState(0)
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<Array<{nombre: string, tipo: string}>>([])
  const [modulos, setModulos] = useState<Array<{id: string, nombre: string}>>([])
  const [cultivosDisponibles, setCultivosDisponibles] = useState<string[]>([])

  // Para selector de cultivo con búsqueda
  const [cultivoDropdownOpen, setCultivoDropdownOpen] = useState<string | null>(null)
  const [cultivoBusqueda, setCultivoBusqueda] = useState('')
  const [creandoCultivo, setCreandoCultivo] = useState(false)

  // Cargar categorías de animales
  useEffect(() => {
    fetch('/api/categorias-animal')
      .then((res) => res.json())
      .then((data) => {
        const activas = data
          .filter((c: any) => c.activo)
          .map((c: any) => ({
            nombre: c.nombreSingular,
            tipo: c.tipoAnimal
          }))
        setCategoriasDisponibles(activas)
      })
      .catch(() => console.error('Error cargando categorías'))
  }, [])

  // Cargar módulos de pastoreo
  useEffect(() => {
    fetch('/api/modulos-pastoreo')
      .then((res) => res.json())
      .then((data) => setModulos(data))
      .catch(() => console.error('Error cargando módulos'))
  }, [])

  // Cargar tipos de cultivo
  useEffect(() => {
    fetch('/api/tipos-cultivo')
      .then((res) => res.json())
      .then((data) => {
        const nombres = data.map((c: any) => c.nombre)
        setCultivosDisponibles(nombres)
      })
      .catch(() => console.error('Error cargando cultivos'))
  }, [])

  const potreroActual = previews[indiceActual]
  const potreroConfig = previews.filter(p => p.incluir)[indiceConfig]
  const potrerosAIncluir = previews.filter(p => p.incluir)

  const nombreYaExiste = useMemo(() => {
    if (!potreroActual) return false
    const nombreBuscar = nombreEditado.toLowerCase().trim()
    return potrerosExistentes.some(p =>
      p.nombre.toLowerCase().trim() === nombreBuscar
    )
  }, [nombreEditado, potrerosExistentes, potreroActual])

  useEffect(() => {
    if (potreroActual) {
      setNombreEditado(potreroActual.nombre)
    }
  }, [indiceActual, potreroActual])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
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
            incluir: true,
            esPastoreable: true,
            animales: [],
            cultivos: [],
            moduloPastoreoId: '',
            diasAjuste: ''
          })
        } catch (turfError) {
          lotes.push({
            nombre,
            hectareas: 0,
            poligono: coords,
            incluir: true,
            esPastoreable: true,
            animales: [],
            cultivos: [],
            moduloPastoreoId: '',
            diasAjuste: ''
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
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
          setPaso('completado')
        }).catch(() => {
          setPaso('completado')
        })
      } else {
        setPaso('completado')
      }
    }
  }

  // Funciones para configuración de animales
  function agregarAnimalConfig(potreroIndex: number) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.animales.push({
        id: Date.now().toString(),
        categoria: '',
        cantidad: '',
        peso: ''
      })
      setPreviews(nuevasPreviews)
    }
  }

  function eliminarAnimalConfig(potreroIndex: number, animalId: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.animales = potreroReal.animales.filter(a => a.id !== animalId)
      setPreviews(nuevasPreviews)
    }
  }

  function actualizarAnimalConfig(potreroIndex: number, animalId: string, campo: string, valor: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.animales = potreroReal.animales.map(a =>
        a.id === animalId ? { ...a, [campo]: valor } : a
      )
      setPreviews(nuevasPreviews)
    }
  }

  function togglePastoreable(potreroIndex: number) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.esPastoreable = !potreroReal.esPastoreable
      if (!potreroReal.esPastoreable) {
        potreroReal.animales = []
        potreroReal.moduloPastoreoId = ''
        potreroReal.diasAjuste = ''
      }
      setPreviews(nuevasPreviews)
    }
  }

  function actualizarModulo(potreroIndex: number, moduloId: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.moduloPastoreoId = moduloId
      setPreviews(nuevasPreviews)
    }
  }

  function actualizarDiasAjuste(potreroIndex: number, dias: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.diasAjuste = dias
      setPreviews(nuevasPreviews)
    }
  }

  // Funciones para cultivos
  function agregarCultivoConfig(potreroIndex: number) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.cultivos.push({
        id: Date.now().toString(),
        tipoCultivo: '',
        fechaSiembra: '',
        hectareas: ''
      })
      setPreviews(nuevasPreviews)
    }
  }

  function eliminarCultivoConfig(potreroIndex: number, cultivoId: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.cultivos = potreroReal.cultivos.filter(c => c.id !== cultivoId)
      setPreviews(nuevasPreviews)
    }
  }

  function actualizarCultivoConfig(potreroIndex: number, cultivoId: string, campo: string, valor: string) {
    const nuevasPreviews = [...previews]
    const potrerosIncluidos = nuevasPreviews.filter(p => p.incluir)
    const potreroReal = potrerosIncluidos[potreroIndex]

    if (potreroReal) {
      potreroReal.cultivos = potreroReal.cultivos.map(c =>
        c.id === cultivoId ? { ...c, [campo]: valor } : c
      )
      setPreviews(nuevasPreviews)
    }
  }

  // Crear nuevo tipo de cultivo
  async function crearNuevoCultivo(nombre: string, cultivoId: string) {
    if (!nombre.trim()) return
    const nombreCapitalizado = capitalizarPrimeraLetra(nombre.trim())
    setCreandoCultivo(true)
    try {
      const response = await fetch('/api/tipos-cultivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreCapitalizado }),
      })
      if (response.ok) {
        setCultivosDisponibles([...cultivosDisponibles, nombreCapitalizado])
        actualizarCultivoConfig(indiceConfig, cultivoId, 'tipoCultivo', nombreCapitalizado)
        setCultivoDropdownOpen(null)
        setCultivoBusqueda('')
        toast.success(`Cultivo "${nombreCapitalizado}" creado`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al crear cultivo')
      }
    } catch {
      toast.error('Error al crear cultivo')
    } finally {
      setCreandoCultivo(false)
    }
  }

  async function handleConfirm() {
    setUploading(true)
    setError(null)

    const potrerosParaCrear = previews.filter(p => p.incluir)

    try {
      for (const lote of potrerosParaCrear) {
        const animalesValidos = lote.animales.filter(a => a.categoria && a.cantidad)
        const tieneAnimales = animalesValidos.length > 0
        const cultivosValidos = lote.cultivos
          .filter(c => c.tipoCultivo)
          .map(c => ({
            tipoCultivo: c.tipoCultivo,
            fechaSiembra: c.fechaSiembra || null,
            hectareas: c.hectareas ? parseFloat(c.hectareas) : null
          }))

        const response = await fetch('/api/lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: lote.nombre,
            hectareas: lote.hectareas,
            poligono: lote.poligono,
            cultivos: cultivosValidos,
            animales: animalesValidos,
            esPastoreable: lote.esPastoreable,
            moduloPastoreoId: lote.moduloPastoreoId || null,
            diasPastoreoAjuste: tieneAnimales && lote.diasAjuste ? parseInt(lote.diasAjuste) : undefined,
            diasDescansoAjuste: !tieneAnimales && lote.diasAjuste ? parseInt(lote.diasAjuste) : undefined
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al crear potrero')
        }
      }

      toast.success(`✅ Se crearon ${potrerosParaCrear.length} potreros exitosamente`)
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

        <div className="rounded-lg overflow-hidden border border-gray-200">
          <MapaPreview
            poligonos={previews.map(p => ({
              coordinates: p.poligono,
              color: '#22c55e',
              nombre: p.nombre
            }))}
          />
        </div>

        <div className="flex gap-2 justify-center">
          <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium">
            {previews.length} Potreros Detectados
          </span>
        </div>

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

        <div className={`
          ${isFullscreen
            ? 'absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-2xl rounded-t-2xl p-4 space-y-3'
            : 'space-y-3'
          }
        `}>
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

          <div>
            <label className="text-xs text-gray-500">Nombre</label>
            <input
              type="text"
              value={nombreEditado}
              onChange={(e) => setNombreEditado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              📐 {potreroActual.hectareas} hectáreas
            </div>

            {nombreYaExiste && (
              <span className="text-sm text-amber-600">
                ⚠️ Nombre duplicado
              </span>
            )}
          </div>

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

          <div className="flex gap-2">
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

  // PASO 4: Completado - Opción de configurar o crear directo
  if (paso === 'completado') {
    const incluidos = previews.filter(p => p.incluir)
    const excluidos = previews.filter(p => !p.incluir)

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-gray-900">Revisión Completada</h3>
          <p className="text-sm text-gray-500 mt-1">
            {incluidos.length} potreros listos para crear
          </p>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Potreros a crear:</span>
            <span className="font-semibold text-green-600">{incluidos.length}</span>
          </div>
          {excluidos.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Potreros excluidos:</span>
              <span className="font-semibold text-gray-500">{excluidos.length}</span>
            </div>
          )}
        </div>

        {/* Opciones */}
        <div className="space-y-3">
          {/* Opción 1: Configurar animales y cultivos */}
          <button
            onClick={() => {
              setIndiceConfig(0)
              setPaso('configuracion')
            }}
            className="w-full p-4 border-2 border-green-200 bg-green-50 rounded-xl hover:border-green-400 transition text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🐄🌱</span>
              <div>
                <div className="font-semibold text-gray-900">Configurar Potreros</div>
                <div className="text-sm text-gray-600">
                  Asignar animales, cultivos y configurar cada potrero
                </div>
              </div>
              <span className="ml-auto text-green-600">→</span>
            </div>
          </button>

          {/* Opción 2: Crear directo */}
          <button
            onClick={handleConfirm}
            disabled={uploading || incluidos.length === 0}
            className="w-full p-4 border-2 border-gray-200 bg-white rounded-xl hover:border-blue-400 transition text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <div className="font-semibold text-gray-900">
                  {uploading ? 'Creando...' : 'Crear Todos Vacíos'}
                </div>
                <div className="text-sm text-gray-600">
                  Crear los {incluidos.length} potreros sin animales ni cultivos (podés agregar después)
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Lista de potreros */}
        {incluidos.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-4 py-2 border-b border-gray-200">
              <span className="text-sm font-medium text-green-800">
                Potreros a crear ({incluidos.length})
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              {incluidos.map((p, idx) => (
                <div key={idx} className="px-4 py-2 border-b border-gray-100 last:border-0 flex justify-between">
                  <span className="text-sm text-gray-900">{p.nombre}</span>
                  <span className="text-sm text-gray-500">{p.hectareas} ha</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setPaso('upload')
            setPreviews([])
          }}
          className="w-full py-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          ← Cancelar y empezar de nuevo
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // PASO 5: Configuración de cada potrero
  if (paso === 'configuracion' && potreroConfig) {
    const potrerosIncluidos = previews.filter(p => p.incluir)
    const totalConfig = potrerosIncluidos.length

    return (
      <div className="space-y-4">
        {/* Header fijo */}
        <div className="sticky top-0 z-10 bg-white pb-3 -mx-4 px-4 pt-1 border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{potreroConfig.nombre}</h3>
              <p className="text-sm text-gray-500">{potreroConfig.hectareas} ha</p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {indiceConfig + 1} / {totalConfig}
            </span>
          </div>
          {/* Barra de progreso */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((indiceConfig + 1) / totalConfig) * 100}%` }}
            />
          </div>
        </div>

        {/* 1. TIPO DE POTRERO - PRIMERO */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="font-medium text-gray-900 mb-3">Tipo de potrero</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (!potreroConfig.esPastoreable) togglePastoreable(indiceConfig)
              }}
              className={`p-3 rounded-lg border-2 text-left transition ${
                potreroConfig.esPastoreable
                  ? 'border-green-500 bg-green-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">🌾 Pastoreable</div>
              <div className="text-xs text-gray-600 mt-1">Para animales</div>
            </button>
            <button
              onClick={() => {
                if (potreroConfig.esPastoreable) togglePastoreable(indiceConfig)
              }}
              className={`p-3 rounded-lg border-2 text-left transition ${
                !potreroConfig.esPastoreable
                  ? 'border-amber-500 bg-amber-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">🔒 No pastoreable</div>
              <div className="text-xs text-gray-600 mt-1">Agrícola, casco u otro</div>
            </button>
          </div>
        </div>

        {/* 2. CULTIVOS */}
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">🌱 Cultivos</h4>

          {potreroConfig.cultivos.length === 0 && (
            <p className="text-sm text-gray-500 italic mb-3">
              Sin cultivos (podés agregar ahora o después)
            </p>
          )}

          <div className="space-y-2">
            {potreroConfig.cultivos.map((cultivo) => {
              const isOpen = cultivoDropdownOpen === cultivo.id
              const busqueda = isOpen ? cultivoBusqueda : ''
              const busquedaNorm = normalizarTexto(busqueda)
              const cultivosFiltrados = cultivosDisponibles.filter(c =>
                normalizarTexto(c).includes(busquedaNorm)
              )
              const noExiste = busqueda.trim() && !cultivosDisponibles.some(
                c => normalizarTexto(c) === busquedaNorm
              )

              return (
                <div key={cultivo.id} className="bg-white p-3 rounded-lg flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[140px]">
                    <input
                      type="text"
                      value={isOpen ? cultivoBusqueda : cultivo.tipoCultivo}
                      onChange={(e) => {
                        setCultivoBusqueda(e.target.value)
                        if (!isOpen) setCultivoDropdownOpen(cultivo.id)
                      }}
                      onFocus={() => {
                        setCultivoDropdownOpen(cultivo.id)
                        setCultivoBusqueda(cultivo.tipoCultivo)
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setCultivoDropdownOpen(null)
                          setCultivoBusqueda('')
                        }, 150)
                      }}
                      placeholder="Buscar cultivo..."
                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                    />
                    {isOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {cultivosFiltrados.map((nombre) => (
                          <button
                            key={nombre}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              actualizarCultivoConfig(indiceConfig, cultivo.id, 'tipoCultivo', nombre)
                              setCultivoDropdownOpen(null)
                              setCultivoBusqueda('')
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-green-50"
                          >
                            {nombre}
                          </button>
                        ))}
                        {noExiste && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              crearNuevoCultivo(busqueda, cultivo.id)
                            }}
                            disabled={creandoCultivo}
                            className="w-full text-left px-3 py-2 text-sm bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                          >
                            {creandoCultivo ? 'Creando...' : `+ Crear "${capitalizarPrimeraLetra(busqueda.trim())}"`}
                          </button>
                        )}
                        {cultivosFiltrados.length === 0 && !noExiste && (
                          <div className="px-3 py-2 text-sm text-gray-500 italic">Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={cultivo.hectareas}
                    onChange={(e) => actualizarCultivoConfig(indiceConfig, cultivo.id, 'hectareas', e.target.value)}
                    placeholder="Ha"
                    className="w-20 border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={cultivo.fechaSiembra}
                    onChange={(e) => actualizarCultivoConfig(indiceConfig, cultivo.id, 'fechaSiembra', e.target.value)}
                    className="w-32 border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                  <button
                    onClick={() => eliminarCultivoConfig(indiceConfig, cultivo.id)}
                    className="text-red-500 hover:text-red-700 px-2"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => agregarCultivoConfig(indiceConfig)}
            className="mt-3 text-green-600 text-sm hover:underline"
          >
            + Agregar cultivo
          </button>
        </div>

        {/* Animales - Solo si es pastoreable */}
        {potreroConfig.esPastoreable && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">🐄 Animales en este potrero</h4>

            {potreroConfig.animales.length === 0 && (
              <p className="text-sm text-gray-500 italic mb-3">
                Sin animales (podés agregar ahora o después)
              </p>
            )}

            <div className="space-y-2">
              {potreroConfig.animales.map((animal) => {
                const categoriasUsadas = potreroConfig.animales
                  .filter(a => a.id !== animal.id && a.categoria)
                  .map(a => a.categoria)

                return (
                  <div key={animal.id} className="bg-white p-3 rounded-lg flex flex-wrap gap-2 items-center">
                    <select
                      value={animal.categoria}
                      onChange={(e) => actualizarAnimalConfig(indiceConfig, animal.id, 'categoria', e.target.value)}
                      className="flex-1 min-w-[140px] border border-gray-300 rounded px-2 py-2 text-sm"
                    >
                      <option value="">Categoría</option>
                      {['BOVINO', 'OVINO', 'EQUINO', 'OTRO'].map(tipo => {
                        const categoriasTipo = categoriasDisponibles.filter(c => c.tipo === tipo)
                        if (categoriasTipo.length === 0) return null

                        const labels: Record<string, string> = {
                          BOVINO: '🐄 BOVINOS',
                          OVINO: '🐑 OVINOS',
                          EQUINO: '🐴 EQUINOS',
                          OTRO: '📦 OTROS'
                        }

                        return (
                          <optgroup key={tipo} label={labels[tipo]}>
                            {categoriasTipo.map((cat) => (
                              <option
                                key={cat.nombre}
                                value={cat.nombre}
                                disabled={categoriasUsadas.includes(cat.nombre)}
                              >
                                {cat.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )
                      })}
                    </select>
                    <input
                      type="number"
                      value={animal.cantidad}
                      onChange={(e) => actualizarAnimalConfig(indiceConfig, animal.id, 'cantidad', e.target.value)}
                      placeholder="Cant."
                      className="w-20 border border-gray-300 rounded px-2 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={animal.peso || ''}
                      onChange={(e) => actualizarAnimalConfig(indiceConfig, animal.id, 'peso', e.target.value)}
                      placeholder="Peso kg"
                      className="w-24 border border-gray-300 rounded px-2 py-2 text-sm"
                    />
                    <button
                      onClick={() => eliminarAnimalConfig(indiceConfig, animal.id)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      🗑️
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => agregarAnimalConfig(indiceConfig)}
              className="mt-3 text-blue-600 text-sm hover:underline"
            >
              + Agregar animales
            </button>
          </div>
        )}

        {/* Módulo de Pastoreo - Solo si es pastoreable */}
        {potreroConfig.esPastoreable && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">📦 Módulo de Pastoreo <span className="text-gray-500 text-sm font-normal">(opcional)</span></h4>
            <p className="text-xs text-gray-600 mb-3">
              Útil en pastoreo rotativo para agrupar potreros
            </p>
            <select
              value={potreroConfig.moduloPastoreoId}
              onChange={(e) => actualizarModulo(indiceConfig, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Sin módulo asignado</option>
              {modulos.map((mod) => (
                <option key={mod.id} value={mod.id}>{mod.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Días de ajuste - Solo si es pastoreable */}
        {potreroConfig.esPastoreable && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h4 className="font-medium text-gray-900 mb-2">
              📅 {potreroConfig.animales.some(a => a.categoria && a.cantidad) ? 'Días de Pastoreo' : 'Días de Descanso'}
              <span className="text-gray-500 text-sm font-normal ml-2">(opcional)</span>
            </h4>
            <p className="text-xs text-gray-600 mb-3">
              {potreroConfig.animales.some(a => a.categoria && a.cantidad)
                ? '¿Los animales ya estaban aquí? Indicá cuántos días atrás.'
                : 'Si ya estaba en descanso, indicá hace cuántos días comenzó.'
              }
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={potreroConfig.diasAjuste}
                onChange={(e) => actualizarDiasAjuste(indiceConfig, e.target.value)}
                min="0"
                placeholder="Ej: 15"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
              />
              <span className="text-sm text-gray-600">días atrás</span>
            </div>
          </div>
        )}

        {/* Navegación */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              if (indiceConfig > 0) {
                setIndiceConfig(indiceConfig - 1)
              } else {
                setPaso('completado')
              }
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-600 hover:bg-gray-50"
          >
            ←
          </button>

          {indiceConfig < totalConfig - 1 ? (
            <button
              onClick={() => setIndiceConfig(indiceConfig + 1)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              Siguiente Potrero →
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? 'Creando...' : `✓ Crear ${totalConfig} Potreros`}
            </button>
          )}
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
