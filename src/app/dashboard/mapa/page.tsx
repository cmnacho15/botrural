'use client'

import { useState, useEffect } from 'react'

// Simulación del componente MapaPoligono
const MapaPoligono = ({ initialCenter, initialZoom, existingPolygons, readOnly }) => (
  <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
    <div className="text-center p-4">
      <p className="text-gray-700 text-sm mb-2">🗺️ Mapa Interactivo</p>
      <p className="text-xs text-gray-600">{existingPolygons.length} potreros</p>
    </div>
  </div>
)

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
  const [lotes, setLotes] = useState<Lote[]>([
    {
      id: '1',
      nombre: 'Potrero Norte',
      hectareas: 45.5,
      poligono: [[0, 0], [1, 0], [1, 1], [0, 1]],
      cultivos: [{ id: '1', tipoCultivo: 'Soja', hectareas: 45.5, fechaSiembra: '2024-10-15' }],
      animalesLote: [{ id: '1', categoria: 'Vacas', cantidad: 50 }]
    },
    {
      id: '2',
      nombre: 'Potrero Sur',
      hectareas: 32.3,
      poligono: [[0, 0], [1, 0], [1, 1], [0, 1]],
      cultivos: [{ id: '2', tipoCultivo: 'Maíz', hectareas: 32.3, fechaSiembra: '2024-09-20' }],
      animalesLote: []
    }
  ])
  const [loading, setLoading] = useState(false)
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo' | 'ndvi'>('indice')
  const [mapCenter, setMapCenter] = useState<[number, number]>([-32.5228, -55.7658])
  const [hayDatosCultivos, setHayDatosCultivos] = useState(true)
  const [loadingNDVI, setLoadingNDVI] = useState(false)
  const [ndviData, setNdviData] = useState<Record<string, any>>({
    '1': { promedio: 0.72, validPixels: 1000, totalPixels: 1000, fecha: '2024-11-20', cloudCoverage: 15 },
    '2': { promedio: 0.58, validPixels: 950, totalPixels: 1000, fecha: '2024-11-20', cloudCoverage: 15 }
  })
  const [panelAbierto, setPanelAbierto] = useState(false)

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

  // 🗺️ Preparar polígonos para el mapa
  const poligonosParaMapa = lotes
    .filter(l => l.poligono && l.poligono.length > 0)
    .map(lote => {
      let color = '#10b981'

      if (vistaActual === 'cultivo') {
        if (lote.cultivos && lote.cultivos.length > 0) {
          const cultivoPrincipal = lote.cultivos[0].tipoCultivo
          color = COLORES_CULTIVOS[cultivoPrincipal] || '#10b981'
        } else {
          color = '#D3D3D3'
        }
      } else if (vistaActual === 'ndvi') {
        const ndviInfo = ndviData[lote.id]
        if (ndviInfo && typeof ndviInfo.promedio === 'number' && ndviInfo.validPixels > 0) {
          color = getColorNDVI(ndviInfo.promedio)
        } else {
          color = '#CCCCCC'
        }
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
          ndviMatriz: vistaActual === 'ndvi' ? (ndviData[lote.id] || null) : null,
        },
      }
    })

  const mapaKey = `${vistaActual}-${Object.keys(ndviData).length}`

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
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">🗺️ Mapa del Campo</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {lotes.length} {lotes.length === 1 ? 'potrero' : 'potreros'}
              </p>
            </div>
            
            {/* Botón panel móvil */}
            <button
              onClick={() => setPanelAbierto(!panelAbierto)}
              className="lg:hidden p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {panelAbierto ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* TOGGLE DE VISTAS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:pb-0">
            <span className="text-xs sm:text-sm text-gray-600 font-medium whitespace-nowrap">Vista:</span>
            <div className="inline-flex rounded-lg border-2 border-gray-300 bg-white overflow-hidden flex-shrink-0">
              <button
                onClick={() => setVistaActual('indice')}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  vistaActual === 'indice'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🗺️ General
              </button>
              <button
                onClick={() => setVistaActual('cultivo')}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
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
                className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition relative whitespace-nowrap ${
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
      <div className="flex-1 flex overflow-hidden relative">
        {/* MAPA */}
        <div className="flex-1 relative z-0">
          {lotes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-4 sm:p-8">
                <div className="text-4xl sm:text-6xl mb-4">🗺️</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  No hay potreros registrados
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Creá tu primer potrero para ver el mapa
                </p>
                <a
                  href="/dashboard/lotes/nuevo"
                  className="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
                >
                  + Crear Potrero
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

        {/* PANEL LATERAL - Desktop siempre visible, Mobile como overlay */}
        <div 
          className={`
            fixed lg:relative inset-y-0 right-0 z-50
            w-full sm:w-96 lg:w-80
            bg-white border-l border-gray-200 
            transform transition-transform duration-300 ease-in-out
            ${panelAbierto ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            overflow-y-auto flex-shrink-0
            shadow-xl lg:shadow-none
          `}
        >
          {/* Botón cerrar móvil */}
          <div className="lg:hidden sticky top-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between z-10">
            <h2 className="text-lg font-semibold text-gray-900">
              {vistaActual === 'indice' && '🗺️ Vista General'}
              {vistaActual === 'cultivo' && '🌾 Cultivos'}
              {vistaActual === 'ndvi' && '🛰️ NDVI'}
            </h2>
            <button
              onClick={() => setPanelAbierto(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4">
            {/* TÍTULO DEL PANEL - Solo desktop */}
            <h2 className="hidden lg:block text-lg font-semibold text-gray-900 mb-4">
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
                    {/* INFORMACIÓN SATELITAL */}
                    {Object.keys(ndviData).length > 0 && (() => {
                      const primeraImagen = ndviData[Object.keys(ndviData)[0]]
                      if (!primeraImagen) return null
                      
                      return (
                        <div className="mb-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                          <h3 className="text-sm font-semibold text-gray-800 mb-2">
                            🛰️ Información Satelital
                          </h3>
                          <div className="space-y-2 text-xs">
                            {primeraImagen.fecha && (
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-600">📅 Fecha:</span>
                                <span className="font-semibold text-gray-900 text-right">
                                  {new Date(primeraImagen.fecha).toLocaleDateString('es-UY', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">🛰️ Satélite:</span>
                              <span className="font-medium text-gray-800">
                                {primeraImagen.source || 'Sentinel-2'}
                              </span>
                            </div>
                            {primeraImagen.cloudCoverage !== null && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">☁️ Nubes:</span>
                                <span className={`font-medium ${
                                  primeraImagen.cloudCoverage < 20 ? 'text-green-600' : 
                                  primeraImagen.cloudCoverage < 40 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {primeraImagen.cloudCoverage.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* ESCALA DE VEGETACIÓN */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        📊 Escala de Vegetación
                      </h3>
                      <div className="space-y-1 text-xs">
                        {[
                          { color: '#006400', range: '0.8 - 1.0', label: 'Muy densa' },
                          { color: '#228B22', range: '0.7 - 0.8', label: 'Densa' },
                          { color: '#32CD32', range: '0.6 - 0.7', label: 'Media-alta' },
                          { color: '#7CFC00', range: '0.5 - 0.6', label: 'Media' },
                          { color: '#ADFF2F', range: '0.4 - 0.5', label: 'Baja-media' },
                          { color: '#FFFF00', range: '0.3 - 0.4', label: 'Baja' },
                          { color: '#DAA520', range: '0.2 - 0.3', label: 'Escasa' },
                          { color: '#8B4513', range: '0.0 - 0.2', label: 'Sin vegetación' },
                        ].map(item => (
                          <div key={item.range} className="flex items-center gap-2">
                            <div className="w-6 sm:w-8 h-3 sm:h-4 rounded flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                            <span className="text-xs">{item.range}: {item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {}}
                      className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                    >
                      🔄 Actualizar Datos NDVI
                    </button>

                    {/* CALIDAD DE DATOS */}
                    {Object.keys(ndviData).length > 0 && (() => {
                      const totalPotreros = Object.keys(ndviData).length
                      const potrerosConDatos = Object.values(ndviData).filter(
                        (d: any) => d.validPixels > 0
                      ).length
                      const coberturaPromedio = Object.values(ndviData).reduce(
                        (sum: number, d: any) => sum + ((d.validPixels / d.totalPixels) || 0),
                        0
                      ) / totalPotreros * 100

                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs">
                          <p className="text-gray-700 font-semibold mb-2">📊 Calidad de Datos</p>
                          <ul className="space-y-1 text-gray-600">
                            <li className="flex items-center gap-2">
                              <span className={potrerosConDatos === totalPotreros ? 'text-green-600' : 'text-yellow-600'}>
                                {potrerosConDatos === totalPotreros ? '✅' : '⚠️'}
                              </span>
                              <span>{potrerosConDatos} de {totalPotreros} potreros con datos</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className={coberturaPromedio > 90 ? 'text-green-600' : coberturaPromedio > 70 ? 'text-yellow-600' : 'text-red-600'}>
                                {coberturaPromedio > 90 ? '✅' : coberturaPromedio > 70 ? '⚠️' : '❌'}
                              </span>
                              <span>Cobertura: {coberturaPromedio.toFixed(1)}%</span>
                            </li>
                          </ul>
                        </div>
                      )
                    })()}

                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs">
                      <p className="text-gray-700">
                        <strong>🛰️ Datos satelitales:</strong> Los valores NDVI se obtienen de 
                        imágenes Sentinel-2 de los últimos 45 días (Copernicus).
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
                      Todavía no ingresaste datos de cultivos por potrero.
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
                      Cultivos registrados
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(resumenCultivos).map(([cultivo, hectareas]) => (
                        <div
                          key={cultivo}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                          style={{
                            backgroundColor: `${COLORES_CULTIVOS[cultivo] || '#10b981'}20`,
                          }}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <div
                              className="w-4 h-4 rounded flex-shrink-0"
                              style={{
                                backgroundColor: COLORES_CULTIVOS[cultivo] || '#10b981',
                              }}
                            />
                            <span className="font-medium text-gray-900 text-sm">{cultivo}</span>
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
                  const ndvi = ndviData[lote.id]

                  return (
                    <div
                      key={lote.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{lote.nombre}</h4>
                          <p className="text-xs text-gray-500">
                            {lote.hectareas.toFixed(2)} ha
                          </p>
                        </div>
                        <div
                          className="w-6 h-6 rounded flex-shrink-0"
                          style={{
                            backgroundColor:
                              vistaActual === 'cultivo'
                                ? lote.cultivos && lote.cultivos.length > 0
                                  ? COLORES_CULTIVOS[lote.cultivos[0].tipoCultivo] || '#10b981'
                                  : '#D3D3D3'
                                : vistaActual === 'ndvi' && ndvi?.promedio !== null && ndvi?.validPixels > 0
                                ? getColorNDVI(ndvi.promedio)
                                : vistaActual === 'ndvi'
                                ? '#CCCCCC'
                                : '#10b981',
                          }}
                        />
                      </div>

                      {vistaActual === 'ndvi' && (
                        <>
                          {ndvi?.promedio !== null && ndvi?.validPixels > 0 ? (
                            <div className="mb-2 bg-green-50 rounded px-2 py-1">
                              <div className="text-xs text-gray-600">
                                📊 NDVI: <span className="font-semibold">{ndvi.promedio.toFixed(3)}</span>
                                <span className="text-gray-500 ml-1">
                                  {ndvi.promedio >= 0.7 ? '(Excelente)' : 
                                   ndvi.promedio >= 0.5 ? '(Bueno)' : 
                                   ndvi.promedio >= 0.3 ? '(Regular)' : '(Bajo)'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="mb-2 bg-red-50 rounded px-2 py-1">
                              <div className="text-xs text-red-600">
                                ⚠️ Sin datos disponibles
                              </div>
                            </div>
                          )}
                        </>
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

        {/* Overlay para cerrar panel en móvil */}
        {panelAbierto && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setPanelAbierto(false)}
          />
        )}
      </div>
    </div>
  )
}