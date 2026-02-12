//src/app/components/ventas/tablaventas.tsx
'use client'

import { useState, Fragment, useEffect } from 'react'
import ModalFactura from '@/app/components/modales/ModalFactura'
import { toast } from '@/app/components/Toast'

interface Firma {
  id: string
  razonSocial: string
  rut: string
}

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
  firma?: {
    id: string
    razonSocial: string
    rut: string
  } | null
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
    esBonificacion: boolean
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
  const [verImagen, setVerImagen] = useState<{url: string, venta: Venta} | null>(null)
  const [ventaAEliminar, setVentaAEliminar] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [editandoFirma, setEditandoFirma] = useState<string | null>(null)
  const [firmas, setFirmas] = useState<Firma[]>([])
  const [guardandoFirma, setGuardandoFirma] = useState(false)

  // Cargar firmas disponibles
  useEffect(() => {
    fetch('/api/firmas')
      .then(res => res.json())
      .then(data => setFirmas(data || []))
      .catch(() => setFirmas([]))
  }, [])

  // Asignar firma a una venta
  const asignarFirma = async (ventaId: string, firmaId: string) => {
    setGuardandoFirma(true)
    try {
      const res = await fetch(`/api/ventas/${ventaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmaId }),
      })
      if (!res.ok) throw new Error('Error asignando firma')
      onRefresh()
      setEditandoFirma(null)
    } catch (err) {
      toast.error('Error al asignar firma')
    } finally {
      setGuardandoFirma(false)
    }
  }

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

  const handleEliminarVenta = async (ventaId: string) => {
    setEliminando(true)
    try {
      const response = await fetch(`/api/ventas/${ventaId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar')
      }

      // Refrescar la lista
      onRefresh()
      setVentaAEliminar(null)
      toast.success('✅ Venta eliminada correctamente')
    } catch (error: any) {
      console.error('Error:', error)
      toast.error(`❌ ${error.message}`)
    } finally {
      setEliminando(false)
    }
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Firma</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Fecha de venta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Comprador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Fecha Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">nº anim</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$/kg en pie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">kg/anim en pie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$/anim en pie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">kg totales en pie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$ Bruto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase whitespace-nowrap">US$ Neto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase whitespace-nowrap">Factura</th>
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
                          <td className="px-4 py-3 text-sm text-gray-700 relative" rowSpan={venta.renglones.length}>
                            {venta.firma ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{venta.firma.razonSocial}</span>
                                <span className="text-xs text-gray-500 font-mono">{venta.firma.rut}</span>
                              </div>
                            ) : (
                              <div className="relative">
                                <button
                                  onClick={() => setEditandoFirma(editandoFirma === venta.id ? null : venta.id)}
                                  className="text-blue-600 hover:text-blue-800 italic text-xs underline cursor-pointer"
                                >
                                  Sin asignar ✏️
                                </button>

                                {/* Dropdown de firmas */}
{editandoFirma === venta.id && (
  <>
    {/* Backdrop para cerrar */}
    <div 
      className="fixed inset-0 z-[60]"
      onClick={() => setEditandoFirma(null)}
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
              disabled={guardandoFirma}
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
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700" rowSpan={venta.renglones.length}>
                            {formatFecha(venta.fecha)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700" rowSpan={venta.renglones.length}>
                            {venta.comprador}
                          </td>
                          <td className="px-4 py-3 text-sm" rowSpan={venta.renglones.length}>
                            {(() => {
                              // Si es Contado, mostrar "-"
                              if (venta.metodoPago === 'Contado') {
                                return <span className="text-gray-400">-</span>
                              }

                              // Si es a Plazo, calcular vencimiento
                              if (venta.metodoPago === 'Plazo' && venta.fechaVencimiento) {
                                const fechaVenc = new Date(venta.fechaVencimiento)
                                const dia = String(fechaVenc.getDate()).padStart(2, '0')
                                const mes = String(fechaVenc.getMonth() + 1).padStart(2, '0')
                                const año = fechaVenc.getFullYear()
                                
                                const hoy = new Date()
                                hoy.setHours(0, 0, 0, 0)
                                fechaVenc.setHours(0, 0, 0, 0)
                                
                                const diffTime = fechaVenc.getTime() - hoy.getTime()
                                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                
                                const esVencido = diasRestantes < 0
                                const esCercano = diasRestantes >= 0 && diasRestantes <= 7

                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`text-sm font-semibold ${
                                      esVencido ? 'text-red-600' : 
                                      esCercano ? 'text-orange-600' : 
                                      'text-blue-600'
                                    }`}>
                                      {esVencido 
                                        ? `⚠️ Vencido hace ${Math.abs(diasRestantes)} días`
                                        : `📅 Faltan ${diasRestantes} días`
                                      }
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Vence: {dia}/{mes}/{año}
                                    </span>
                                  </div>
                                )
                              }

                              return <span className="text-gray-400">-</span>
                            })()}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-gray-900">
                            {renglon.esBonificacion ? `Bonificación ${renglon.categoria}` : renglon.categoria}
                          </span>
                          {renglon.descontadoDeStock && renglon.animalLote && (
                            <span className="text-xs text-green-600">
                              ✓ Descontado de {renglon.animalLote.lote.nombre}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {renglon.esBonificacion ? '-' : renglon.cantidad}
                      </td>
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
                            {venta.imageUrl ? (
                              <button
                                onClick={() => setVerImagen({ url: venta.imageUrl!, venta })}
                                className="text-blue-600 hover:text-blue-800 transition text-lg"
                                title="Ver factura"
                              >
                                📄
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center" rowSpan={venta.renglones.length}>
                            <button
                              onClick={() => setVentaAEliminar(venta.id)}
                              className="text-red-600 hover:text-red-800 transition text-lg"
                              title="Eliminar venta"
                            >
                              🗑️
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* TOTALES */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={5} className="px-4 py-3 text-gray-900">Totales</td>
                <td className="px-4 py-3 text-right text-gray-900">{totales.cantidad}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(precioPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(pesoPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(precioAnimalPromedio)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totales.pesoTotal)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totales.importeBruto)}</td>
                <td className="px-4 py-3 text-right text-blue-900">{formatNumber(totales.importeNeto)}</td>
                <td></td>
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

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {ventaAEliminar && (() => {
        // Buscar la venta completa
        const ventaCompleta = ventas.find(v => v.id === ventaAEliminar)
        const tieneStockDescontado = ventaCompleta?.renglones.some(r => r.descontadoDeStock) || false

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-lg font-bold text-gray-900">¿Eliminar esta venta?</h3>
              </div>
              
              <div className="mb-6 text-sm text-gray-700 space-y-2">
                <p className="font-medium">Esto eliminará:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {tieneStockDescontado && <li>Stock devuelto a potreros</li>}
                  <li>Registro de venta</li>
                  {ventaCompleta?.imageUrl && <li>Factura adjunta</li>}
                </ul>
                <p className="text-red-600 font-medium mt-3">
                  Esta acción NO se puede deshacer.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setVentaAEliminar(null)}
                  disabled={eliminando}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleEliminarVenta(ventaAEliminar)}
                  disabled={eliminando}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}