'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import ModalVenta from '@/app/components/modales/ModalVenta'
import ResumenVentas from '@/app/components/ventas/ResumenVentas'
import TablaVentas from '@/app/components/ventas/TablaVentas'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function VentasPage() {
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

  // Cargar ventas con filtros
  const { data, isLoading, mutate } = useSWR(
    `/api/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  )

  const ventas = data?.ventas || []
  const resumen = data?.resumen || null

  const handleSuccess = () => {
    mutate()
    setModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <p className="text-gray-600">Cargando ventas...</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 text-gray-900">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-6">
          <div className="text-center md:text-left space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Ventas de Ganado
            </h1>
            <p className="text-gray-600 text-sm">
              Gestión de ventas de vacunos, ovinos y lana
            </p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition text-sm font-medium"
            >
              <span className="text-lg">+</span> Nueva Venta
            </button>
          </div>
        </div>

        {/* FILTROS DE FECHA */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const hoy = new Date()
                  const año = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1
                  setFechaInicio(`${año}-07-01`)
                  setFechaFin(`${año + 1}-06-30`)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                Ejercicio Actual
              </button>
            </div>
          </div>
        </div>

        {/* RESUMEN (TABLAS TIPO EXCEL) */}
        {resumen && <ResumenVentas resumen={resumen} />}

        {/* DETALLE DE VENTAS */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mt-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Detalle de Ventas</h2>
          </div>
          <TablaVentas ventas={ventas} onRefresh={mutate} />
        </div>
      </div>

      {/* MODAL NUEVA VENTA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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