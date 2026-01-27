//src/app/dashboard/mapa/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
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
  moduloPastoreoId: string | null  // 🔥 AGREGADO
  cultivos: Cultivo[]
  animalesLote: Animal[]
}

// 🎨 Colores por tipo de cultivo - Profesionales y bien diferenciados
const COLORES_CULTIVOS: Record<string, string> = {
  Soja: '#FFD700',      // Amarillo dorado
  'Maíz': '#FF8C00',    // Naranja oscuro
  Trigo: '#DAA520',     // Dorado
  Girasol: '#FFA500',   // Naranja
  Sorgo: '#CD853F',     // Marrón claro
  Cebada: '#D2691E',    // Chocolate
  Avena: '#F4A460',     // Sandy brown
  Arroz: '#90EE90',     // Verde claro
  Alfalfa: '#32CD32',   // Verde lima
  Pradera: '#228B22',   // Verde bosque
  Natural: '#9CA3AF',   // Gris - Para potreros sin cultivo
}

// 🎨 Colores por módulo de pastoreo
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

function getColorModulo(moduloIndex: number): string {
  return COLORES_MODULOS[moduloIndex % COLORES_MODULOS.length]
}

export default function MapaPage() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'indice' | 'cultivo' | 'ndvi' | 'curvas' | 'coneat'>(
  'indice',
)
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -32.5228, -55.7658,
  ])
  const [hayDatosCultivos, setHayDatosCultivos] = useState(false)
  const [loadingNDVI, setLoadingNDVI] = useState(false)
  const [ndviData, setNdviData] = useState<Record<string, any>>({})
  const [modulos, setModulos] = useState<Array<{id: string, nombre: string}>>([])
  const [opacidadCurvas, setOpacidadCurvas] = useState(95)
  
  // Memorizar el key para que no cambie cuando solo cambia opacidad
  const mapaKey = useMemo(() => 
    `vista-${vistaActual}-${lotes.length}-${Object.keys(ndviData).length}-mapa`,
    [vistaActual, lotes.length, Object.keys(ndviData).length]
  )

  // Cargar lotes y módulos
  useEffect(() => {
    cargarLotes()
    cargarModulos()
  }, [])

  async function cargarLotes() {
    try {
      const response = await fetch('/api/lotes')
      if (response.ok) {
        const data: Lote[] = await response.json()
        setLotes(data)

        const tieneCultivos = data.some(
          (lote) => lote.cultivos && lote.cultivos.length > 0,
        )
        setHayDatosCultivos(tieneCultivos)

        if (data.length > 0) {
          const todosLosPuntos = data
            .flatMap((l) => l.poligono || [])
            .filter((c) => c && c.length === 2)

          if (todosLosPuntos.length > 0) {
            const center = todosLosPuntos
              .reduce(
                (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
                [0, 0] as [number, number],
              )
              .map((v) => v / todosLosPuntos.length) as [number, number]
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

  async function cargarModulos() {
    try {
      const response = await fetch('/api/modulos-pastoreo')
      if (response.ok) {
        const data = await response.json()
        setModulos(data)
      }
    } catch (error) {
      console.error('Error cargando módulos:', error)
    }
  }

  // 🛰️ Obtener NDVI
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
          lotes: lotes.map((l) => ({
            id: l.id,
            coordenadas: l.poligono,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Error obteniendo NDVI')
      }

      const data = await response.json()

      console.log('📊 Datos NDVI recibidos:', data.ndvi)

      Object.keys(data.ndvi).forEach((loteId) => {
        const ndvi = data.ndvi[loteId]
        console.log(`Lote ${loteId}:`, {
          promedio: ndvi.promedio,
          tieneMatriz: ndvi.matriz?.length > 0,
          dimensiones: `${ndvi.width}x${ndvi.height}`,
          bbox: ndvi.bbox,
          validPixels: ndvi.validPixels,
          totalPixels: ndvi.totalPixels,
          porcentajeValido:
            ndvi.totalPixels > 0
              ? `${Math.round((ndvi.validPixels / ndvi.totalPixels) * 100)}%`
              : '0%',
          primerosValores: ndvi.matriz?.[0]?.slice(0, 5) || 'sin datos',
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

  // Cargar NDVI cuando se pasa a vista ndvi
  useEffect(() => {
  if (vistaActual !== 'ndvi') return; // Solo ejecutar en NDVI

  const faltanDatos = lotes.some(
    (l) =>
      !ndviData[l.id] ||                        // No existe ese lote
      !ndviData[l.id].matriz ||                 // No tiene matriz
      ndviData[l.id].matriz.length === 0 ||     // Matriz vacía
      ndviData[l.id].validPixels === 0          // Sin pixeles válidos
  );

  if (faltanDatos && !loadingNDVI) {
    obtenerNDVIPotreros();
  }
}, [vistaActual, lotes, ndviData]);

  // 🎨 Color según NDVI
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
  
  // 📦 Preparar datos de leyenda para el mapa (solo vista General)
  const modulosLeyendaParaMapa = vistaActual === 'indice' 
    ? [
        ...modulos.map((modulo, index) => {
          const lotesDelModulo = lotes.filter(l => l.moduloPastoreoId === modulo.id)
          
          // Calcular animales por categoría
          const animalesPorCategoria: Record<string, number> = {}
          lotesDelModulo.forEach(lote => {
            lote.animalesLote?.forEach(animal => {
              if (!animalesPorCategoria[animal.categoria]) {
                animalesPorCategoria[animal.categoria] = 0
              }
              animalesPorCategoria[animal.categoria] += animal.cantidad
            })
          })
          const totalAnimales = Object.values(animalesPorCategoria).reduce((sum, c) => sum + c, 0)
          
          return {
            id: modulo.id,
            nombre: modulo.nombre,
            color: getColorModulo(index),
            cantidadPotreros: lotesDelModulo.length,
            hectareas: lotesDelModulo.reduce((sum, l) => sum + l.hectareas, 0),
            totalAnimales,
            animalesPorCategoria
          }
        }),
        ...(() => {
          const lotesSinModulo = lotes.filter(l => !l.moduloPastoreoId)
          if (lotesSinModulo.length === 0) return []
          
          // Calcular animales por categoría para sin módulo
          const animalesPorCategoria: Record<string, number> = {}
          lotesSinModulo.forEach(lote => {
            lote.animalesLote?.forEach(animal => {
              if (!animalesPorCategoria[animal.categoria]) {
                animalesPorCategoria[animal.categoria] = 0
              }
              animalesPorCategoria[animal.categoria] += animal.cantidad
            })
          })
          const totalAnimales = Object.values(animalesPorCategoria).reduce((sum, c) => sum + c, 0)
          
          return [{
            id: 'sin-modulo',
            nombre: 'Sin módulo',
            color: '#1212dd',
            cantidadPotreros: lotesSinModulo.length,
            hectareas: lotesSinModulo.reduce((sum, l) => sum + l.hectareas, 0),
            totalAnimales,
            animalesPorCategoria
          }]
        })()
      ]
    : []


  // Polígonos para el mapa
  const poligonosParaMapa = lotes
    .filter((l) => l.poligono && l.poligono.length > 0)
    .map((lote) => {
      let color = '#1212dd' // Azul Vista General (default si no tiene módulo)

      // 🔥 VISTA GENERAL: Color por módulo
      if (vistaActual === 'indice') {
        if (lote.moduloPastoreoId) {
          const moduloIndex = modulos.findIndex(m => m.id === lote.moduloPastoreoId)
          if (moduloIndex !== -1) {
            color = getColorModulo(moduloIndex)
          }
        }
      }
      // Vista cultivos
      else if (vistaActual === 'cultivo') {
        if (lote.cultivos && lote.cultivos.length > 0) {
          const cultivoPrincipal = lote.cultivos[0].tipoCultivo
          
          // Si no tiene color definido, generar uno único basado en el nombre
          if (!COLORES_CULTIVOS[cultivoPrincipal]) {
            // Generar hash del nombre para color consistente
            let hash = 0
            for (let i = 0; i < cultivoPrincipal.length; i++) {
              hash = cultivoPrincipal.charCodeAt(i) + ((hash << 5) - hash)
            }
            const hue = hash % 360
            color = `hsl(${hue}, 70%, 50%)`
          } else {
            color = COLORES_CULTIVOS[cultivoPrincipal]
          }
        } else {
          // Potreros sin cultivo = "Natural"
          color = COLORES_CULTIVOS['Natural']
        }
      } else if (vistaActual === 'ndvi') {
        const ndviInfo = ndviData[lote.id]
        if (
          ndviInfo &&
          typeof ndviInfo.promedio === 'number' &&
          ndviInfo.validPixels > 0
        ) {
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
          ndviMatriz:
            vistaActual === 'ndvi' ? ndviData[lote.id] || null : null,
        },
      }
    })

  // Resumen cultivos
  const resumenCultivos = lotes.reduce((acc, lote) => {
    lote.cultivos?.forEach((cultivo) => {
      if (!acc[cultivo.tipoCultivo]) {
        acc[cultivo.tipoCultivo] = 0
      }
      acc[cultivo.tipoCultivo] += cultivo.hectareas
    })
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center rounded-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando mapa del campo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] sm:h-[calc(100vh-90px)] bg-gray-50">
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4 px-3 sm:px-4 py-3 sm:py-4">
        {/* HEADER */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 sm:px-6 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              🗺️ Mapa del Campo
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {lotes.length}{' '}
              {lotes.length === 1 ? 'potrero registrado' : 'potreros registrados'}
            </p>
          </div>

          {/* TOGGLE DE VISTAS */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">
              Vista:
            </span>
            <div className="inline-flex rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
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
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </button>
              <button
  onClick={() => setVistaActual('curvas')}
  className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
    vistaActual === 'curvas'
      ? 'bg-amber-600 text-white'
      : 'text-gray-700 hover:bg-gray-50'
  }`}
>
  📏 Curvas
</button>
<button
  onClick={() => setVistaActual('coneat')}
  className={`px-3 py-2 text-xs sm:text-sm font-medium transition ${
    vistaActual === 'coneat'
      ? 'bg-green-600 text-white'
      : 'text-gray-700 hover:bg-gray-50'
  }`}
>
  🌱 CONEAT
</button>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: MAPA + PANEL */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* MAPA (izquierda en desktop, arriba en móvil) */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[260px] sm:min-h-[320px] lg:min-h-0 lg:h-full">
            <div className="relative w-full h-full">
              {lotes.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center p-6 sm:p-8">
                    <div className="text-5xl sm:text-6xl mb-4">🗺️</div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                      No hay potreros registrados
                    </h3>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Creá tu primer potrero para ver el mapa del campo
                    </p>
                    <a
                      href="/dashboard/lotes/nuevo"
                      className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
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
  modulosLeyenda={modulosLeyendaParaMapa}
  mostrarLeyendaModulos={vistaActual === 'indice'}
  mostrarCurvasNivel={vistaActual === 'curvas'}
  mostrarConeat={vistaActual === 'coneat'}
  opacidadCurvas={opacidadCurvas}
  onOpacidadCurvasChange={setOpacidadCurvas}
/>
              )}
            </div>
          </div>

          {/* PANEL (derecha en desktop, abajo en móvil) */}
          <div className="w-full lg:w-[400px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col lg:max-h-full">
            {/* Encabezado de panel */}
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-white">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
  {vistaActual === 'indice' && '🗺️ Vista General'}
  {vistaActual === 'cultivo' && '🌾 Cultivos por potrero'}
  {vistaActual === 'ndvi' && '🛰️ Índice de Vegetación (NDVI)'}
  {vistaActual === 'curvas' && '📏 Curvas de Nivel'}
  {vistaActual === 'coneat' && '🌱 Grupos CONEAT'}
</h2>
            </div>

            {/* Contenido del panel:
                - En móvil: ocupa su altura natural -> la página entera hace scroll
                - En desktop: scroll interno del panel (max alto) */}
            <div className="flex-1 bg-gray-50 px-4 sm:px-5 py-3 sm:py-4 lg:overflow-y-auto">
              
              {/* VISTA GENERAL (ÍNDICE) - Leyenda de módulos */}
              {vistaActual === 'indice' && modulos.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                    📦 Módulos de Pastoreo
                  </h3>
                  <div className="space-y-2">
                    {modulos.map((modulo, index) => {
                      const lotesDelModulo = lotes.filter(l => l.moduloPastoreoId === modulo.id)
                      const totalHa = lotesDelModulo.reduce((sum, l) => sum + l.hectareas, 0)
                      
                      return (
                        <div
                          key={modulo.id}
                          className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                          style={{
                            backgroundColor: `${getColorModulo(index)}20`,
                          }}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                              style={{
                                backgroundColor: getColorModulo(index),
                              }}
                            />
                            <span className="font-medium text-gray-900 text-xs sm:text-sm">
                              {modulo.nombre}
                            </span>
                            <span className="text-[11px] sm:text-xs text-gray-500">
                              ({lotesDelModulo.length} potrero{lotesDelModulo.length !== 1 ? 's' : ''}, {totalHa.toFixed(1)} ha)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Potreros sin módulo */}
                    {(() => {
                      const lotesSinModulo = lotes.filter(l => !l.moduloPastoreoId)
                      if (lotesSinModulo.length === 0) return null
                      
                      const totalHa = lotesSinModulo.reduce((sum, l) => sum + l.hectareas, 0)
                      
                      return (
                        <div
                          className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition bg-gray-50"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                              style={{ backgroundColor: '#1212dd' }}
                            />
                            <span className="font-medium text-gray-900 text-xs sm:text-sm">
                              Sin módulo
                            </span>
                            <span className="text-[11px] sm:text-xs text-gray-500">
                              ({lotesSinModulo.length} potrero{lotesSinModulo.length !== 1 ? 's' : ''}, {totalHa.toFixed(1)} ha)
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* VISTA NDVI */}
              {vistaActual === 'ndvi' && (
                <>
                  {loadingNDVI ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <p className="text-sm text-gray-700">
                          Obteniendo datos satelitales...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 🛰️ Info satelital */}
                      {Object.keys(ndviData).length > 0 &&
                        (() => {
                          const primeraImagen = ndviData[Object.keys(ndviData)[0]]
                          if (!primeraImagen) return null

                          return (
                            <div className="mb-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                                🛰️ Información Satelital
                              </h3>
                              <div className="space-y-2 text-xs sm:text-[13px]">
                                {primeraImagen.fecha && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-gray-600">📅 Fecha:</span>
                                    <span className="font-semibold text-gray-900">
                                      {new Date(
                                        primeraImagen.fecha,
                                      ).toLocaleDateString('es-UY', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-2">
                                  <span className="text-gray-600">🛰️ Satélite:</span>
                                  <span className="font-medium text-gray-800">
                                    {primeraImagen.source || 'Sentinel-2'}
                                  </span>
                                </div>
                                {primeraImagen.cloudCoverage !== null &&
                                  primeraImagen.cloudCoverage !== undefined && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-gray-600">☁️ Nubes:</span>
                                      <span
                                        className={`font-medium ${
                                          primeraImagen.cloudCoverage < 20
                                            ? 'text-green-600'
                                            : primeraImagen.cloudCoverage < 40
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {primeraImagen.cloudCoverage.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )
                        })()}

                      {/* Escala NDVI */}
                      <div className="mb-5">
  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
    📊 Escala de Vegetación
  </h3>
                        <div className="space-y-1.5 text-[11px] sm:text-xs">
                          {[
                            ['#006400', '0.8 - 1.0: Vegetación muy densa'],
                            ['#228B22', '0.7 - 0.8: Vegetación densa'],
                            ['#32CD32', '0.6 - 0.7: Vegetación media-alta'],
                            ['#7CFC00', '0.5 - 0.6: Vegetación media'],
                            ['#ADFF2F', '0.4 - 0.5: Vegetación baja-media'],
                            ['#FFFF00', '0.3 - 0.4: Vegetación baja'],
                            ['#DAA520', '0.2 - 0.3: Vegetación escasa'],
                            ['#8B4513', '0.0 - 0.2: Sin vegetación'],
                          ].map(([color, label]) => (
                            <div
                              key={label}
                              className="flex items-center gap-2 sm:gap-3"
                            >
                              <div
                                className="w-7 h-3 sm:w-8 sm:h-4 rounded"
                                style={{ backgroundColor: color as string }}
                              />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={obtenerNDVIPotreros}
                        className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium"
                      >
                        🔄 Actualizar Datos NDVI
                      </button>

                      {/* Calidad de datos */}
                      {Object.keys(ndviData).length > 0 &&
                        (() => {
                          const totalPotreros = Object.keys(ndviData).length
                          const potrerosConDatos = Object.values(ndviData).filter(
                            (d: any) => d.validPixels > 0,
                          ).length
                          const coberturaPromedio =
                            (Object.values(ndviData).reduce(
                              (sum: number, d: any) =>
                                sum + ((d.validPixels / d.totalPixels) || 0),
                              0,
                            ) /
                              totalPotreros) *
                            100

                          return (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-[11px] sm:text-xs">
                              <p className="text-gray-700 font-semibold mb-2">
                                📊 Calidad de Datos
                              </p>
                              <ul className="space-y-1.5 text-gray-600">
                                <li className="flex items-center gap-2">
                                  <span
                                    className={
                                      potrerosConDatos === totalPotreros
                                        ? 'text-green-600'
                                        : 'text-yellow-600'
                                    }
                                  >
                                    {potrerosConDatos === totalPotreros
                                      ? '✅'
                                      : '⚠️'}
                                  </span>
                                  <span>
                                    {potrerosConDatos} de {totalPotreros} potreros con
                                    datos
                                  </span>
                                </li>
                                <li className="flex items-center gap-2">
                                  <span
                                    className={
                                      coberturaPromedio > 90
                                        ? 'text-green-600'
                                        : coberturaPromedio > 70
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {coberturaPromedio > 90
                                      ? '✅'
                                      : coberturaPromedio > 70
                                      ? '⚠️'
                                      : '❌'}
                                  </span>
                                  <span>
                                    Cobertura: {coberturaPromedio.toFixed(1)}%
                                  </span>
                                </li>
                              </ul>
                            </div>
                          )
                        })()}

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-[11px] sm:text-xs">
                        <p className="text-gray-700">
                          <strong>🛰️ Datos satelitales:</strong> Los valores NDVI se
                          obtienen de imágenes Sentinel-2 de los últimos 45 días
                          (Copernicus).
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              
              {/* VISTA CURVAS DE NIVEL */}
              {vistaActual === 'curvas' && (
                <>

                {/* Control de opacidad */}
                  <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">
                        Opacidad del mapa
                      </label>
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {opacidadCurvas}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={opacidadCurvas}
                      onChange={(e) => setOpacidadCurvas(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      style={{
                        background: `linear-gradient(to right, #d97706 0%, #d97706 ${opacidadCurvas}%, #e5e7eb ${opacidadCurvas}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-1">
                      <span>Transparente</span>
                      <span>Opaco</span>
                    </div>
                  </div>

                  {/* Información */}
                  <div className="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      📏 Información de Curvas de Nivel
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px] text-gray-700">
                      <div className="flex items-start gap-2">
                        <span>📐</span>
                        <span><strong>Intervalo:</strong> Curvas cada 10 metros de elevación</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🗺️</span>
                        <span><strong>Fuente:</strong> OpenTopoMap (datos topográficos abiertos)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🌍</span>
                        <span><strong>Cobertura:</strong> Todo Uruguay y el mundo</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>💡</span>
                        <span><strong>Uso:</strong> Identifica pendientes, zonas bajas/altas y planifica drenajes</span>
                      </div>
                    </div>
                  </div>

                  {/* Guía de interpretación */}
                  <div className="mb-5">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                      📊 ¿Cómo interpretar?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px]">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔵 Líneas muy juntas</p>
                        <p className="text-gray-600">Pendiente pronunciada / Zona empinada</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔵 Líneas separadas</p>
                        <p className="text-gray-600">Pendiente suave / Zona plana</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">⭕ Círculos concéntricos</p>
                        <p className="text-gray-600">Cerros o lomadas elevadas</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🔽 Curvas en "V"</p>
                        <p className="text-gray-600">Cañadas o cursos de agua</p>
                      </div>
                    </div>
                  </div>
                  

                  {/* Tip de uso */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs sm:text-[13px]">
                    <p className="font-semibold text-blue-900 mb-1.5">💡 Consejo</p>
                    <p className="text-blue-800">
                      Hacé zoom para ver más detalle de las curvas. Las líneas representan puntos de igual elevación sobre el nivel del mar.
                    </p>
                  </div>
                </>
              )}

              {/* VISTA CONEAT */}
              {vistaActual === 'coneat' && (
                <>
                  {/* Información */}
                  <div className="mb-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      🌱 ¿Qué es CONEAT?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px] text-gray-700">
                      <div className="flex items-start gap-2">
                        <span>📊</span>
                        <span><strong>CONEAT</strong> es el Índice de Productividad de Suelos de Uruguay (0-200+)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🏛️</span>
                        <span><strong>Fuente:</strong> MGAP - Ministerio de Ganadería, Agricultura y Pesca</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>💡</span>
                        <span><strong>Uso:</strong> Evaluar potencial productivo del suelo para toma de decisiones</span>
                      </div>
                    </div>
                  </div>

              

                  {/* Usos prácticos */}
                  <div className="mb-5">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                      💡 ¿Para qué sirve?
                    </h3>
                    <div className="space-y-2 text-xs sm:text-[13px]">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🌾 Decisiones de siembra</p>
                        <p className="text-gray-600">Elegir cultivos según potencial del suelo</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">💰 Cálculo de arrendamientos</p>
                        <p className="text-gray-600">Base para determinar valor de alquiler</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">📈 Planificación productiva</p>
                        <p className="text-gray-600">Rotaciones cultivo/pastoreo según CONEAT</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-1">🎯 Expectativas de rinde</p>
                        <p className="text-gray-600">Estimar productividad esperada por potrero</p>
                      </div>
                    </div>
                  </div>

                  {/* Nota oficial */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs sm:text-[13px]">
                    <p className="font-semibold text-blue-900 mb-1.5">ℹ️ Datos Oficiales</p>
                    <p className="text-blue-800">
                      Los datos CONEAT provienen del MGAP (Ministerio de Ganadería, Agricultura y Pesca) y son los mismos que usa el gobierno uruguayo para políticas agropecuarias.
                    </p>
                  </div>
                </>
              )}

              {/* VISTA CULTIVOS */}
              {vistaActual === 'cultivo' && (
                <>
                  {!hayDatosCultivos ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-sm text-gray-700 mb-2">
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
                    <div className="mb-5">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                        🌾 Resumen de cultivos
                      </h3>
                      <div className="space-y-2">
                        {[
                          ...Object.entries(resumenCultivos),
                          // Agregar potreros "Natural" si existen
                          ...((() => {
                            const lotesNaturales = lotes.filter(l => !l.cultivos || l.cultivos.length === 0)
                            const hectareasNaturales = lotesNaturales.reduce((sum, l) => sum + l.hectareas, 0)
                            return hectareasNaturales > 0 ? [['Natural', hectareasNaturales] as [string, number]] : []
                          })())
                        ].map(
                          ([cultivo, hectareas]) => {
                            // Generar el mismo color que en el mapa
                            let colorCultivo = COLORES_CULTIVOS[cultivo]
                            if (!colorCultivo) {
                              let hash = 0
                              for (let i = 0; i < cultivo.length; i++) {
                                hash = cultivo.charCodeAt(i) + ((hash << 5) - hash)
                              }
                              const hue = hash % 360
                              colorCultivo = `hsl(${hue}, 70%, 50%)`
                            }
                            
                            return (
                            <div
                              key={cultivo}
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                              style={{
                                backgroundColor: `${colorCultivo}20`,
                              }}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3">
                                <div
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded"
                                  style={{
                                    backgroundColor: colorCultivo,
                                  }}
                                />
                                <span className="font-medium text-gray-900 text-xs sm:text-sm">
                                  {cultivo}
                                </span>
                                <span className="text-[11px] sm:text-xs text-gray-500">
                                  ({hectareas.toFixed(1)} ha)
                                </span>
                              </div>
                            </div>
                            )
                          },
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* LISTA DE POTREROS */}
              <div className="mt-2">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  📍 Potreros ({lotes.length})
                </h3>
                <div className="space-y-2.5">
                  {lotes.map((lote) => {
                    const totalAnimales =
                      lote.animalesLote?.reduce(
                        (sum, a) => sum + a.cantidad,
                        0,
                      ) || 0
                    const ndvi = ndviData[lote.id]

                    return (
                      <div
                        key={lote.id}
                        className="p-2.5 sm:p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {lote.nombre}
                            </h4>
                            <p className="text-[11px] sm:text-xs text-gray-500">
                              {lote.hectareas.toFixed(2)} ha
                            </p>
                          </div>
                          <div
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded"
                            style={{
                              backgroundColor:
                                vistaActual === 'cultivo'
                                  ? lote.cultivos && lote.cultivos.length > 0
                                    ? COLORES_CULTIVOS[
                                        lote.cultivos[0].tipoCultivo
                                      ] || '#10b981'
                                    : '#D3D3D3'
                                  : vistaActual === 'ndvi' &&
                                    ndvi?.promedio !== null &&
                                    ndvi?.validPixels > 0
                                  ? getColorNDVI(ndvi.promedio)
                                  : vistaActual === 'ndvi'
                                  ? '#CCCCCC'
                                  : vistaActual === 'indice' && lote.moduloPastoreoId
                                  ? (() => {
                                      const moduloIndex = modulos.findIndex(m => m.id === lote.moduloPastoreoId)
                                      return moduloIndex !== -1 ? getColorModulo(moduloIndex) : '#1212dd'
                                    })()
                                  : '#1212dd',
                            }}
                          />
                        </div>

                        {vistaActual === 'ndvi' && (
                          <>
                            {ndvi?.promedio !== null && ndvi?.validPixels > 0 ? (
                              <div className="mb-1.5 bg-green-50 rounded px-2 py-1">
                                <div className="text-[11px] sm:text-xs text-gray-600">
                                  📊 NDVI:{' '}
                                  <span className="font-semibold">
                                    {ndvi.promedio.toFixed(3)}
                                  </span>
                                  <span className="text-gray-500 ml-1">
                                    {ndvi.promedio >= 0.7
                                      ? '(Excelente)'
                                      : ndvi.promedio >= 0.5
                                      ? '(Bueno)'
                                      : ndvi.promedio >= 0.3
                                      ? '(Regular)'
                                      : '(Bajo)'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-1.5 bg-red-50 rounded px-2 py-1">
                                <div className="text-[11px] sm:text-xs text-red-600">
                                  ⚠️ Sin datos satelitales disponibles
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {vistaActual === 'cultivo' && (
                          <div className="mb-1.5">
                            {lote.cultivos && lote.cultivos.length > 0 ? (
                              <div className="text-[11px] sm:text-xs text-gray-600">
                                🌾 {lote.cultivos.map((c) => c.tipoCultivo).join(', ')}
                              </div>
                            ) : (
                              <div className="text-[11px] sm:text-xs text-gray-600 font-medium">
                                🌿 Natural
                              </div>
                            )}
                          </div>
                        )}

                        {vistaActual === 'indice' && (
                          <div className="mb-1.5">
                            {lote.moduloPastoreoId ? (
                              <div className="text-[11px] sm:text-xs text-gray-600">
                                📦 {modulos.find(m => m.id === lote.moduloPastoreoId)?.nombre || 'Módulo'}
                              </div>
                            ) : (
                              <div className="text-[11px] sm:text-xs text-gray-400 italic">
                                Sin módulo asignado
                              </div>
                            )}
                          </div>
                        )}

                        {totalAnimales > 0 ? (
                          <div className="text-[11px] sm:text-xs text-gray-600">
                            🐄 {totalAnimales}{' '}
                            {lote.animalesLote && lote.animalesLote.length > 0 && (
                              <span className="text-gray-500">
                                (
                                {lote.animalesLote
                                  .map((a) => a.categoria)
                                  .join(', ')}
                                )
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] sm:text-xs text-gray-400 italic">
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
    </div>
  )
}