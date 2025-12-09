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
  ultimosDatos: Array<{
    id: string
    fecha: string
    tipo: string
    icono: string
    descripcion: string
    usuario: string | null
    lote: string | null
  }>
}

export default function DashboardMejorado({ session }: { session: any }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

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

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha)
    const hoy = new Date()
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)

    // Verificar si es hoy
    if (date.toDateString() === hoy.toDateString()) {
      return 'Hoy'
    }
    // Verificar si es ayer
    if (date.toDateString() === ayer.toDateString()) {
      return 'Ayer'
    }
    // Formato normal
    return date.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

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

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { 
            icon: "🏞️", 
            label: "Potreros", 
            value: data.resumen.totalPotreros, 
            color: "bg-green-100" 
          },
          { 
            icon: "💰", 
            label: "Gastos del mes", 
            value: `$${data.resumen.totalGastosMes.toLocaleString()}`, 
            color: "bg-blue-100" 
          },
          { 
            icon: "📦", 
            label: "Insumos", 
            value: data.resumen.totalInsumos, 
            color: "bg-purple-100" 
          },
          { 
            icon: "📝", 
            label: "Datos registrados", 
            value: data.resumen.totalDatos, 
            color: "bg-yellow-100" 
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${item.color} flex items-center justify-center text-xl sm:text-2xl`}
              >
                {item.icon}
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{item.value}</h3>
            <p className="text-xs sm:text-sm text-gray-600">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ÚLTIMOS DATOS Y MAPA - LADO A LADO EN DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ÚLTIMOS DATOS INGRESADOS */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              Últimos Datos
              <span className="text-gray-400 text-sm">❓</span>
            </h2>
            <a
              href="/dashboard/datos"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Ver Más
            </a>
          </div>

          <div className="space-y-3">
            {data.ultimosDatos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg mb-2">📝</p>
                <p className="text-sm">No hay datos registrados aún</p>
              </div>
            ) : (
              data.ultimosDatos.map((dato) => (
                <div
                  key={dato.id}
                  className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Fecha */}
                  <div className="flex-shrink-0 text-center min-w-[70px] sm:min-w-[80px]">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">
                      {formatearFecha(dato.fecha)}
                    </p>
                  </div>

                  {/* Ícono */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center text-xl sm:text-2xl border border-yellow-200">
                      {dato.icono}
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 font-medium line-clamp-2">
                      {dato.descripcion}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {dato.usuario && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">👤</span>
                          {dato.usuario}
                        </span>
                      )}
                      {dato.lote && (
                        <span className="flex items-center gap-1">
                          {dato.usuario && <span className="text-gray-300">•</span>}
                          <span className="text-gray-400">🏞️</span>
                          {dato.lote}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MAPA DEL CAMPO */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
            Mapa de {data.nombreCampo}
          </h2>
          <div className="w-full h-[400px] lg:h-[500px] rounded-lg overflow-hidden border border-gray-200">
            <MapaPoligono
              readOnly={true}
              existingPolygons={data.potreros}
              initialZoom={14}
            />
          </div>
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

        {totalLluviaAnual < 500 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Precipitaciones por debajo del promedio histórico (500-600mm)
            </p>
          </div>
        )}
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

      {/* CERRAR SESIÓN */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Sesión activa</h3>
            <p className="text-xs sm:text-sm text-gray-600">{session.user?.email}</p>
          </div>
          <a
            href="/api/auth/signout"
            className="w-full sm:w-auto text-center px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm sm:text-base"
          >
            Cerrar Sesión
          </a>
        </div>
      </div>
    </div>
  )
}