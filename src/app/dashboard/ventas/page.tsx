'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import ModalVenta from '@/app/components/modales/ModalVenta'
import ResumenVentas from '@/app/components/ventas/ResumenVentas'
import TablaVentas from '@/app/components/ventas/TablaVentas'
import TablaVentasLana from '@/app/components/ventas/TablaVentasLana'
import TablaVentasGranos from '@/app/components/ventas/TablaVentasGranos'
import { useTipoCampo } from '@/app/contexts/TipoCampoContext'

// ✅ Fetcher mejorado con manejo robusto de errores
const fetcher = async (url: string) => {
  const res = await fetch(url)
  
  // Obtener el texto de la respuesta primero
  const text = await res.text()
  
  // Si no es OK, intentar parsear el error
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`
    try {
      const errorData = JSON.parse(text)
      errorMessage = errorData.error || errorMessage
    } catch {
      errorMessage = text || errorMessage
    }
    throw new Error(errorMessage)
  }
  
  // Si está vacío, retornar datos por defecto
  if (!text || text.trim() === '') {
    console.warn('⚠️ Respuesta vacía del servidor')
    return { ventas: [], resumen: null }
  }
  
  // Intentar parsear el JSON
  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('❌ Error parseando JSON:', text.substring(0, 100))
    throw new Error('Respuesta inválida del servidor')
  }
}

export default function VentasPage() {
  const { esMixto } = useTipoCampo()
  const [modalOpen, setModalOpen] = useState(false)
  
  // Calcular fechas iniciales UNA SOLA VEZ
  const fechaInicioDefault = useMemo(() => {
    const hoy = new Date()
    const año = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1
    return `${año}-07-01`
  }, [])
  
  const fechaFinDefault = useMemo(() => {
    const hoy = new Date()
    const año = hoy.getMonth() >= 6 ? hoy.getFullYear() + 1 : hoy.getFullYear()
    return `${año}-06-30`
  }, [])

  // Filtros de fecha (ejercicio fiscal: 1/7 a 30/6)
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault)
  const [fechaFin, setFechaFin] = useState(fechaFinDefault)

  // Estados para acordeones
  const [vacunosAbierto, setVacunosAbierto] = useState(false)
  const [ovinosAbierto, setOvinosAbierto] = useState(false)
  const [lanaAbierto, setLanaAbierto] = useState(false)
  const [granosAbierto, setGranosAbierto] = useState(false)
  

  // Cargar ventas con filtros
  const { data, isLoading, mutate, error } = useSWR(
    `/api/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      shouldRetryOnError: false, // ✅ No reintentar automáticamente
      onError: (err) => {
        console.error('❌ ERROR SWR:', err.message || err)
      }
    }
  )

  // LOG para debugging
  console.log('🔍 SWR State:', { 
    hasData: !!data, 
    isLoading, 
    errorMessage: error?.message,
    fechaInicio,
    fechaFin 
  })

  const ventas = data?.ventas || []
  const resumen = data?.resumen || null

  // Separar ventas por tipo de animal
  const ventasVacunos = ventas.filter((v: any) => 
    v.renglones.some((r: any) => r.tipo === 'GANADO' && r.tipoAnimal === 'BOVINO')
  )
  const ventasOvinos = ventas.filter((v: any) => 
    v.renglones.some((r: any) => r.tipo === 'GANADO' && r.tipoAnimal === 'OVINO')
  )
  const ventasLana = ventas.filter((v: any) => 
    v.renglones.some((r: any) => r.tipo === 'LANA')
  )
  
  // ✅ Solo filtrar granos si es mixto
  const ventasGranos = esMixto ? ventas.filter((v: any) => 
    v.renglones.some((r: any) => r.tipo === 'GRANOS')
  ) : []

  const handleSuccess = () => {
    mutate()
    setModalOpen(false)
  }

  // ✅ Mostrar error específico si hay problemas
  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚠️</span>
            <h2 className="text-lg font-semibold text-red-900">Error al cargar ventas</h2>
          </div>
          <p className="text-red-700 mb-4">{error.message}</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white min-h-screen p-3 sm:p-4 md:p-6 lg:p-8 text-gray-900" style={{ colorScheme: 'light' }}>
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 sm:mb-6 md:mb-8 gap-3 sm:gap-6">
          <div className="text-center md:text-left space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Ventas
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm">
              Gestión de ventas de vacunos, ovinos y lana
            </p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-2 sm:gap-3">
            <Link
              href="/dashboard/ventas-por-firmas"
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition text-xs sm:text-sm font-medium"
            >
              📊 <span className="hidden sm:inline">Ver por</span> Firmas
            </Link>

            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition text-xs sm:text-sm font-medium"
            >
              <span className="text-base sm:text-lg">+</span> Nueva Venta
            </button>
          </div>
        </div>

        {/* FILTROS DE FECHA */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Filtros</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                style={{ colorScheme: 'light' }}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                style={{ colorScheme: 'light' }}
              />
            </div>
            <div className="flex items-end col-span-2 sm:col-span-1">
              <button
                onClick={() => {
                  const hoy = new Date()
                  const año = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1
                  setFechaInicio(`${año}-07-01`)
                  setFechaFin(`${año + 1}-06-30`)
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs sm:text-sm font-medium w-full sm:w-auto"
              >
                Ejercicio Actual
              </button>
            </div>
          </div>
        </div>

        {/* RESUMEN (TABLAS TIPO EXCEL) */}
        {resumen && <ResumenVentas resumen={resumen} />}

        {/* DETALLE DE VENTAS CON ACORDEONES */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mt-4 sm:mt-6">
          <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Detalle de Ventas</h2>
          </div>

          {/* ACORDEÓN VACUNOS */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setVacunosAbierto(!vacunosAbierto)}
              className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-lg sm:text-2xl">🐄</span>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">VACUNOS</h3>
                <span className="text-xs sm:text-sm text-gray-500">({ventasVacunos.length})</span>
              </div>
              <span className="text-gray-400 text-base sm:text-xl">
                {vacunosAbierto ? '▼' : '▶'}
              </span>
            </button>
            {vacunosAbierto && (
              <div className="border-t border-gray-200 overflow-x-auto">
                <TablaVentas ventas={ventasVacunos} onRefresh={mutate} />
              </div>
            )}
          </div>

          {/* ACORDEÓN OVINOS */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setOvinosAbierto(!ovinosAbierto)}
              className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-lg sm:text-2xl">🐑</span>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">OVINOS</h3>
                <span className="text-xs sm:text-sm text-gray-500">({ventasOvinos.length})</span>
              </div>
              <span className="text-gray-400 text-base sm:text-xl">
                {ovinosAbierto ? '▼' : '▶'}
              </span>
            </button>
            {ovinosAbierto && (
              <div className="border-t border-gray-200 overflow-x-auto">
                <TablaVentas ventas={ventasOvinos} onRefresh={mutate} />
              </div>
            )}
          </div>

          {/* ACORDEÓN LANA */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setLanaAbierto(!lanaAbierto)}
              className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-lg sm:text-2xl">🧶</span>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">LANA</h3>
                <span className="text-xs sm:text-sm text-gray-500">({ventasLana.length})</span>
              </div>
              <span className="text-gray-400 text-base sm:text-xl">
                {lanaAbierto ? '▼' : '▶'}
              </span>
            </button>
            {lanaAbierto && (
              <div className="border-t border-gray-200 overflow-x-auto">
                <TablaVentasLana ventas={ventasLana} onRefresh={mutate} />
              </div>
            )}
          </div>

          {/* ACORDEÓN GRANOS - Solo para campos mixtos */}
          {esMixto && (
            <div>
              <button
                onClick={() => setGranosAbierto(!granosAbierto)}
                className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-2xl">🌾</span>
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">GRANOS</h3>
                  <span className="text-xs sm:text-sm text-gray-500">({ventasGranos.length})</span>
                </div>
                <span className="text-gray-400 text-base sm:text-xl">
                  {granosAbierto ? '▼' : '▶'}
                </span>
              </button>
              {granosAbierto && (
                <div className="border-t border-gray-200 overflow-x-auto">
                  <TablaVentasGranos ventas={ventasGranos} onRefresh={mutate} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVA VENTA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" style={{ colorScheme: 'light' }}>
            <ModalVenta
              onClose={() => setModalOpen(false)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}
    </>
  )
}