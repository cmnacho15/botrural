'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Cargando mapa...</p>
    </div>
  ),
})

interface Cultivo {
  id: string
  tipoCultivo: string
  hectareas: number
  fechaSiembra: string
}

interface Animal {
  id: string
  categoria: string
  cantidad: number
}

interface Lote {
  id: string
  nombre: string
  hectareas: number
  coordenadas: number[][]
  cultivos: Cultivo[]
  animalesLote: Animal[]
}

// 🎨 Colores por tipo de cultivo
const COLORES_CULTIVOS: Record<string, string> = {
  'Soja': '#FFD700',
  'Maíz': '#FF69B4',
  'Trigo': '#F4A460',
  'Girasol': '#FFD700',
  'Sorgo': '#DEB887',
  'Cebada': '#D2691E',
  'Avena': '#F5DEB3',
  'Arroz': '#90EE90',
  'Alfalfa': '#32CD32',
  'Pradera': '#228B22',
}

export default function MapaPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo' | 'ndvi'>('indice')
  const [mapCenter, setMapCenter] = useState<[number, number]>([-32.5228, -55.7658])
  const [hayDatosCultivos, setHayDatosCultivos] = useState(false)
  const [loadingNDVI, setLoadingNDVI] = useState(false)
  const [ndviData, setNdviData] = useState<Record<string, any>>({})

  useEffect(() => {
    cargarLotes()
  }, [])

  // 🛰️ Función para obtener NDVI de Copernicus
  async function obtenerNDVIPotreros() {
    if (lotes.length === 0) return
    
    setLoadingNDVI(true)

    try {
      const response = await fetch('/api/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotes: lotes.map(l => ({
            id: l.id,
            coordenadas: l.coordenadas,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Error obteniendo NDVI')
      }

      const data = await response.json()

// 🔍 DEBUG: Ver qué datos NDVI se recibieron
console.log('📊 Datos NDVI recibidos:', data.ndvi)

// Ver detalles de cada potrero
Object.keys(data.ndvi).forEach(loteId => {
  const ndvi = data.ndvi[loteId]
  console.log(`Lote ${loteId}:`, {
    promedio: ndvi.promedio,
    tieneMatriz: ndvi.matriz?.length > 0,
    dimensiones: `${ndvi.width}x${ndvi.height}`,
    validPixels: ndvi.validPixels,
    totalPixels: ndvi.totalPixels,
    porcentajeValido: ndvi.totalPixels > 0 
      ? `${Math.round((ndvi.validPixels / ndvi.totalPixels) * 100)}%`
      : '0%'
  })
})

setNdviData(data.ndvi)
} catch (error) {
  console.error('Error obteniendo NDVI:', error)
  alert('Error obteniendo datos NDVI. Intenta de nuevo más tarde.')
} finally {
  setLoadingNDVI(false)
}
}

// Cargar NDVI cuando cambia a vista NDVI
useEffect(() => {
  if (vistaActual === 'ndvi' && Object.keys(ndviData).length === 0) {
    obtenerNDVIPotreros()
  }
}, [vistaActual, lotes])

  // 🎨 Función para obtener color según NDVI
  function getColorNDVI(ndvi: number): string {
    if (ndvi < 0.2) return '#8B4513'
    if (ndvi < 0.3) return '#DAA520'
    if (ndvi < 0.4) return '#FFFF00'
    if (ndvi < 0.5) return '#ADFF2F'
    if (ndvi < 0.6) return '#7CFC00'
    if (ndvi < 0.7) return '#32CD32'
    if (ndvi < 0.8) return '#228B22'
    return '#006400'
  }

  async function cargarLotes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data: Lote[] = await response.json()
        setLotes(data)

        const tieneCultivos = data.some(lote => lote.cultivos && lote.cultivos.length > 0)
        setHayDatosCultivos(tieneCultivos)

        if (data.length > 0) {
          const todosLosPuntos = data
            .flatMap(l => l.coordenadas || [])
            .filter(c => c && c.length === 2)

          if (todosLosPuntos.length > 0) {
            const center = todosLosPuntos
              .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
              .map(v => v / todosLosPuntos.length) as [number, number]
            setMapCenter(center)
          }
        }
      }
    } catch (error) {
      console.error('Error cargando lotes:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🗺️ Preparar polígonos para el mapa
  const poligonosParaMapa = lotes
    .filter(l => l.coordenadas && l.coordenadas.length > 0)
    .map(lote => {
      let color = '#3b82f6'

      if (vistaActual === 'cultivo') {
        if (lote.cultivos && lote.cultivos.length > 0) {
          const cultivoPrincipal = lote.cultivos[0].tipoCultivo
          color = COLORES_CULTIVOS[cultivoPrincipal] || '#3b82f6'
        } else {
          color = '#D3D3D3'
        }
      } else if (vistaActual === 'ndvi') {
  const ndviInfo = ndviData[lote.id]
  if (ndviInfo && typeof ndviInfo.promedio === 'number') { // 👈 CAMBIO AQUÍ
    color = getColorNDVI(ndviInfo.promedio)
  } else {
    color = '#CCCCCC'
  }
}

      return {
        id: lote.id,
        nombre: lote.nombre,
        coordinates: lote.coordenadas,
        color,
        info: {
          hectareas: lote.hectareas,
          cultivos: lote.cultivos,
          animales: lote.animalesLote,
          ndviMatriz: ndviData[lote.id] || null,
        },
      }
    })

  const resumenCultivos = lotes.reduce((acc, lote) => {
    lote.cultivos?.forEach(cultivo => {
      if (!acc[cultivo.tipoCultivo]) {
        acc[cultivo.tipoCultivo] = 0
      }
      acc[cultivo.tipoCultivo] += cultivo.hectareas
    })
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa del campo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗺️ Mapa del Campo</h1>
            <p className="text-sm text-gray-600 mt-1">
              {lotes.length} {lotes.length === 1 ? 'potrero' : 'potreros'} registrados
            </p>
          </div>

          {/* TOGGLE DE VISTAS */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Vista:</span>
            <div className="inline-flex rounded-lg border-2 border-gray-300 bg-white overflow-hidden">
              <button
                onClick={() => setVistaActual('indice')}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
                  vistaActual === 'indice'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🗺️ General
              </button>
              <button
                onClick={() => setVistaActual('cultivo')}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
                  vistaActual === 'cultivo'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🌾 Cultivos
              </button>
              <button
                onClick={() => setVistaActual('ndvi')}
                disabled={loadingNDVI}
                className={`px-3 py-2 text-xs sm:text-sm font-medium transition relative ${
                  vistaActual === 'ndvi'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                } ${loadingNDVI ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                🛰️ NDVI
                {loadingNDVI && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        {/* MAPA */}
        <div className="flex-1 relative">
          {lotes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay potreros registrados
                </h3>
                <p className="text-gray-600 mb-4">
                  Creá tu primer potrero para ver el mapa del campo
                </p>
                <a
                  href="/dashboard/lotes/nuevo"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  + Crear Potrero
                </a>
              </div>
            </div>
          ) : (
            <MapaPoligono
              initialCenter={mapCenter}
              initialZoom={14}
              existingPolygons={poligonosParaMapa}
              readOnly={true}
            />
          )}
        </div>

        {/* PANEL LATERAL */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            {/* TÍTULO DEL PANEL */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {vistaActual === 'indice' && '🗺️ Vista General'}
              {vistaActual === 'cultivo' && '🌾 Cultivos'}
              {vistaActual === 'ndvi' && '🛰️ Índice de Vegetación (NDVI)'}
            </h2>

            {/* VISTA NDVI */}
            {vistaActual === 'ndvi' && (
              <>
                {loadingNDVI ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-700">
                        Obteniendo datos satelitales...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        📊 Escala de Vegetación
                      </h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#006400' }}></div>
                          <span>0.8 - 1.0: Vegetación muy densa</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#228B22' }}></div>
                          <span>0.7 - 0.8: Vegetación densa</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#32CD32' }}></div>
                          <span>0.6 - 0.7: Vegetación media-alta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#7CFC00' }}></div>
                          <span>0.5 - 0.6: Vegetación media</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#ADFF2F' }}></div>
                          <span>0.4 - 0.5: Vegetación baja-media</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
                          <span>0.3 - 0.4: Vegetación baja</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#DAA520' }}></div>
                          <span>0.2 - 0.3: Vegetación escasa</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded" style={{ backgroundColor: '#8B4513' }}></div>
                          <span>0.0 - 0.2: Sin vegetación</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={obtenerNDVIPotreros}
                      className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                    >
                      🔄 Actualizar Datos NDVI
                    </button>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs">
                      <p className="text-gray-700">
                        <strong>🛰️ Datos satelitales:</strong> Los valores NDVI se obtienen de 
                        imágenes Sentinel-2 de los últimos 30 días (Copernicus).
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* VISTA DE CULTIVOS */}
            {vistaActual === 'cultivo' && (
              <>
                {!hayDatosCultivos ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 mb-3">
                      Todavía no ingresaste datos de cultivos por potrero. Podés
                      ingresarlos en la página de potreros para que aparezcan acá.
                    </p>
                    <a
                      href="/dashboard/lotes"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      → Ir a Potreros
                    </a>
                  </div>
                ) : (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Selecciona los cultivos
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(resumenCultivos).map(([cultivo, hectareas]) => (
                        <div
                          key={cultivo}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                          style={{
                            backgroundColor: `${COLORES_CULTIVOS[cultivo] || '#3b82f6'}20`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded"
                              style={{
                                backgroundColor: COLORES_CULTIVOS[cultivo] || '#3b82f6',
                              }}
                            />
                            <span className="font-medium text-gray-900">{cultivo}</span>
                            <span className="text-xs text-gray-500">
                              ({hectareas.toFixed(1)} ha)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* LISTA DE POTREROS */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                📍 Potreros ({lotes.length})
              </h3>
              <div className="space-y-2">
                {lotes.map(lote => {
                  const totalAnimales = lote.animalesLote?.reduce(
                    (sum, a) => sum + a.cantidad,
                    0
                  ) || 0
                  const ndvi = ndviData[lote.id]?.promedio // 👈 AGREGAR .promedio

                  return (
                    <div
                      key={lote.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{lote.nombre}</h4>
                          <p className="text-xs text-gray-500">
                            {lote.hectareas.toFixed(2)} ha
                          </p>
                        </div>
                        <div
                          className="w-6 h-6 rounded"
                          style={{
                            backgroundColor:
                              vistaActual === 'cultivo'
                                ? lote.cultivos && lote.cultivos.length > 0
                                  ? COLORES_CULTIVOS[lote.cultivos[0].tipoCultivo] || '#3b82f6'
                                  : '#D3D3D3'
                                : vistaActual === 'ndvi' && ndvi !== undefined
                                ? getColorNDVI(ndvi)
                                : '#3b82f6',
                          }}
                        />
                      </div>

                      {vistaActual === 'ndvi' && typeof ndvi === 'number' && !isNaN(ndvi) && ( // 👈 VALIDAR
  <div className="mb-2 bg-green-50 rounded px-2 py-1">
    <div className="text-xs text-gray-600">
      📊 NDVI: <span className="font-semibold">{ndvi.toFixed(3)}</span>
                            <span className="text-gray-500 ml-1">
                              {ndvi >= 0.7 ? '(Excelente)' : ndvi >= 0.5 ? '(Bueno)' : ndvi >= 0.3 ? '(Regular)' : '(Bajo)'}
                            </span>
                          </div>
                        </div>
                      )}

                      {vistaActual === 'cultivo' && (
                        <div className="mb-2">
                          {lote.cultivos && lote.cultivos.length > 0 ? (
                            <div className="text-xs text-gray-600">
                              🌾 {lote.cultivos.map(c => c.tipoCultivo).join(', ')}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">
                              Sin cultivos
                            </div>
                          )}
                        </div>
                      )}

                      {totalAnimales > 0 ? (
                        <div className="text-xs text-gray-600">
                          🐄 {totalAnimales}{' '}
                          {lote.animalesLote && lote.animalesLote.length > 0 && (
                            <span className="text-gray-500">
                              ({lote.animalesLote.map(a => a.categoria).join(', ')})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          Sin animales
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}