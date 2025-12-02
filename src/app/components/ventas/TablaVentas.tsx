'use client'

import { useState, Fragment } from 'react'

interface Venta {
  id: string
  fecha: string
  comprador: string
  fechaVencimiento: string | null
  metodoPago: string
  pagado: boolean
  subtotalUSD: number
  totalNetoUSD: number
  imageUrl: string | null
  notas: string | null
  renglones: Array<{
    id: string
    categoria: string
    tipoAnimal: string
    cantidad: number
    precioKgUSD: number
    pesoPromedio: number
    precioAnimalUSD: number
    pesoTotalKg: number
    importeBrutoUSD: number
    descontadoDeStock: boolean
    animalLote: {
      id: string
      categoria: string
      lote: {
        nombre: string
      }
    } | null
  }>
}

interface TablaVentasProps {
  ventas: Venta[]
  onRefresh: () => void
}

export default function TablaVentas({ ventas, onRefresh }: TablaVentasProps) {
  const [verImagen, setVerImagen] = useState<string | null>(null)

  const formatNumber = (num: number) => {
    return num.toLocaleString('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // Agrupar ventas por tipo animal
  const ventasBovino = ventas.filter(v => 
    v.renglones.some(r => r.tipoAnimal === 'BOVINO')
  )
  const ventasOvino = ventas.filter(v => 
    v.renglones.some(r => r.tipoAnimal === 'OVINO')
  )

  const renderTabla = (titulo: string, ventasFiltradas: Venta[]) => {
    if (ventasFiltradas.length === 0) return null

    // Calcular totales
    const totales = ventasFiltradas.reduce((acc, venta) => {
      venta.renglones.forEach(renglon => {
        acc.cantidad += renglon.cantidad
        acc.pesoTotal += renglon.pesoTotalKg
        acc.importeBruto += renglon.importeBrutoUSD
      })
      acc.importeNeto += venta.totalNetoUSD
      return acc
    }, {
      cantidad: 0,
      pesoTotal: 0,
      importeBruto: 0,
      importeNeto: 0,
    })

    const precioPromedio = totales.pesoTotal > 0 ? totales.importeBruto / totales.pesoTotal : 0
    const pesoPromedio = totales.cantidad > 0 ? totales.pesoTotal / totales.cantidad : 0
    const precioAnimalPromedio = totales.cantidad > 0 ? totales.importeBruto / totales.cantidad : 0

    return (
      <div className="mb-8">
        <div className="bg-blue-50 px-6 py-3 border-b border-blue-200">
          <h3 className="text-lg font-bold text-blue-900">{titulo}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Fecha de venta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Comprador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Fecha Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">nº anim</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Precio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Peso/animal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Precio/animal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Peso lote</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$ Bruto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$ Neto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {ventasFiltradas.map((venta) => (
  <Fragment key={venta.id}>
    {venta.renglones.map((renglon, idx) => (
                    <tr key={renglon.id} className="hover:bg-gray-50">
                      {idx === 0 && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-700" rowSpan={venta.renglones.length}>
                            {formatFecha(venta.fecha)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700" rowSpan={venta.renglones.length}>
                            {venta.comprador}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700" rowSpan={venta.renglones.length}>
                            {venta.fechaVencimiento ? formatFecha(venta.fechaVencimiento) : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-gray-900">{renglon.categoria}</span>
                          {renglon.descontadoDeStock && renglon.animalLote && (
                            <span className="text-xs text-green-600">
                              ✓ Descontado de {renglon.animalLote.lote.nombre}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{renglon.cantidad}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatNumber(renglon.precioKgUSD)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatNumber(renglon.pesoPromedio)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatNumber(renglon.precioAnimalUSD)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-yellow-600">{formatNumber(renglon.pesoTotalKg)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatNumber(renglon.importeBrutoUSD)}</td>
                      {idx === 0 && (
                        <>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600" rowSpan={venta.renglones.length}>
                            {formatNumber(venta.totalNetoUSD)}
                          </td>
                          <td className="px-4 py-3 text-center" rowSpan={venta.renglones.length}>
                            <div className="flex items-center justify-center gap-2">
                              {venta.imageUrl && (
                                <button
                                  onClick={() => setVerImagen(venta.imageUrl)}
                                  className="text-blue-600 hover:text-blue-800 transition"
                                  title="Ver boleta"
                                >
                                  📄
                                </button>
                              )}
                              {!venta.pagado && (
                                <span className="text-red-600" title="Pendiente de pago">
                                  ⏳
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* TOTALES */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={4} className="px-4 py-3 text-gray-900">Totales</td>
                <td className="px-4 py-3 text-right text-gray-900">{totales.cantidad}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(precioPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(pesoPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(precioAnimalPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totales.pesoTotal)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totales.importeBruto)}</td>
                <td className="px-4 py-3 text-right text-blue-900">{formatNumber(totales.importeNeto)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6">
        {ventas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No hay ventas registradas</p>
            <p className="text-gray-400 text-sm">Creá tu primera venta para comenzar</p>
          </div>
        ) : (
          <>
            {renderTabla('VACUNOS', ventasBovino)}
            {renderTabla('OVINOS', ventasOvino)}
          </>
        )}
      </div>

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
              alt="Boleta de venta" 
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}