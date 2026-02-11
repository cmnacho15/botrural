'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ModalTraslado } from '@/app/components/modales'
import { toast } from '@/app/components/Toast'

type Traslado = {
  id: string
  fecha: string
  tipoAnimal: string
  categoria: string
  cantidad: number
  pesoPromedio: number | null
  precioKgUSD: number | null
  pesoTotalKg: number | null
  precioAnimalUSD: number | null
  totalUSD: number | null
  notas: string | null
  campoOrigen: { id: string; nombre: string }
  campoDestino: { id: string; nombre: string }
  potreroOrigen: { id: string; nombre: string }
  potreroDestino: { id: string; nombre: string }
}

export default function TrasladosPage() {
  const [egresos, setEgresos] = useState<Traslado[]>([])
  const [ingresos, setIngresos] = useState<Traslado[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [valoresEdit, setValoresEdit] = useState<{ pesoPromedio: string; precioKgUSD: string }>({
    pesoPromedio: '',
    precioKgUSD: ''
  })
  const [mostrarModal, setMostrarModal] = useState(false)

  useEffect(() => {
    cargarTraslados()
  }, [])

  const cargarTraslados = async () => {
    try {
      const res = await fetch('/api/traslados')
      if (res.ok) {
        const data = await res.json()
        setEgresos(data.egresos)
        setIngresos(data.ingresos)
      }
    } catch (error) {
      console.error('Error cargando traslados:', error)
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicion = (traslado: Traslado) => {
    setEditando(traslado.id)
    setValoresEdit({
      pesoPromedio: traslado.pesoPromedio?.toString() || '',
      precioKgUSD: traslado.precioKgUSD?.toString() || ''
    })
  }

  const cancelarEdicion = () => {
    setEditando(null)
    setValoresEdit({ pesoPromedio: '', precioKgUSD: '' })
  }

  const guardarEdicion = async (id: string) => {
    try {
      const res = await fetch('/api/traslados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          pesoPromedio: valoresEdit.pesoPromedio ? parseFloat(valoresEdit.pesoPromedio) : null,
          precioKgUSD: valoresEdit.precioKgUSD ? parseFloat(valoresEdit.precioKgUSD) : null
        })
      })

      if (res.ok) {
        await cargarTraslados()
        cancelarEdicion()
      } else {
        toast.error('Error al guardar')
      }
    } catch (error) {
      toast.error('Error al guardar')
    }
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Montevideo'
    })
  }

  const formatMoney = (value: number | null) => {
    if (value === null) return '-'
    return value.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Tarjeta móvil para un traslado
  const TrasladoCard = ({ t, tipo }: { t: Traslado; tipo: 'egreso' | 'ingreso' }) => {
    const esEgreso = tipo === 'egreso'
    const colorBadge = esEgreso ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'

    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Header: Fecha + Categoría */}
        <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatFecha(t.fecha)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {esEgreso ? `→ ${t.campoDestino.nombre}` : `← ${t.campoOrigen.nombre}`}
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorBadge}`}>
            {t.categoria}
          </span>
        </div>

        {/* Info principal */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Cantidad</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.cantidad}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Potrero</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">{esEgreso ? t.potreroDestino.nombre : t.potreroOrigen.nombre}</div>
          </div>
        </div>

        {/* Peso y Precio - Editables */}
        {editando === t.id ? (
          <div className="space-y-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={valoresEdit.pesoPromedio}
                  onChange={(e) => setValoresEdit({ ...valoresEdit, pesoPromedio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">USD/kg</label>
                <input
                  type="number"
                  step="0.01"
                  value={valoresEdit.precioKgUSD}
                  onChange={(e) => setValoresEdit({ ...valoresEdit, precioKgUSD: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => guardarEdicion(t.id)}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                ✓ Guardar
              </button>
              <button
                onClick={cancelarEdicion}
                className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Peso</div>
                <div className={`text-sm ${t.pesoPromedio ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {t.pesoPromedio ? `${formatMoney(t.pesoPromedio)} kg` : 'Sin dato'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">USD/kg</div>
                <div className={`text-sm ${t.precioKgUSD ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {t.precioKgUSD ? `$${formatMoney(t.precioKgUSD)}` : 'Sin dato'}
                </div>
              </div>
            </div>

            {/* Totales calculados */}
            {(t.pesoTotalKg || t.totalUSD) && (
              <div className="grid grid-cols-2 gap-3 mb-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Kg Totales</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{formatMoney(t.pesoTotalKg)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">USD Totales</div>
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">{t.totalUSD ? `$${formatMoney(t.totalUSD)}` : '-'}</div>
                </div>
              </div>
            )}

            {/* Botón editar */}
            <button
              onClick={() => iniciarEdicion(t)}
              className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
            >
              ✏️ Editar peso y precio
            </button>
          </>
        )}
      </div>
    )
  }

  // Tabla desktop
  const renderTabla = (traslados: Traslado[], tipo: 'egreso' | 'ingreso') => {
    const esEgreso = tipo === 'egreso'
    const colorHeader = esEgreso ? 'bg-red-600 dark:bg-red-700' : 'bg-green-600 dark:bg-green-700'
    const colorBadge = esEgreso ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'

    if (traslados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay {esEgreso ? 'egresos' : 'ingresos'} registrados
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className={`${colorHeader} text-white`}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                {esEgreso ? 'Hacia Campo' : 'Desde Campo'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase">Potrero</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase">Categoría</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">Cantidad</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">Peso (kg)</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">USD/kg</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">Precio/Animal</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">Kg Totales</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">USD Totales</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {traslados.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{formatFecha(t.fecha)}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {esEgreso ? t.campoDestino.nombre : t.campoOrigen.nombre}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {esEgreso ? t.potreroDestino.nombre : t.potreroOrigen.nombre}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorBadge}`}>
                    {t.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">{t.cantidad}</td>

                {/* Peso - Editable */}
                <td className="px-4 py-3 text-sm text-center">
                  {editando === t.id ? (
                    <input
                      type="number"
                      step="0.1"
                      value={valoresEdit.pesoPromedio}
                      onChange={(e) => setValoresEdit({ ...valoresEdit, pesoPromedio: e.target.value })}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0"
                    />
                  ) : (
                    <span className={!t.pesoPromedio ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}>
                      {t.pesoPromedio ? formatMoney(t.pesoPromedio) : 'Sin dato'}
                    </span>
                  )}
                </td>

                {/* Precio/kg - Editable */}
                <td className="px-4 py-3 text-sm text-center">
                  {editando === t.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={valoresEdit.precioKgUSD}
                      onChange={(e) => setValoresEdit({ ...valoresEdit, precioKgUSD: e.target.value })}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0"
                    />
                  ) : (
                    <span className={!t.precioKgUSD ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}>
                      {t.precioKgUSD ? formatMoney(t.precioKgUSD) : 'Sin dato'}
                    </span>
                  )}
                </td>

                {/* Precio/Animal - Calculado */}
                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">
                  {formatMoney(t.precioAnimalUSD)}
                </td>

                {/* Kg Totales - Calculado */}
                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">
                  {formatMoney(t.pesoTotalKg)}
                </td>

                {/* USD Totales - Calculado */}
                <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                  {t.totalUSD ? `$${formatMoney(t.totalUSD)}` : '-'}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3 text-sm text-center">
                  {editando === t.id ? (
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => guardarEdicion(t.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelarEdicion}
                        className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => iniciarEdicion(t)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      ✏️ Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">🚚 Traslados Entre Campos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">Movimientos de animales entre tus campos</p>
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          ➕ Nuevo Traslado
        </button>
      </div>

      {/* Egresos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 sm:mb-8">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
          <h2 className="text-lg sm:text-xl font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
            📤 Egresos
            <span className="text-xs sm:text-sm font-normal text-red-600 dark:text-red-400">
              (animales que salieron)
            </span>
          </h2>
        </div>
        <div className="p-4">
          {/* Mobile: Tarjetas */}
          <div className="md:hidden space-y-3">
            {egresos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay egresos registrados
              </div>
            ) : (
              egresos.map((t) => <TrasladoCard key={t.id} t={t} tipo="egreso" />)
            )}
          </div>
          {/* Desktop: Tabla */}
          <div className="hidden md:block">
            {renderTabla(egresos, 'egreso')}
          </div>
        </div>
      </div>

      {/* Ingresos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 rounded-t-xl">
          <h2 className="text-lg sm:text-xl font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
            📥 Ingresos
            <span className="text-xs sm:text-sm font-normal text-green-600 dark:text-green-400">
              (animales que llegaron)
            </span>
          </h2>
        </div>
        <div className="p-4">
          {/* Mobile: Tarjetas */}
          <div className="md:hidden space-y-3">
            {ingresos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay ingresos registrados
              </div>
            ) : (
              ingresos.map((t) => <TrasladoCard key={t.id} t={t} tipo="ingreso" />)
            )}
          </div>
          {/* Desktop: Tabla */}
          <div className="hidden md:block">
            {renderTabla(ingresos, 'ingreso')}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          💡 <strong>Tip:</strong> Podés editar el peso y precio de cada traslado.
          Los valores de "Precio/Animal", "Kg Totales" y "USD Totales" se calculan automáticamente.
        </p>
      </div>

      {/* Modal de Nuevo Traslado */}
      {mostrarModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ModalTraslado
              onClose={() => setMostrarModal(false)}
              onSuccess={() => {
                cargarTraslados()
                setMostrarModal(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
