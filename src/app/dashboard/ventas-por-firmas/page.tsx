'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'

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
}

type FirmaResumen = {
  firmaId: string | null
  razonSocial: string
  rut: string
  cantidadVentas: number
  totalUSD: number
  ventas: VentaDetalle[]
}

export default function VentasPorFirmasPage() {
  const [expandedFirmas, setExpandedFirmas] = useState<Set<string>>(new Set())
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
  const { data, isLoading, error } = useSWR(
    `/api/ventas/resumen-por-firma?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
    fetcher
  )

  const resumen = data?.resumen || []
  const totalGeneral = data?.totalGeneral || 0

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

  const toggleFirma = (firmaKey: string) => {
    setExpandedFirmas(prev => {
      const next = new Set(prev)
      if (next.has(firmaKey)) {
        next.delete(firmaKey)
      } else {
        next.add(firmaKey)
      }
      return next
    })
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
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 text-gray-900">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/ventas" className="text-blue-600 hover:text-blue-800">
            ← Volver a Ventas
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Ventas por Firma</h1>
        <p className="text-gray-600 text-sm">Análisis de ventas por razón social / RUT</p>
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

      {/* CARDS POR FIRMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {resumen.map((firma: any) => (
          <div 
            key={firma.firmaId || 'sin-asignar'} 
            className={`bg-white rounded-xl shadow-md border-2 p-6 ${
              firma.firmaId ? 'border-blue-200' : 'border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  {firma.razonSocial}
                </h3>
                <p className="text-sm text-gray-500 font-mono">{firma.rut}</p>
              </div>
              {!firma.firmaId && (
                <span className="text-2xl">❓</span>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ventas:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {firma.cantidadVentas}
                </span>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    U$S {formatNumber(firma.totalUSD)}
                  </span>
                </div>
              </div>
              
              <div className="pt-2">
                <div className="text-xs text-gray-500 text-right">
                  {totalGeneral > 0 ? ((firma.totalUSD / totalGeneral) * 100).toFixed(1) : 0}% del total
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABLA RESUMEN */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Resumen Detallado</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firma
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RUT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad Ventas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total USD
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % del Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resumen.map((firma: FirmaResumen) => {
                const firmaKey = firma.firmaId || 'sin-asignar'
                const isExpanded = expandedFirmas.has(firmaKey)

                return (
                  <>
                    <tr
                      key={firmaKey}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleFirma(firmaKey)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          <span className="text-sm font-medium text-gray-900">{firma.razonSocial}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500 font-mono">{firma.rut}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-gray-900">{firma.cantidadVentas}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          U$S {formatNumber(firma.totalUSD)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-gray-600">
                          {totalGeneral > 0 ? ((firma.totalUSD / totalGeneral) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>

                    {/* Facturas expandidas */}
                    {isExpanded && firma.ventas.map((venta) => (
                      <tr key={venta.id} className="bg-blue-50/50">
                        <td className="px-6 py-3 pl-12" colSpan={2}>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">{formatDate(venta.fecha)}</span>
                            <span className="text-sm font-medium text-gray-800">
                              {venta.nroFactura ? `Factura ${venta.nroFactura}` : 'Sin nº factura'}
                            </span>
                            <span className="text-xs text-gray-600">→ {venta.comprador}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              venta.tipoProducto === 'LANA'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {venta.tipoProducto || 'GANADO'}
                            </span>
                            {!venta.pagado && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-xs text-gray-500">
                            Bruto: U$S {formatNumber(venta.subtotalUSD)}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-xs text-red-600">
                            -{formatNumber(venta.totalImpuestosUSD)}
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            U$S {formatNumber(venta.totalNetoUSD)}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Link
                            href={`/dashboard/ventas?id=${venta.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Ver detalle →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
              
              {/* TOTAL */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={3} className="px-6 py-4 text-gray-900">
                  TOTAL GENERAL
                </td>
                <td className="px-6 py-4 text-right text-blue-900">
                  U$S {formatNumber(totalGeneral)}
                </td>
                <td className="px-6 py-4 text-right text-gray-900">
                  100%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}