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
  'Soja': '#FFD700',      // Amarillo oro
  'Maíz': '#FF69B4',      // Rosa
  'Trigo': '#F4A460',     // Naranja claro
  'Girasol': '#FFD700',   // Amarillo
  'Sorgo': '#DEB887',     // Beige
  'Cebada': '#D2691E',    // Marrón claro
  'Avena': '#F5DEB3',     // Trigo claro
  'Arroz': '#90EE90',     // Verde claro
  'Alfalfa': '#32CD32',   // Verde lima
  'Pradera': '#228B22',   // Verde oscuro
}

export default function MapaPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo'>('indice')
  const [mapCenter, setMapCenter] = useState<[number, number]>([-32.5228, -55.7658])
  const [hayDatosCultivos, setHayDatosCultivos] = useState(false)

  useEffect(() => {
    cargarLotes()
  }, [])

  async function cargarLotes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data: Lote[] = await response.json()
        setLotes(data)

        // Verificar si hay cultivos
        const tieneCultivos = data.some(lote => lote.cultivos && lote.cultivos.length > 0)
        setHayDatosCultivos(tieneCultivos)

        // Calcular centro del mapa
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
      let color = '#3b82f6' // Azul por defecto

      if (vistaActual === 'cultivo') {
        // Color según el cultivo principal
        if (lote.cultivos && lote.cultivos.length > 0) {
          const cultivoPrincipal = lote.cultivos[0].tipoCultivo
          color = COLORES_CULTIVOS[cultivoPrincipal] || '#3b82f6'
        } else {
          color = '#D3D3D3' // Gris para lotes sin cultivo
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
        },
      }
    })

  // 📊 Resumen de cultivos para la leyenda
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
                className={`px-4 py-2 text-sm font-medium transition ${
                  vistaActual === 'indice'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🌿 Índice Verde
              </button>
              <button
                onClick={() => setVistaActual('cultivo')}
                className={`px-4 py-2 text-sm font-medium transition ${
                  vistaActual === 'cultivo'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                🌾 Cultivo
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
              {vistaActual === 'indice' ? '🌿 Índice Verde' : '🌾 Cultivos'}
            </h2>

            {/* VISTA DE CULTIVOS */}
            {vistaActual === 'cultivo' && (
              <>
                {!hayDatosCultivos ? (
                  // Sin datos de cultivos
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
                  // Con datos de cultivos
                  <>
                    {/* LEYENDA DE COLORES */}
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
                  </>
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
                        {vistaActual === 'cultivo' && (
                          <div
                            className="w-6 h-6 rounded"
                            style={{
                              backgroundColor:
                                lote.cultivos && lote.cultivos.length > 0
                                  ? COLORES_CULTIVOS[lote.cultivos[0].tipoCultivo] ||
                                    '#3b82f6'
                                  : '#D3D3D3',
                            }}
                          />
                        )}
                      </div>

                      {/* CULTIVOS */}
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

                      {/* ANIMALES */}
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