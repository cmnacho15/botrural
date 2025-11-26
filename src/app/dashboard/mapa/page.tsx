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
  poligono: number[][]
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

  // 🛰️ Función NDVI
  async function obtenerNDVIPotreros() {
    if (lotes.length === 0) return
    setLoadingNDVI(true)

    try {
      const response = await fetch('/api/ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotes: lotes.map(l => ({
            id: l.id,
            coordenadas: l.poligono,
          })),
        }),
      })

      if (!response.ok) throw new Error('Error obteniendo NDVI')

      const data = await response.json()
      setNdviData(data.ndvi)
    } catch (error) {
      console.error('Error obteniendo NDVI:', error)
      alert('Error obteniendo datos NDVI.')
    } finally {
      setLoadingNDVI(false)
    }
  }

  useEffect(() => {
    if (vistaActual === 'ndvi' && Object.keys(ndviData).length === 0) {
      obtenerNDVIPotreros()
    }
  }, [vistaActual, lotes])

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

        const tieneCultivos = data.some(lote => lote.cultivos?.length)
        setHayDatosCultivos(tieneCultivos)

        // Calcular centro del mapa
        if (data.length > 0) {
          const pts = data.flatMap(l => l.poligono || [])
          if (pts.length > 0) {
            const center = pts
              .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
              .map(v => v / pts.length) as [number, number]
            setMapCenter(center)
          }
        }
      }
    } catch (err) {
      console.error('Error cargando lotes', err)
    } finally {
      setLoading(false)
    }
  }

  const poligonosParaMapa = lotes
    .filter(l => l.poligono?.length)
    .map(lote => {
      let color = '#10b981'

      if (vistaActual === 'cultivo') {
        if (lote.cultivos?.length) {
          const c = lote.cultivos[0].tipoCultivo
          color = COLORES_CULTIVOS[c] || '#10b981'
        } else {
          color = '#D3D3D3'
        }
      }

      if (vistaActual === 'ndvi') {
        const n = ndviData[lote.id]
        if (n?.validPixels > 0) color = getColorNDVI(n.promedio)
        else color = '#CCCCCC'
      }

      return {
        id: lote.id,
        nombre: lote.nombre,
        coordinates: lote.poligono,
        color,
        info: {
          hectareas: lote.hectareas,
          cultivos: lote.cultivos,
          animales: lote.animalesLote,
          ndviMatriz: vistaActual === 'ndvi' ? ndviData[lote.id] : null,
        },
      }
    })

  const mapaKey = `${vistaActual}-${Object.keys(ndviData).length}`

  const resumenCultivos = lotes.reduce((acc, lote) => {
    lote.cultivos?.forEach(cultivo => {
      acc[cultivo.tipoCultivo] = (acc[cultivo.tipoCultivo] || 0) + cultivo.hectareas
    })
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold">🗺️ Mapa del Campo</h1>
        <p className="text-sm text-gray-600">
          {lotes.length} {lotes.length === 1 ? 'potrero' : 'potreros'} registrados
        </p>

        {/* Toggle vistas */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600">Vista:</span>

          <div className="inline-flex rounded-lg border-2 border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setVistaActual('indice')}
              className={`px-3 py-2 text-xs sm:text-sm font-medium ${
                vistaActual === 'indice'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              🗺️ General
            </button>

            <button
              onClick={() => setVistaActual('cultivo')}
              className={`px-3 py-2 text-xs sm:text-sm font-medium ${
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
              className={`px-3 py-2 text-xs sm:text-sm font-medium ${
                vistaActual === 'ndvi'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              } ${loadingNDVI ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              🛰️ NDVI
            </button>
          </div>
        </div>
      </div>

      {/* LAYOUT RESPONSIVE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* MAPA */}
        <div className="flex-1 min-h-[300px] md:min-h-full relative z-0">
          {lotes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-5xl mb-3">🗺️</div>
                <p className="text-gray-600 mb-3">No hay potreros registrados</p>
                <a
                  href="/dashboard/lotes/nuevo"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Crear potrero
                </a>
              </div>
            </div>
          ) : (
            <MapaPoligono
              key={mapaKey}
              initialCenter={mapCenter}
              initialZoom={14}
              existingPolygons={poligonosParaMapa}
              readOnly={true}
            />
          )}
        </div>

        {/* PANEL LATERAL — RESPONSIVE */}
        <div className="
          w-full md:w-80
          max-h-[45vh] md:max-h-full
          overflow-y-auto
          bg-white border-t md:border-t-0 md:border-l
          flex-shrink-0
          p-4
        ">
          {/* TÍTULO DEL PANEL */}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {vistaActual === 'indice' && '🗺️ Vista General'}
            {vistaActual === 'cultivo' && '🌾 Cultivos'}
            {vistaActual === 'ndvi' && '🛰️ NDVI'}
          </h2>

          {/* ------------------------ */}
          {/*       PANEL NDVI         */}
          {/* ------------------------ */}
          
          {vistaActual === 'ndvi' && (
            <>
              {loadingNDVI ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm">Cargando datos satelitales...</p>
                </div>
              ) : (
                <>
                  {/* INFO SATELITAL */}
                  {Object.keys(ndviData).length > 0 && (() => {
                    const primera = ndviData[Object.keys(ndviData)[0]]
                    if (!primera) return null
                    return (
                      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                        <p><strong>Fecha:</strong> {primera.fecha}</p>
                        <p><strong>Satélite:</strong> Sentinel-2</p>
                        <p><strong>Cobertura Nubes:</strong> {primera.cloudCoverage ?? '-'}%</p>
                      </div>
                    )
                  })()}

                  {/* ESCALA DE VEGETACIÓN */}
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 text-sm">Escala NDVI</h3>
                    {[
                      ['#006400', '0.8 - 1.0 Vegetación muy densa'],
                      ['#228B22', '0.7 - 0.8 Vegetación densa'],
                      ['#32CD32', '0.6 - 0.7 Media-alta'],
                      ['#7CFC00', '0.5 - 0.6 Media'],
                      ['#ADFF2F', '0.4 - 0.5 Baja-media'],
                      ['#FFFF00', '0.3 - 0.4 Baja'],
                      ['#DAA520', '0.2 - 0.3 Escasa'],
                      ['#8B4513', '0.0 - 0.2 Suelo desnudo']
                    ].map(([color, label]) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-4 rounded" style={{ backgroundColor: color }}></div>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={obtenerNDVIPotreros}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg mb-4"
                  >
                    🔄 Actualizar NDVI
                  </button>

                </>
              )}
            </>
          )}

          {/* ------------------------ */}
          {/*       PANEL CULTIVOS     */}
          {/* ------------------------ */}

          {vistaActual === 'cultivo' && (
            <>
              {!hayDatosCultivos ? (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-4 text-sm">
                  Todavía no ingresaste cultivos.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {Object.entries(resumenCultivos).map(([cultivo, hectareas]) => (
                    <div
                      key={cultivo}
                      className="p-3 rounded-lg border text-sm flex items-center justify-between"
                      style={{
                        backgroundColor: `${COLORES_CULTIVOS[cultivo] || '#10b981'}20`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORES_CULTIVOS[cultivo] }}
                        />
                        <span className="font-medium">{cultivo}</span>
                      </div>
                      <span className="text-xs text-gray-600">{hectareas.toFixed(1)} ha</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ------------------------ */}
          {/*       LISTA POTREROS     */}
          {/* ------------------------ */}

          <div>
            <h3 className="text-sm font-semibold mb-3">📍 Potreros</h3>

            <div className="space-y-2">
              {lotes.map(lote => {
                const totalAnimales = lote.animalesLote?.reduce((s, a) => s + a.cantidad, 0) || 0
                const ndvi = ndviData[lote.id]

                return (
                  <div
                    key={lote.id}
                    className="p-3 bg-gray-50 border rounded-lg hover:border-blue-400 transition cursor-pointer text-sm"
                  >

                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{lote.nombre}</h4>
                        <p className="text-xs text-gray-500">
                          {lote.hectareas.toFixed(2)} ha
                        </p>
                      </div>

                      {/* Color indicador */}
                      <div
                        className="w-5 h-5 rounded"
                        style={{
                          backgroundColor:
                            vistaActual === 'indice'
                              ? '#10b981'
                              : vistaActual === 'cultivo'
                              ? COLORES_CULTIVOS[lote.cultivos?.[0]?.tipoCultivo] || '#D3D3D3'
                              : ndvi?.validPixels > 0
                              ? getColorNDVI(ndvi?.promedio)
                              : '#CCCCCC'
                        }}
                      ></div>
                    </div>

                    {vistaActual === 'ndvi' && (
                      <div className="text-xs mb-1">
                        {ndvi?.validPixels > 0 ? (
                          <span className="text-gray-700">
                            NDVI: <strong>{ndvi.promedio.toFixed(3)}</strong>
                          </span>
                        ) : (
                          <span className="text-red-600">Sin datos NDVI</span>
                        )}
                      </div>
                    )}

                    {vistaActual === 'cultivo' && (
                      <div className="text-xs mb-1">
                        {lote.cultivos?.length > 0 ? (
                          <span>🌾 {lote.cultivos.map(c => c.tipoCultivo).join(', ')}</span>
                        ) : (
                          <span className="text-gray-400 italic">Sin cultivos</span>
                        )}
                      </div>
                    )}

                    {/* Animales */}
                    {totalAnimales > 0 ? (
                      <div className="text-xs text-gray-700">
                        🐄 {totalAnimales}{' '}
                        <span className="text-gray-500">
                          ({lote.animalesLote.map(a => a.categoria).join(', ')})
                        </span>
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
  )
}