'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import ModalFactura from '@/app/components/modales/ModalFactura'
import { toast } from '@/app/components/Toast'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error cargando datos')
  return res.json()
}

type VentaDetalle = {
  id: string
  fecha: string
  nroFactura: string | null
  comprador: string
  tipoProducto: string | null
  subtotalUSD: number
  totalImpuestosUSD: number
  totalNetoUSD: number
  pagado: boolean
  imageUrl: string | null
}

type FirmaResumen = {
  firmaId: string | null
  razonSocial: string
  rut: string
  cantidadVentas: number
  totalUSD: number
  ventas: VentaDetalle[]
}

type Firma = {
  id: string
  razonSocial: string
  rut: string
}

export default function VentasPorFirmasPage() {
  const [verImagen, setVerImagen] = useState<{url: string, venta: VentaDetalle} | null>(null)
  const [editandoVenta, setEditandoVenta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Calcular fechas iniciales (ejercicio fiscal: 1/7 a 30/6)
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

  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault)
  const [fechaFin, setFechaFin] = useState(fechaFinDefault)

  // Cargar resumen
  const { data, isLoading, error, mutate } = useSWR(
    `/api/ventas/resumen-por-firma?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
    fetcher
  )

  // Cargar firmas disponibles
  const { data: firmasData } = useSWR<Firma[]>('/api/firmas', fetcher)
  const firmas = firmasData || []

  const resumen = data?.resumen || []
  const totalGeneral = data?.totalGeneral || 0

  // Asignar firma a una venta
  const asignarFirma = async (ventaId: string, firmaId: string) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/ventas/${ventaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmaId }),
      })
      if (!res.ok) throw new Error('Error asignando firma')
      await mutate() // Recargar datos
      setEditandoVenta(null)
    } catch (err) {
      toast.error('Error al asignar firma')
    } finally {
      setGuardando(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (fecha: string) => {
    const d = new Date(fecha)
    return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error al cargar datos</h2>
          <p className="text-red-700">{error.message}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando resumen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen p-3 sm:p-4 md:p-6 lg:p-8 text-gray-900" style={{ colorScheme: 'light' }}>
      {/* HEADER */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Link href="/dashboard/ventas" className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm">
            ← Volver a Ventas
          </Link>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Ventas por Firma</h1>
        <p className="text-gray-600 text-xs sm:text-sm">Análisis de ventas por razón social / RUT</p>
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

      {/* CARDS POR FIRMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        {resumen.map((firma: any) => (
          <div
            key={firma.firmaId || 'sin-asignar'}
            className={`bg-white rounded-xl shadow-md border-2 p-3 sm:p-4 md:p-6 ${
              firma.firmaId ? 'border-blue-200' : 'border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-2 sm:mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base md:text-lg mb-0.5 sm:mb-1 truncate">
                  {firma.razonSocial}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 font-mono truncate">{firma.rut}</p>
              </div>
              {!firma.firmaId && (
                <span className="text-lg sm:text-2xl ml-2">❓</span>
              )}
            </div>

            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600">Ventas:</span>
                <span className="text-base sm:text-lg font-semibold text-gray-900">
                  {firma.cantidadVentas}
                </span>
              </div>

              <div className="pt-2 sm:pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600">Total:</span>
                  <span className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
                    U$S {formatNumber(firma.totalUSD)}
                  </span>
                </div>
              </div>

              <div className="pt-1 sm:pt-2">
                <div className="text-[10px] sm:text-xs text-gray-500 text-right">
                  {totalGeneral > 0 ? ((firma.totalUSD / totalGeneral) * 100).toFixed(1) : 0}% del total
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABLA RESUMEN */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Resumen Detallado</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firma
                </th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  RUT
                </th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cant.
                </th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facturas
                </th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resumen.map((firma: FirmaResumen) => (
                <tr key={firma.firmaId || 'sin-asignar'} className="hover:bg-gray-50">
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4">
                    <span className="text-xs sm:text-sm font-medium text-gray-900">{firma.razonSocial}</span>
                  </td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 hidden sm:table-cell">
                    <span className="text-xs sm:text-sm text-gray-500 font-mono">{firma.rut}</span>
                  </td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-right">
                    <span className="text-xs sm:text-sm text-gray-900">{firma.cantidadVentas}</span>
                  </td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4">
                    <div className="flex flex-wrap gap-1 sm:gap-1.5">
                      {firma.ventas.map((venta) => (
                        <div key={venta.id} className="inline-flex items-center gap-0.5 relative">
                          {/* Chip de factura */}
                          <span
                            className={`inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 border-y border-l ${
                              !firma.firmaId ? 'rounded-l-md' : 'rounded-l-md'
                            } ${
                              venta.pagado
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}
                            title={`${formatDate(venta.fecha)} - ${venta.comprador} - U$S ${formatNumber(venta.totalNetoUSD)}${!venta.pagado ? ' (Pendiente)' : ''}`}
                          >
                            <span className="font-medium">
                              {venta.nroFactura || 'S/N'}
                            </span>
                            <span className="text-[8px] sm:text-[10px] opacity-70 hidden sm:inline">
                              {formatDate(venta.fecha).slice(0, 5)}
                            </span>
                          </span>

                          {/* Botón asignar firma (solo para ventas sin asignar) */}
{!firma.firmaId && (
  <>
    <button
      onClick={(e) => {
        e.stopPropagation()
        setEditandoVenta(editandoVenta === venta.id ? null : venta.id)
      }}
      className="px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs border-y bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition relative z-10"
      title="Asignar firma"
    >
      ✏️
    </button>

    {/* Dropdown de firmas - Fixed overlay */}
    {editandoVenta === venta.id && (
      <>
        {/* Backdrop para cerrar */}
        <div 
          className="fixed inset-0 z-[60]"
          onClick={() => setEditandoVenta(null)}
        />
        
        {/* Dropdown */}
        <div className="fixed z-[70] bg-white border-2 border-blue-300 rounded-lg shadow-2xl w-72 max-h-80 overflow-y-auto"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="sticky top-0 bg-blue-50 px-3 py-2 border-b border-blue-200">
            <p className="text-xs font-semibold text-blue-900">Seleccionar Firma</p>
          </div>
          
          {firmas.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No hay firmas configuradas
            </div>
          ) : (
            <div className="py-1">
              {firmas.map((f) => (
                <button
                  key={f.id}
                  onClick={() => asignarFirma(venta.id, f.id)}
                  disabled={guardando}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition disabled:opacity-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-semibold text-gray-900 mb-0.5">{f.razonSocial}</div>
                  <div className="text-xs text-gray-500 font-mono">{f.rut}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    )}
  </>
)}

                          {/* Botón ver imagen */}
                          {venta.imageUrl ? (
                            <button
                              onClick={() => setVerImagen({ url: venta.imageUrl!, venta })}
                              className={`px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-r-md border transition hover:opacity-80 ${
                                venta.pagado
                                  ? 'bg-green-100 border-green-200 text-green-700 hover:bg-green-200'
                                  : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'
                              }`}
                              title="Ver factura"
                            >
                              📎
                            </button>
                          ) : (
                            <span
                              className={`px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-r-md border opacity-30 ${
                                venta.pagado
                                  ? 'bg-green-50 border-green-200 text-green-400'
                                  : 'bg-amber-50 border-amber-200 text-amber-400'
                              }`}
                              title="Sin imagen adjunta"
                            >
                              📎
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-right">
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">
                      <span className="hidden sm:inline">U$S </span>{formatNumber(firma.totalUSD)}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-right hidden sm:table-cell">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {totalGeneral > 0 ? ((firma.totalUSD / totalGeneral) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                </tr>
              ))}

              {/* TOTAL */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={2} className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 sm:hidden">
                  TOTAL
                </td>
                <td colSpan={4} className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                  TOTAL GENERAL
                </td>
                <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-right text-xs sm:text-sm text-blue-900">
                  <span className="hidden sm:inline">U$S </span>{formatNumber(totalGeneral)}
                </td>
                <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-right text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                  100%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VER IMAGEN */}
      <ModalFactura
        isOpen={!!verImagen}
        onClose={() => setVerImagen(null)}
        imageUrl={verImagen?.url || ''}
        ventaData={verImagen ? {
          comprador: verImagen.venta.comprador,
          fecha: verImagen.venta.fecha,
          monto: verImagen.venta.totalNetoUSD,
        } : undefined}
      />
    </div>
  )
}