'use client'

import { useState, useEffect } from 'react'

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
  const [asignaciones, setAsignaciones] = useState<{ loteId: string, toneladas: string }[]>([])
  
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
        setLotes(data.lotes || [])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        alert('Error cargando lotes')
      })
  }, [])
  
  const agregarLote = () => {
    setAsignaciones([...asignaciones, { loteId: '', toneladas: '' }])
  }
  
  const actualizarAsignacion = (index: number, field: 'loteId' | 'toneladas', value: string) => {
    const nuevas = [...asignaciones]
    nuevas[index][field] = value
    setAsignaciones(nuevas)
  }
  
  const eliminarAsignacion = (index: number) => {
    setAsignaciones(asignaciones.filter((_, i) => i !== index))
  }
  
  const totalAsignado = asignaciones.reduce((sum, a) => sum + (parseFloat(a.toneladas) || 0), 0)
  const diferencia = toneladasTotales - totalAsignado
  
  const guardar = async () => {
    // Validaciones
    if (asignaciones.length === 0) {
      alert('Agregá al menos un lote')
      return
    }
    
    if (asignaciones.some(a => !a.loteId || !a.toneladas)) {
      alert('Completá todos los campos')
      return
    }
    
    if (Math.abs(diferencia) > 0.1) {
      alert(`La suma no coincide. Faltan/sobran ${diferencia.toFixed(2)} toneladas`)
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
          asignaciones: asignaciones.map(a => ({
            loteId: a.loteId,
            toneladas: parseFloat(a.toneladas)
          }))
        })
      })
      
      if (!response.ok) throw new Error('Error guardando')
      
      alert('✅ Lotes asignados correctamente')
      onSuccess()
      onClose()
    } catch (error) {
      alert('❌ Error guardando')
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
          ) : (
            <>
              {/* LISTA DE ASIGNACIONES */}
              <div className="space-y-3 mb-4">
                {asignaciones.map((asig, idx) => {
                  const loteSeleccionado = lotes.find(l => l.id === asig.loteId)
                  return (
                    <div key={idx} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <label className="text-xs text-gray-600 mb-1 block">Lote</label>
                        <select
                          value={asig.loteId}
                          onChange={(e) => actualizarAsignacion(idx, 'loteId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Seleccionar...</option>
                          {lotes.map(lote => (
                            <option key={lote.id} value={lote.id}>
                              {lote.nombre} ({lote.hectareas.toFixed(0)} ha)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-gray-600 mb-1 block">Toneladas</label>
                        <input
                          type="number"
                          step="0.001"
                          value={asig.toneladas}
                          onChange={(e) => actualizarAsignacion(idx, 'toneladas', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      {loteSeleccionado && asig.toneladas && (
                        <div className="text-xs text-gray-500 pt-7">
                          {(parseFloat(asig.toneladas) / loteSeleccionado.hectareas).toFixed(2)} ton/ha
                        </div>
                      )}
                      <button
                        onClick={() => eliminarAsignacion(idx)}
                        className="text-red-600 hover:text-red-800 pt-7"
                      >
                        🗑️
                      </button>
                    </div>
                  )
                })}
              </div>
              
              <button
                onClick={agregarLote}
                className="w-full mb-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition"
              >
                + Agregar lote
              </button>
              
              {/* RESUMEN */}
              {asignaciones.length > 0 && (
                <div className={`p-4 rounded-lg mb-4 ${Math.abs(diferencia) < 0.1 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
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
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={guardando}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando || asignaciones.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}