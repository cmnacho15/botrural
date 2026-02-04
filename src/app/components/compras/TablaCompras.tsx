'use client'

import { useState, Fragment } from 'react'

interface Compra {
  id: string
  fecha: string
  proveedor: string
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
    agregarAlStock: boolean
    animalLote: {
      id: string
      categoria: string
      lote: {
        nombre: string
      }
    } | null
  }>
}

interface TablaComprasProps {
  compras: Compra[]
  onRefresh: () => void
}

export default function TablaCompras({ compras, onRefresh }: TablaComprasProps) {
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

  // Agrupar compras por tipo animal
  const comprasBovino = compras.filter(c => 
    c.renglones.some(r => r.tipoAnimal === 'BOVINO')
  )
  const comprasOvino = compras.filter(c => 
    c.renglones.some(r => r.tipoAnimal === 'OVINO')
  )

  const renderTabla = (titulo: string, comprasFiltradas: Compra[]) => {
    if (comprasFiltradas.length === 0) return null

    // Calcular totales
    const totales = comprasFiltradas.reduce((acc, compra) => {
      compra.renglones.forEach(renglon => {
        acc.cantidad += renglon.cantidad
        acc.pesoTotal += renglon.pesoTotalKg
        acc.importeBruto += renglon.importeBrutoUSD
      })
      acc.importeNeto += compra.totalNetoUSD
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
      <div className="mb-4 sm:mb-8">
        <div className="bg-green-50 px-3 sm:px-6 py-2 sm:py-3 border-b border-green-200">
          <h3 className="text-sm sm:text-lg font-bold text-green-900">{titulo}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Fecha</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Proveedor</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Venc.</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Categ.</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Nº</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">$/kg</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">kg/an</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">$/an</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">kg Tot</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Bruto</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Neto</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {comprasFiltradas.map((compra) => (
                <Fragment key={compra.id}>
                  {compra.renglones.map((renglon, idx) => (
                    <tr key={renglon.id} className="hover:bg-gray-50">
                      {idx === 0 && (
                        <>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700" rowSpan={compra.renglones.length}>
                            {formatFecha(compra.fecha)}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700" rowSpan={compra.renglones.length}>
                            {compra.proveedor}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700" rowSpan={compra.renglones.length}>
                            {compra.fechaVencimiento ? formatFecha(compra.fechaVencimiento) : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                          <span className="font-medium text-gray-900">{renglon.categoria}</span>
                          {renglon.agregarAlStock && renglon.animalLote && (
                            <span className="text-[10px] sm:text-xs text-green-600">
                              ✓ {renglon.animalLote.lote.nombre}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{renglon.cantidad}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(renglon.precioKgUSD)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(renglon.pesoPromedio)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatNumber(renglon.precioAnimalUSD)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-yellow-600">{formatNumber(renglon.pesoTotalKg)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">{formatNumber(renglon.importeBrutoUSD)}</td>
                      {idx === 0 && (
                        <>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-green-600" rowSpan={compra.renglones.length}>
                            {formatNumber(compra.totalNetoUSD)}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center" rowSpan={compra.renglones.length}>
                            <div className="flex items-center justify-center gap-1 sm:gap-2">
                              {compra.imageUrl && (
                                <button
                                  onClick={() => setVerImagen(compra.imageUrl)}
                                  className="text-blue-600 hover:text-blue-800 transition text-sm sm:text-base"
                                  title="Ver boleta"
                                >
                                  📄
                                </button>
                              )}
                              {!compra.pagado && (
                                <span className="text-red-600 text-sm sm:text-base" title="Pendiente de pago">
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
              <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                <td colSpan={4} className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">Totales</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{totales.cantidad}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(precioPromedio)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(pesoPromedio)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(precioAnimalPromedio)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(totales.pesoTotal)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-900">{formatNumber(totales.importeBruto)}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-green-900">{formatNumber(totales.importeNeto)}</td>
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
      <div className="p-3 sm:p-6">
        {compras.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-500 text-sm sm:text-lg mb-2 sm:mb-4">No hay compras registradas</p>
            <p className="text-gray-400 text-xs sm:text-sm">Creá tu primera compra para comenzar</p>
          </div>
        ) : (
          <>
            {renderTabla('VACUNOS', comprasBovino)}
            {renderTabla('OVINOS', comprasOvino)}
          </>
        )}
      </div>

      {/* MODAL VER IMAGEN */}
      {verImagen && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setVerImagen(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setVerImagen(null)}
              className="absolute -top-10 sm:-top-12 right-0 text-white text-xl sm:text-2xl hover:text-gray-300"
            >
              ✕ Cerrar
            </button>
            <img
              src={verImagen}
              alt="Boleta de compra"
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}