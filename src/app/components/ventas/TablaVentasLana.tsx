'use client'

import { useState } from 'react'

type TablaVentasLanaProps = {
  ventas: any[]
  onRefresh: () => void
}

export default function TablaVentasLana({ ventas, onRefresh }: TablaVentasLanaProps) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [verImagen, setVerImagen] = useState<string | null>(null)

  const toggleExpansion = (ventaId: string) => {
    setExpandido(expandido === ventaId ? null : ventaId)
  }

  const handleEliminar = async (ventaId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta venta de lana?')) return

    try {
      const res = await fetch(`/api/ventas/${ventaId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error al eliminar')

      alert('Venta eliminada correctamente')
      onRefresh()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar la venta')
    }
  }

  if (ventas.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">🧶</div>
        <p className="text-gray-600 text-lg">No hay ventas de lana registradas</p>
        <p className="text-gray-500 text-sm mt-2">
          Creá una nueva venta desde el botón "Nueva Venta"
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Comprador
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Firma
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Kg Totales
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              US$/kg Prom.
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Importe Bruto
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Importe Neto
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Factura
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ventas.map((venta) => {
            const renglonesLana = venta.renglones.filter((r: any) => r.tipo === 'LANA')
            const kgTotales = renglonesLana.reduce((sum: number, r: any) => {
              const kg = parseFloat(r.pesoTotalKg) || 0
              return sum + kg
            }, 0)
            const precioPromedio = kgTotales > 0 ? (venta.subtotalUSD / kgTotales) : 0
            const estaExpandido = expandido === venta.id

            return (
              <tr key={venta.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {new Date(venta.fecha).toLocaleDateString('es-UY')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div className="font-medium">{venta.comprador}</div>
                  {venta.consignatario && (
                    <div className="text-xs text-gray-500">
                      Consig: {venta.consignatario}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {venta.firma?.razonSocial || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {kgTotales.toLocaleString('es-UY', { minimumFractionDigits: 0 })} kg
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {precioPromedio.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                  {venta.subtotalUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-green-600">
                  {venta.totalNetoUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                  {venta.imageUrl ? (
                    <button
                      onClick={() => setVerImagen(venta.imageUrl)}
                      className="text-blue-600 hover:text-blue-800 transition text-lg"
                      title="Ver factura"
                    >
                      📄
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => toggleExpansion(venta.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                      title="Ver detalle"
                    >
                      {estaExpandido ? '▲' : '▼'}
                    </button>
                    <button
                      onClick={() => handleEliminar(venta.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* DETALLE EXPANDIDO */}
      {ventas.map((venta) => {
        if (expandido !== venta.id) return null

        const renglonesLana = venta.renglones.filter((r: any) => r.tipo === 'LANA')
        const gastosLana = venta.gastosLana || []

        return (
          <div key={`detalle-${venta.id}`} className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="max-w-6xl mx-auto">
              {/* INFORMACIÓN GENERAL */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información General</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Fecha:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(venta.fecha).toLocaleDateString('es-UY')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Comprador:</span>
                    <p className="font-medium text-gray-900">{venta.comprador}</p>
                  </div>
                  {venta.firma && (
                    <div>
                      <span className="text-gray-600">Firma:</span>
                      <p className="font-medium text-gray-900">{venta.firma.razonSocial}</p>
                    </div>
                  )}
                  {venta.nroFactura && (
                    <div>
                      <span className="text-gray-600">Nro. Factura:</span>
                      <p className="font-medium text-gray-900">{venta.nroFactura}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Método de Pago:</span>
                    <p className="font-medium text-gray-900">{venta.metodoPago}</p>
                  </div>
                  {venta.fechaVencimiento && (
                    <div>
                      <span className="text-gray-600">Vencimiento:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(venta.fechaVencimiento).toLocaleDateString('es-UY')}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Estado:</span>
                    <p className={`font-medium ${venta.pagado ? 'text-green-600' : 'text-yellow-600'}`}>
                      {venta.pagado ? '✓ Pagado' : '⏳ Pendiente'}
                    </p>
                  </div>
                </div>
                {venta.notas && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-gray-600 text-sm">Notas:</span>
                    <p className="text-sm text-gray-700 mt-1">{venta.notas}</p>
                  </div>
                )}
              </div>

              {/* DETALLE POR CATEGORÍA DE LANA */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                  <h4 className="font-semibold text-gray-900">Detalle por Categoría</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Categoría
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Peso (kg)
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        US$/kg
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Importe
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {renglonesLana.map((renglon: any, idx: number) => {
                      const pesoKg = parseFloat(renglon.pesoTotalKg) || 0
                      const precioKg = parseFloat(renglon.precioKgUSD) || 0
                      const categoriaLana = renglon.categoria || '-'
                      
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {categoriaLana}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">
                            {pesoKg.toLocaleString('es-UY', { minimumFractionDigits: 1 })}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">
                            {precioKg.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                            {(pesoKg * precioKg).toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* GASTOS DEDUCIBLES */}
              {gastosLana.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-yellow-200 overflow-hidden mb-4">
                  <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                    <h4 className="font-semibold text-gray-900">Gastos Deducibles</h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Concepto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Importe
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {gastosLana.map((gasto: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {gasto.concepto}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                            {gasto.importeUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TOTALES */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700 font-medium">Subtotal (Bruto):</span>
                  <span className="text-lg font-bold text-gray-900">
                    {venta.subtotalUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                {gastosLana.length > 0 && (
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-gray-600">Gastos:</span>
                    <span className="text-red-600 font-medium">
                      {gastosLana.reduce((sum: number, g: any) => sum + g.importeUSD, 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                  <span className="text-gray-900 font-semibold">Total Neto:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {venta.totalNetoUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* MODAL VER IMAGEN */}
      {verImagen && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setVerImagen(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setVerImagen(null)}
              className="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300"
            >
              ✕ Cerrar
            </button>
            <img 
              src={verImagen} 
              alt="Liquidación de lana" 
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}