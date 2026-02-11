'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Importar dinámicamente el mapa para evitar SSR issues
const MapaPoligono = dynamic(() => import('@/app/components/MapaPoligono'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">Cargando mapa...</div>
})

const EvolucionUGDashboard = dynamic(() => import('@/app/components/EvolucionUGDashboard'), {
  ssr: false,
  loading: () => <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-lg">Cargando gráfico...</div>
})

interface DashboardData {
  nombreCampo: string
  potreros: Array<{
    id: string
    nombre: string
    hectareas: number
    coordinates: number[][]
    color?: string
    info?: {
      hectareas: number
      animales: any[]
      cultivos: any[]
    }
  }>
  resumen: {
    totalPotreros: number
    totalGastosMes: number
    totalInsumos: number
    totalDatos: number
  }
  lluvia12Meses: Array<{
    mes: string
    mm: number
  }>
  ultimosDatos: Array<any>
}

export default function DashboardMejorado({ session }: { session: any }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [imagenModal, setImagenModal] = useState<string | null>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const response = await fetch('/api/dashboard-data')
      if (response.ok) {
        const datos = await response.json()
        setData(datos)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funciones auxiliares copiadas de página de datos
  const obtenerIcono = (tipo: string): string => {
    const iconos: Record<string, string> = {
      MOVIMIENTO: '🔄',
      CAMBIO_POTRERO: '⊞',
      TRATAMIENTO: '💉',
      VENTA: '🐄',
      COMPRA: '🛒',
      TRASLADO: '🚛',
      NACIMIENTO: '➕',
      MORTANDAD: '➖',
      CONSUMO: '🍖',
      ABORTO: '❌',
      DESTETE: '🔀',
      TACTO: '✋',
      RECATEGORIZACION: '🏷️',
      SIEMBRA: '🌱',
      PULVERIZACION: '💦',
      REFERTILIZACION: '🌿',
      RIEGO: '💧',
      MONITOREO: '🔍',
      COSECHA: '🌾',
      OTROS_LABORES: '🔧',
      LLUVIA: '🌧️',
      HELADA: '❄️',
      GASTO: '💸',
      INGRESO: '💰',
      USO_INSUMO: '📤',
      INGRESO_INSUMO: '📦',
    }
    return iconos[tipo] || '📊'
  }

  const obtenerColor = (tipo: string): string => {
    const colores: Record<string, string> = {
      LLUVIA: 'blue',
      HELADA: 'cyan',
      GASTO: 'red',
      INGRESO: 'green',
      VENTA: 'green',
      COMPRA: 'orange',
      TRASLADO: 'indigo',
      CAMBIO_POTRERO: 'amber',
      NACIMIENTO: 'pink',
      MORTANDAD: 'gray',
      CONSUMO: 'brown',
      USO_INSUMO: 'orange',
      INGRESO_INSUMO: 'purple',
      SIEMBRA: 'lime',
      COSECHA: 'yellow',
      TRATAMIENTO: 'pink',
      MOVIMIENTO: 'blue',
    }
    return colores[tipo] || 'gray'
  }

  const obtenerNombreTipo = (tipo: string) => {
    const nombres: Record<string, string> = {
      INGRESO: 'Ingreso de Dinero',
      INGRESO_INSUMO: 'Ingreso de Insumo',
      USO_INSUMO: 'Uso de Insumo',
      GASTO: 'Gasto',
      VENTA: 'Venta',
      COMPRA: 'Compra',
      CAMBIO_POTRERO: 'Cambio De Potrero',
      TRASLADO: 'Traslado',
      NACIMIENTO: 'Nacimiento',
      MORTANDAD: 'Mortandad',
      CONSUMO: 'Consumo',
      ABORTO: 'Aborto',
      DESTETE: 'Destete',
      TACTO: 'Tacto',
      RECATEGORIZACION: 'Recategorización',
      TRATAMIENTO: 'Tratamiento',
      MOVIMIENTO: 'Movimiento',
      SIEMBRA: 'Siembra',
      PULVERIZACION: 'Pulverización',
      REFERTILIZACION: 'Refertilización',
      RIEGO: 'Riego',
      MONITOREO: 'Monitoreo',
      COSECHA: 'Cosecha',
      OTROS_LABORES: 'Otras Labores',
      LLUVIA: 'Lluvia',
      HELADA: 'Helada',
    }
    return nombres[tipo] || tipo.replace(/_/g, ' ')
  }

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha)
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const dia = date.getUTCDate()
    const mes = meses[date.getUTCMonth()]
    const anio = date.getUTCFullYear()
    
    return {
      completo: `${dia} ${mes} ${anio}`,
      dia: dia.toString(),
      mes: mes,
      anio: anio.toString()
    }
  }

  const colorClasses: Record<string, string> = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    gray: 'bg-gray-500',
    cyan: 'bg-cyan-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    lime: 'bg-lime-500',
    brown: 'bg-orange-800',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error cargando datos del dashboard</p>
      </div>
    )
  }

  const totalLluviaAnual = data.lluvia12Meses.reduce((sum, m) => sum + m.mm, 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* BIENVENIDA */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          ¡Bienvenido de nuevo, {session.user?.name || "Usuario"}! 👋
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Aquí está el resumen de tu campo <strong>{data.nombreCampo}</strong>
        </p>
      </div>

      {/* ÚLTIMOS DATOS Y MAPA - LADO A LADO EN DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ÚLTIMOS DATOS INGRESADOS - CON DISEÑO DE PÁGINA DE DATOS */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Últimos Datos
            </h2>
            <a
              href="/dashboard/datos"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Ver Más →
            </a>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {data.ultimosDatos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg mb-2">📝</p>
                <p className="text-sm">No hay datos registrados aún</p>
              </div>
            ) : (
              data.ultimosDatos.map((dato) => {
                const fecha = formatFecha(dato.fecha)
                
                return (
                  <div key={dato.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 overflow-hidden">
                    <div className="flex items-start">
                      {/* Fecha Lateral */}
                      <div className="bg-gray-50 border-r border-gray-200 px-3 py-3 flex flex-col items-center justify-center min-w-[70px]">
                        <div className="text-xl font-bold text-gray-900">{fecha.dia}</div>
                        <div className="text-xs font-medium text-gray-600 uppercase">{fecha.mes}</div>
                        <div className="text-xs text-gray-500">{fecha.anio}</div>
                      </div>

                      {/* Contenido Principal */}
                      <div className="flex items-start gap-3 flex-1 p-3">
                        <div className={`${colorClasses[obtenerColor(dato.tipo)] || 'bg-gray-500'} w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
                          {obtenerIcono(dato.tipo)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-base">{obtenerNombreTipo(dato.tipo)}</h3>
                            {dato.imageUrl && (
                              <button
                                onClick={() => setImagenModal(dato.imageUrl)}
                                className="flex items-center gap-1.5 shrink-0"
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#0d9488',
                                  border: '1px solid #0f766e',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                Ver foto
                              </button>
                            )}
                          </div>

                          {dato.descripcion && <p className="text-gray-700 text-sm mb-2 leading-relaxed">{dato.descripcion}</p>}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {dato.usuario && <span>👤 {dato.usuario}</span>}
                            {dato.lote && <span>📍 {dato.lote}</span>}
                            {dato.rodeo && <span>🐮 {dato.rodeo}</span>}
                            {dato.caravana && <span className="font-semibold text-amber-700">🏷️ {dato.caravana}</span>}
                          </div>

                          {dato.notas && <p className="text-xs text-gray-600 mt-2 pl-3 border-l-2 border-gray-300 italic">{dato.notas}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* MAPA DEL CAMPO */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
            Mapa de {data.nombreCampo}
          </h2>
          {data.potreros.length === 0 ? (
            <div className="w-full h-[400px] lg:h-[500px] rounded-lg border border-gray-200 flex items-center justify-center bg-gray-100">
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
            <div className="w-full h-[400px] lg:h-[500px] rounded-lg overflow-hidden border border-gray-200">
  <MapaPoligono
    readOnly={true}
    existingPolygons={data.potreros}
    initialZoom={14}
    key="dashboard-map"
  />
</div>
          )}
        </div>
      </div>

      {/* RESUMEN DE LLUVIAS */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Lluvias Últimos 12 Meses
          </h2>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{totalLluviaAnual.toFixed(1)} mm</p>
            <p className="text-xs text-gray-600">Total anual</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {data.lluvia12Meses.map((mes, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200"
            >
              <p className="text-xs font-medium text-blue-900 mb-1">{mes.mes}</p>
              <p className="text-lg font-bold text-blue-700">{mes.mm.toFixed(1)}</p>
              <p className="text-xs text-blue-600">mm</p>
            </div>
          ))}
        </div>

        
      </div>

      {/* GRÁFICO DE EVOLUCIÓN UG */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
          Evolución de Carga Animal
        </h2>
        <EvolucionUGDashboard />
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
          Accesos Rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <a
            href="/dashboard/datos"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">📝</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Datos</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Registra información del campo
              </p>
            </div>
          </a>

          <a
            href="/dashboard/lotes"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">🏞️</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Potreros</h3>
              <p className="text-xs sm:text-sm text-gray-600">Gestiona tus potreros</p>
            </div>
          </a>

          <a
            href="/dashboard/gastos"
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl sm:text-2xl">💰</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Gastos</h3>
              <p className="text-xs sm:text-sm text-gray-600">Controla tus gastos</p>
            </div>
          </a>
        </div>
      </div>

      {/* Modal de imagen */}
      {imagenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setImagenModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setImagenModal(null)}
              className="absolute -top-10 right-0 text-white text-3xl font-bold hover:text-gray-300"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
            <img
              src={imagenModal}
              alt="Foto del dato"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}