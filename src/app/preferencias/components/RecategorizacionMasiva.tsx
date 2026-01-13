'use client'

import { useState, useEffect } from 'react'

type Filtros = {
  fechaIngreso?: string
  potreroId?: string
  loteRodeoId?: string
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

  // Mapeos de recategorizaciones disponibles
  const RECATEGORIZACIONES_BOVINOS = [
    { de: "Terneros", a: "Novillos 1-2" },
    { de: "Terneras", a: "Vaquillonas 1-2" },
    { de: "Novillos 1-2", a: "Novillos 2-3" },
    { de: "Novillos 2-3", a: "Novillos +3" },
    { de: "Vaquillonas 1-2", a: "Vaquillonas +2" },
    { de: "Vaquillonas +2", a: "Vacas" },
  ]

  const RECATEGORIZACIONES_OVINOS = [
    { de: "Corderas DL", a: "Borregas 2-4 dientes" },
    { de: "Borregas 2-4 dientes", a: "Ovejas" },
  ]

  // Cargar potreros
  useEffect(() => {
    async function cargarDatos() {
      try {
        const res = await fetch('/api/lotes')

        if (res.ok) {
          const data = await res.json()
          setPotreros(data)
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }
    cargarDatos()
  }, [])

  const toggleRecategorizacion = (de: string, a: string) => {
    setRecategorizaciones(prev => {
      const existe = prev.find(r => r.de === de && r.a === a)
      
      if (existe) {
        // Quitar
        return prev.filter(r => !(r.de === de && r.a === a))
      } else {
        // Agregar
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
      
      // Limpiar estado
      setRecategorizaciones([])
      setShowPreview(false)
      setPreviewData(null)
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

        {/* BOVINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🐄 BOVINOS</h3>
          <div className="space-y-4">
            {RECATEGORIZACIONES_BOVINOS.map(({ de, a }) => {
              const seleccionada = estaSeleccionada(de, a)
              const filtros = obtenerFiltros(de, a)

              return (
                <div key={`${de}-${a}`} className="border border-gray-200 rounded-lg">
                  {/* Checkbox principal */}
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

                  {/* Filtros (solo si está seleccionada) */}
                  {seleccionada && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600 mt-3 mb-2">Filtros opcionales:</p>

                      {/* Fecha de ingreso */}
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

                      {/* Potrero específico */}
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
    </>
  )
}