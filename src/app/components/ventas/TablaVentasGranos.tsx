//src/app/components/ventas/tablaventasgranos.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/app/components/Toast'

type TablaVentasGranosProps = {
  ventas: any[]
  onRefresh: () => void
}

export default function TablaVentasGranos({ ventas, onRefresh }: TablaVentasGranosProps) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [verImagen, setVerImagen] = useState<string | null>(null)
  const [modalAsignarLotes, setModalAsignarLotes] = useState<string | null>(null)

  const toggleExpansion = (ventaId: string) => {
    setExpandido(expandido === ventaId ? null : ventaId)
  }

  const handleEliminar = async (ventaId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta venta de granos?')) return

    try {
      const res = await fetch(`/api/ventas/${ventaId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error al eliminar')

      toast.success('Venta eliminada correctamente')
      onRefresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar la venta')
    }
  }

  if (ventas.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">🌾</div>
        <p className="text-gray-600 text-lg">No hay ventas de granos registradas</p>
        <p className="text-gray-500 text-sm mt-2">
          Creá una nueva venta desde el botón "Nueva Venta"
        </p>
      </div>
    )
  }

  return (
    <>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grano
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Toneladas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                US$/ton
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Importe Bruto
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Importe Neto
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liquidación
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ventas.map((venta) => {
              const renglonesGranos = venta.renglones.filter((r: any) => r.tipo === 'GRANOS')
              const tonTotales = renglonesGranos.reduce((sum: number, r: any) => {
                const ton = parseFloat(r.cantidadToneladas) || 0
                return sum + ton
              }, 0)
              const precioPromedio = tonTotales > 0 ? (venta.subtotalUSD / tonTotales) : 0
              const estaExpandido = expandido === venta.id

              // Obtener nombre del grano principal
              const granoPrincipal = renglonesGranos[0]?.tipoCultivoNombre || '-'

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
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{granoPrincipal}</span>
                      {(!venta.serviciosGrano || venta.serviciosGrano.length === 0) && (
                        <button
                          onClick={() => setModalAsignarLotes(venta.id)}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition"
                          title="Asignar lotes"
                        >
                          ⚠️ Sin lotes
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {tonTotales.toLocaleString('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} ton
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
                        title="Ver liquidación"
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
      </div>

      {/* DETALLE EXPANDIDO */}
      {ventas.map((venta) => {
        if (expandido !== venta.id) return null

        const renglonesGranos = venta.renglones.filter((r: any) => r.tipo === 'GRANOS')
        const serviciosGranos = venta.serviciosGranos || []

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
                      <span className="text-gray-600">Nro. Liquidación:</span>
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

              {/* DETALLE POR GRANO */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                  <h4 className="font-semibold text-gray-900">Detalle por Grano</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Grano
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Kg Recibidos
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Descuentos
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Kg Netos
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Toneladas
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        US$/ton
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Importe
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {renglonesGranos.map((renglon: any, idx: number) => {
                      const kgRecibidos = parseFloat(renglon.kgRecibidos) || 0
                      const kgDescuentos = parseFloat(renglon.kgDescuentos) || 0
                      const kgNetos = parseFloat(renglon.kgNetosLiquidar) || 0
                      const toneladas = parseFloat(renglon.cantidadToneladas) || 0
                      const precioTon = parseFloat(renglon.precioToneladaUSD) || 0
                      const grano = renglon.tipoCultivoNombre || renglon.categoria || '-'
                      
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {grano}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">
                            {kgRecibidos.toLocaleString('es-UY', { minimumFractionDigits: 0 })} kg
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-red-600">
                            {kgDescuentos.toLocaleString('es-UY', { minimumFractionDigits: 2 })} kg
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                            {kgNetos.toLocaleString('es-UY', { minimumFractionDigits: 2 })} kg
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                            {toneladas.toLocaleString('es-UY', { minimumFractionDigits: 3 })} ton
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">
                            {precioTon.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                            {renglon.importeBrutoUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* SERVICIOS DEDUCIBLES */}
              {serviciosGranos.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-yellow-200 overflow-hidden mb-4">
                  <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                    <h4 className="font-semibold text-gray-900">Servicios Deducibles</h4>
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
                      {serviciosGranos.map((servicio: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {servicio.concepto}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                            -{servicio.importeUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
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
                  <span className="text-gray-700 font-medium">Monto Bruto:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {venta.subtotalUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                {serviciosGranos.length > 0 && (
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-gray-600">Servicios:</span>
                    <span className="text-red-600 font-medium">
                      -{serviciosGranos.reduce((sum: number, s: any) => sum + parseFloat(s.importeUSD), 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                )}
                {venta.totalImpuestosUSD > 0 && (
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-gray-600">Retenciones:</span>
                    <span className="text-red-600 font-medium">
                      -{venta.totalImpuestosUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                  <span className="text-gray-900 font-semibold">Monto Final:</span>
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
              alt="Liquidación de granos" 
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR LOTES */}
      {modalAsignarLotes && <ModalAsignarLotes ventaId={modalAsignarLotes} ventas={ventas} onClose={() => setModalAsignarLotes(null)} onSuccess={onRefresh} />}
    </>
  )
}

function ModalAsignarLotes({ ventaId, ventas, onClose, onSuccess }: { ventaId: string, ventas: any[], onClose: () => void, onSuccess: () => void }) {
  const venta = ventas.find(v => v.id === ventaId)
  const [lotes, setLotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [lotesSeleccionados, setLotesSeleccionados] = useState<{ [loteId: string]: string }>({})
  const [todoUnLote, setTodoUnLote] = useState(false)
  
  const renglonesGranos = venta?.renglones.filter((r: any) => r.tipo === 'GRANOS') || []
  const cultivoVendido = renglonesGranos[0]?.tipoCultivoNombre || 'Grano'
  const toneladasTotales = renglonesGranos.reduce((sum: number, r: any) => {
    const ton = parseFloat(r.cantidadToneladas) || 0
    return sum + ton
  }, 0)
  
  // Cargar lotes no pastoreables
  useEffect(() => {
    fetch('/api/lotes?esPastoreable=false')
      .then(res => res.json())
      .then(data => {
        const lotesArray = Array.isArray(data.lotes) ? data.lotes : (Array.isArray(data) ? data : [])
        setLotes(lotesArray)
        setLoading(false)
        
        // Si solo hay 1 lote, marcar "todo" por defecto
        if (lotesArray.length === 1) {
          setTodoUnLote(true)
          setLotesSeleccionados({ [lotesArray[0].id]: toneladasTotales.toString() })
        }
      })
      .catch(() => {
        setLoading(false)
        toast.error('Error cargando lotes')
      })
  }, [toneladasTotales])
  
  const toggleLote = (loteId: string) => {
    setLotesSeleccionados(prev => {
      const nuevo = { ...prev }
      if (nuevo[loteId]) {
        delete nuevo[loteId]
      } else {
        nuevo[loteId] = ''
      }
      return nuevo
    })
  }
  
  const actualizarToneladas = (loteId: string, valor: string) => {
    setLotesSeleccionados(prev => ({
      ...prev,
      [loteId]: valor
    }))
  }
  
  const asignarRestante = (loteId: string) => {
    const totalAsignado = Object.values(lotesSeleccionados)
      .filter(v => v !== '')
      .reduce((sum, v) => sum + parseFloat(v), 0)
    
    const restante = toneladasTotales - totalAsignado
    
    setLotesSeleccionados(prev => ({
      ...prev,
      [loteId]: Math.max(0, restante).toFixed(3)
    }))
  }
  
  const distribuirProporcional = () => {
    const lotesActivos = Object.keys(lotesSeleccionados)
    if (lotesActivos.length === 0) return
    
    const totalHectareas = lotesActivos.reduce((sum, loteId) => {
      const lote = lotes.find(l => l.id === loteId)
      return sum + (lote?.hectareas || 0)
    }, 0)
    
    if (totalHectareas === 0) return
    
    const nuevo: { [key: string]: string } = {}
    lotesActivos.forEach(loteId => {
      const lote = lotes.find(l => l.id === loteId)
      if (lote) {
        const proporcion = lote.hectareas / totalHectareas
        nuevo[loteId] = (toneladasTotales * proporcion).toFixed(3)
      }
    })
    
    setLotesSeleccionados(nuevo)
  }
  
  const totalAsignado = Object.values(lotesSeleccionados)
    .filter(v => v !== '')
    .reduce((sum, v) => sum + parseFloat(v), 0)
  
  const diferencia = toneladasTotales - totalAsignado
  
  const guardar = async () => {
    // Validaciones
    const asignaciones = Object.entries(lotesSeleccionados)
      .filter(([_, ton]) => ton !== '')
      .map(([loteId, ton]) => ({ loteId, toneladas: parseFloat(ton) }))
    
    if (asignaciones.length === 0) {
      toast.error('Seleccioná al menos un lote')
      return
    }
    
    if (Math.abs(diferencia) > 0.1) {
      toast.error(`La suma no coincide. Faltan/sobran ${diferencia.toFixed(2)} toneladas`)
      return
    }
    
    setGuardando(true)
    
    try {
      const response = await fetch(`/api/ventas/${ventaId}/asignar-lotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivo: cultivoVendido,
          precioTonelada: venta.subtotalUSD / toneladasTotales,
          asignaciones
        })
      })
      
      if (!response.ok) throw new Error('Error guardando')
      
      toast.success('✅ Lotes asignados correctamente')
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('❌ Error guardando')
    } finally {
      setGuardando(false)
    }
  }
  
  if (!venta) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Asignar Lotes - Venta de {cultivoVendido}
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Total a asignar: <span className="font-bold">{toneladasTotales.toFixed(2)} toneladas</span>
          </p>
          
          {loading ? (
            <p className="text-center text-gray-500">Cargando lotes...</p>
          ) : lotes.length === 0 ? (
            <p className="text-center text-red-600">No hay lotes agrícolas disponibles</p>
          ) : lotes.length === 1 ? (
            // UN SOLO LOTE - Checkbox simple
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todoUnLote}
                    onChange={(e) => {
                      setTodoUnLote(e.target.checked)
                      if (e.target.checked) {
                        setLotesSeleccionados({ [lotes[0].id]: toneladasTotales.toString() })
                      } else {
                        setLotesSeleccionados({})
                      }
                    }}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Todo salió del lote {lotes[0].nombre}
                    </div>
                    <div className="text-sm text-gray-600">
                      {lotes[0].hectareas.toFixed(0)} hectáreas
                    </div>
                  </div>
                </label>
                
                {todoUnLote && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-sm text-gray-700">
                      ✅ <span className="font-bold">{toneladasTotales.toFixed(2)} toneladas</span> asignadas
                    </div>
                    <div className="text-sm text-gray-600">
                      Rendimiento: {(toneladasTotales / lotes[0].hectareas).toFixed(2)} ton/ha
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // MÚLTIPLES LOTES
            <div className="space-y-4">
              {lotes.map(lote => {
                const seleccionado = lote.id in lotesSeleccionados
                const toneladas = lotesSeleccionados[lote.id] || ''
                const rendimiento = toneladas ? (parseFloat(toneladas) / lote.hectareas).toFixed(2) : '-'
                
                return (
                  <div key={lote.id} className={`border-2 rounded-lg p-4 transition ${seleccionado ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => toggleLote(lote.id)}
                        className="mt-1 w-5 h-5 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {lote.nombre} ({lote.hectareas.toFixed(0)} ha)
                        </div>
                        
                        {seleccionado && (
                          <div className="mt-2 flex gap-2 items-center">
                            <input
                              type="number"
                              step="0.001"
                              value={toneladas}
                              onChange={(e) => actualizarToneladas(lote.id, e.target.value)}
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="0.00"
                            />
                            <span className="text-sm text-gray-600">ton</span>
                            <button
                              onClick={() => asignarRestante(lote.id)}
                              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            >
                              Restante
                            </button>
                            {toneladas && (
                              <span className="text-xs text-gray-500 ml-2">
                                {rendimiento} ton/ha
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {seleccionado && (
                        <button
                          onClick={() => toggleLote(lote.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      )}
                    </label>
                  </div>
                )
              })}
              
              {Object.keys(lotesSeleccionados).length > 1 && (
                <button
                  onClick={distribuirProporcional}
                  className="w-full px-4 py-2 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                >
                  📊 Distribuir proporcional por hectáreas
                </button>
              )}
            </div>
          )}
          
          {/* RESUMEN */}
          {Object.keys(lotesSeleccionados).length > 0 && (
            <div className={`mt-4 p-4 rounded-lg ${Math.abs(diferencia) < 0.1 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700">Total asignado:</span>
                <span className="font-bold">{totalAsignado.toFixed(2)} ton</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-700">Diferencia:</span>
                <span className={`font-bold ${Math.abs(diferencia) < 0.1 ? 'text-green-600' : 'text-orange-600'}`}>
                  {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} ton
                </span>
              </div>
            </div>
          )}
          
          {/* BOTONES */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={guardando}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || Object.keys(lotesSeleccionados).length === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}