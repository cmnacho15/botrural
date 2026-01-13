'use client'

import { useState, useEffect } from 'react'
import ModalDividirBovinos from '@/app/components/modales/ModalDividirBovinos'
import ModalDividirOvinosSexado from '@/app/components/modales/ModalDividirOvinosSexado'
import ModalDividirOvinosCastracion from '@/app/components/modales/ModalDividirOvinosCastracion'

type Filtros = {
  fechaIngreso?: string
  potreroId?: string
}

type RecategorizacionSeleccionada = {
  de: string
  a: string
  filtros: Filtros
  expandida: boolean
}

type Potrero = {
  id: string
  nombre: string
}

type PreviewData = {
  de: string
  a: string
  totalAnimales: number
  potreros: Array<{ nombre: string; cantidad: number }>
  filtros: Filtros
}

type PendientesPotrero = {
  loteId: string
  nombre: string
  cantidad: number
  animalLoteId: string
}

export default function RecategorizacionMasiva() {
  const [recategorizaciones, setRecategorizaciones] = useState<RecategorizacionSeleccionada[]>([])
  const [potreros, setPotreros] = useState<Potrero[]>([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<{
    previews: PreviewData[]
    totalGeneral: number
    cantidadRecategorizaciones: number
  } | null>(null)
  const [aplicando, setAplicando] = useState(false)

  const [pendientes, setPendientes] = useState<{
    ternerosNacidos: { total: number; potreros: PendientesPotrero[] }
    corderosMamones: { total: number; potreros: PendientesPotrero[] }
    corderosDL: { total: number; potreros: PendientesPotrero[] }
  }>({
    ternerosNacidos: { total: 0, potreros: [] },
    corderosMamones: { total: 0, potreros: [] },
    corderosDL: { total: 0, potreros: [] },
  })

  // Modales
  const [showModalBovinos, setShowModalBovinos] = useState(false)
  const [showModalOvinosSexado, setShowModalOvinosSexado] = useState(false)
  const [showModalOvinosCastracion, setShowModalOvinosCastracion] = useState(false)

  // Mapeos de recategorizaciones disponibles
  const RECATEGORIZACIONES_BOVINOS = [
    { de: "Terneros", a: "Novillos 1–2 años" },
    { de: "Terneras", a: "Vaquillonas 1–2 años" },
    { de: "Novillos 1–2 años", a: "Novillos 2–3 años" },
    { de: "Novillos 2–3 años", a: "Novillos +3 años" },
    { de: "Vaquillonas 1–2 años", a: "Vaquillonas +2 años" },
    { de: "Vaquillonas +2 años", a: "Vacas" },
  ]

  const RECATEGORIZACIONES_OVINOS = [
    { de: "Corderas DL", a: "Borregas 2–4 dientes" },
    { de: "Borregas 2–4 dientes", a: "Ovejas" },
  ]

  // Cargar potreros y pendientes
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [resPotreros, resPendientes] = await Promise.all([
          fetch('/api/lotes'),
          fetch('/api/recategorizacion/pendientes'),
        ])

        if (resPotreros.ok) {
          const data = await resPotreros.json()
          setPotreros(data)
        }

        if (resPendientes.ok) {
          const data = await resPendientes.json()
          setPendientes(data)
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }
    cargarDatos()
  }, [])

  async function recargarPendientes() {
    try {
      const res = await fetch('/api/recategorizacion/pendientes')
      if (res.ok) {
        const data = await res.json()
        setPendientes(data)
      }
    } catch (error) {
      console.error('Error recargando pendientes:', error)
    }
  }

  const toggleRecategorizacion = (de: string, a: string) => {
    setRecategorizaciones(prev => {
      const existe = prev.find(r => r.de === de && r.a === a)
      
      if (existe) {
        return prev.filter(r => !(r.de === de && r.a === a))
      } else {
        return [...prev, {
          de,
          a,
          filtros: {},
          expandida: true,
        }]
      }
    })
  }

  const actualizarFiltro = (de: string, a: string, campo: keyof Filtros, valor: string) => {
    setRecategorizaciones(prev =>
      prev.map(r => {
        if (r.de === de && r.a === a) {
          return {
            ...r,
            filtros: {
              ...r.filtros,
              [campo]: valor || undefined,
            },
          }
        }
        return r
      })
    )
  }

  const handleVistaPrevia = async () => {
    if (recategorizaciones.length === 0) {
      alert('Seleccioná al menos una recategorización')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/recategorizacion/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recategorizaciones }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al generar vista previa')
        return
      }

      const data = await res.json()
      setPreviewData(data)
      setShowPreview(true)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al generar vista previa')
    } finally {
      setLoading(false)
    }
  }

  const handleAplicar = async () => {
    if (!previewData) return

    if (!confirm(`¿Confirmar recategorización?\n\nSe recategorizarán ${previewData.totalGeneral} animales.\nEsta acción no se puede deshacer.`)) {
      return
    }

    setAplicando(true)
    try {
      const res = await fetch('/api/recategorizacion/masiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recategorizaciones }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al aplicar recategorización')
        return
      }

      const data = await res.json()
      
      alert(`✅ Recategorización completada\n\nTotal: ${data.totalProcesado} animales recategorizados\nSe generaron ${data.resultados.length} eventos`)
      
      setRecategorizaciones([])
      setShowPreview(false)
      setPreviewData(null)
      recargarPendientes()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al aplicar recategorización')
    } finally {
      setAplicando(false)
    }
  }

  const estaSeleccionada = (de: string, a: string) => {
    return recategorizaciones.some(r => r.de === de && r.a === a)
  }

  const obtenerFiltros = (de: string, a: string) => {
    return recategorizaciones.find(r => r.de === de && r.a === a)?.filtros || {}
  }

  return (
    <>
      <div className="space-y-6">
        {/* CATEGORÍAS PENDIENTES DE DIVIDIR */}
        {(pendientes.ternerosNacidos.total > 0 || 
          pendientes.corderosMamones.total > 0 || 
          pendientes.corderosDL.total > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
              ⚠️ Categorías pendientes de dividir
            </h3>
            <div className="space-y-3">
              {pendientes.ternerosNacidos.total > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      🐄 Terneros nacidos: {pendientes.ternerosNacidos.total} animales
                    </p>
                    <p className="text-xs text-gray-600">
                      Requiere división por sexo (cuando caravanees)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModalBovinos(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Dividir por sexo
                  </button>
                </div>
              )}

              {pendientes.corderosMamones.total > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      🐑 Corderos Mamones: {pendientes.corderosMamones.total} animales
                    </p>
                    <p className="text-xs text-gray-600">
                      Requiere división por sexo (cuando destetes)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModalOvinosSexado(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Dividir por sexo
                  </button>
                </div>
              )}

              {pendientes.corderosDL.total > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      🐑 Corderos DL: {pendientes.corderosDL.total} animales
                    </p>
                    <p className="text-xs text-gray-600">
                      Requiere registrar castración
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModalOvinosCastracion(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Registrar castración
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOVINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🐄 BOVINOS</h3>
          <div className="space-y-4">
            {RECATEGORIZACIONES_BOVINOS.map(({ de, a }) => {
              const seleccionada = estaSeleccionada(de, a)
              const filtros = obtenerFiltros(de, a)

              return (
                <div key={`${de}-${a}`} className="border border-gray-200 rounded-lg">
                  <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={seleccionada}
                      onChange={() => toggleRecategorizacion(de, a)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {de} → {a}
                    </span>
                  </label>

                  {seleccionada && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600 mt-3 mb-2">Filtros opcionales:</p>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!filtros.fechaIngreso}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const hoy = new Date().toISOString().split('T')[0]
                              actualizarFiltro(de, a, 'fechaIngreso', hoy)
                            } else {
                              actualizarFiltro(de, a, 'fechaIngreso', '')
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-700">Solo animales con ingreso antes de:</span>
                        {filtros.fechaIngreso && (
                          <input
                            type="date"
                            value={filtros.fechaIngreso}
                            onChange={(e) => actualizarFiltro(de, a, 'fechaIngreso', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        )}
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!filtros.potreroId}
                          onChange={(e) => {
                            if (e.target.checked) {
                              actualizarFiltro(de, a, 'potreroId', potreros[0]?.id || '')
                            } else {
                              actualizarFiltro(de, a, 'potreroId', '')
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-700">Solo potrero específico:</span>
                        {!!filtros.potreroId && (
                          <select
                            value={filtros.potreroId || ''}
                            onChange={(e) => actualizarFiltro(de, a, 'potreroId', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Seleccionar potrero</option>
                            {potreros.map(p => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* OVINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🐑 OVINOS</h3>
          <div className="space-y-4">
            {RECATEGORIZACIONES_OVINOS.map(({ de, a }) => {
              const seleccionada = estaSeleccionada(de, a)
              const filtros = obtenerFiltros(de, a)

              return (
                <div key={`${de}-${a}`} className="border border-gray-200 rounded-lg">
                  <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={seleccionada}
                      onChange={() => toggleRecategorizacion(de, a)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {de} → {a}
                    </span>
                  </label>

                  {seleccionada && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600 mt-3 mb-2">Filtros opcionales:</p>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!filtros.fechaIngreso}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const hoy = new Date().toISOString().split('T')[0]
                              actualizarFiltro(de, a, 'fechaIngreso', hoy)
                            } else {
                              actualizarFiltro(de, a, 'fechaIngreso', '')
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-700">Solo animales con ingreso antes de:</span>
                        {filtros.fechaIngreso && (
                          <input
                            type="date"
                            value={filtros.fechaIngreso}
                            onChange={(e) => actualizarFiltro(de, a, 'fechaIngreso', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        )}
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!filtros.potreroId}
                          onChange={(e) => {
                            if (e.target.checked) {
                              actualizarFiltro(de, a, 'potreroId', potreros[0]?.id || '')
                            } else {
                              actualizarFiltro(de, a, 'potreroId', '')
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-700">Solo potrero específico:</span>
                        {!!filtros.potreroId && (
                          <select
                            value={filtros.potreroId || ''}
                            onChange={(e) => actualizarFiltro(de, a, 'potreroId', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Seleccionar potrero</option>
                            {potreros.map(p => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* BOTONES */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleVistaPrevia}
            disabled={loading || recategorizaciones.length === 0}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {loading ? 'Cargando...' : '📊 Vista Previa'}
          </button>
        </div>
      </div>

      {/* MODAL VISTA PREVIA */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">📊 Animales que serán recategorizados</h2>
            </div>

            <div className="p-6 space-y-4">
              {previewData.previews.map((preview, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    ✅ {preview.de} → {preview.a}
                  </h3>
                  
                  {preview.filtros.fechaIngreso && (
                    <p className="text-xs text-gray-600 mb-2">
                      Filtro: ingreso antes de {new Date(preview.filtros.fechaIngreso).toLocaleDateString()}
                    </p>
                  )}

                  <div className="space-y-1 mb-2">
                    {preview.potreros.map((p, i) => (
                      <p key={i} className="text-sm text-gray-700">
                        • {p.nombre}: {p.cantidad} animales
                      </p>
                    ))}
                  </div>

                  <p className="text-sm font-medium text-blue-600">
                    Subtotal: {preview.totalAnimales} animales
                  </p>
                </div>
              ))}

              <div className="border-t-2 border-gray-300 pt-4">
                <p className="text-lg font-bold text-gray-900">
                  TOTAL: {previewData.totalGeneral} animales
                </p>
                <p className="text-sm text-gray-600">
                  Se generarán {previewData.cantidadRecategorizaciones} eventos de recategorización masiva
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                disabled={aplicando}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicar}
                disabled={aplicando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {aplicando ? 'Aplicando...' : 'Confirmar ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES */}
      <ModalDividirBovinos
        isOpen={showModalBovinos}
        onClose={() => setShowModalBovinos(false)}
        potreros={pendientes.ternerosNacidos.potreros}
        onSuccess={() => {
          recargarPendientes()
          alert('✅ División completada')
        }}
      />

      <ModalDividirOvinosSexado
        isOpen={showModalOvinosSexado}
        onClose={() => setShowModalOvinosSexado(false)}
        potreros={pendientes.corderosMamones.potreros}
        onSuccess={() => {
          recargarPendientes()
          alert('✅ División completada')
        }}
      />

      <ModalDividirOvinosCastracion
        isOpen={showModalOvinosCastracion}
        onClose={() => setShowModalOvinosCastracion(false)}
        potreros={pendientes.corderosDL.potreros}
        onSuccess={() => {
          recargarPendientes()
          alert('✅ División completada')
        }}
      />
    </>
  )
}