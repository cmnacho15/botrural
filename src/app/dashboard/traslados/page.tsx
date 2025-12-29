'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ModalTraslado } from '@/app/components/modales'

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
        alert('Error al guardar')
      }
    } catch (error) {
      alert('Error al guardar')
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

  const renderTabla = (traslados: Traslado[], tipo: 'egreso' | 'ingreso') => {
    const esEgreso = tipo === 'egreso'
    const colorHeader = esEgreso ? 'bg-red-600' : 'bg-green-600'
    const colorBadge = esEgreso ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'

    if (traslados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay {esEgreso ? 'egresos' : 'ingresos'} registrados
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
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
          <tbody className="bg-white divide-y divide-gray-200">
            {traslados.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{formatFecha(t.fecha)}</td>
                <td className="px-4 py-3 text-sm font-medium">
                  {esEgreso ? t.campoDestino.nombre : t.campoOrigen.nombre}
                </td>
                <td className="px-4 py-3 text-sm">
                  {esEgreso ? t.potreroDestino.nombre : t.potreroOrigen.nombre}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorBadge}`}>
                    {t.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-center font-semibold">{t.cantidad}</td>
                
                {/* Peso - Editable */}
                <td className="px-4 py-3 text-sm text-center">
                  {editando === t.id ? (
                    <input
                      type="number"
                      step="0.1"
                      value={valoresEdit.pesoPromedio}
                      onChange={(e) => setValoresEdit({ ...valoresEdit, pesoPromedio: e.target.value })}
                      className="w-20 px-2 py-1 border rounded text-center text-sm"
                      placeholder="0"
                    />
                  ) : (
                    <span className={!t.pesoPromedio ? 'text-gray-400 italic' : ''}>
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
                      className="w-20 px-2 py-1 border rounded text-center text-sm"
                      placeholder="0"
                    />
                  ) : (
                    <span className={!t.precioKgUSD ? 'text-gray-400 italic' : ''}>
                      {t.precioKgUSD ? formatMoney(t.precioKgUSD) : 'Sin dato'}
                    </span>
                  )}
                </td>

                {/* Precio/Animal - Calculado */}
                <td className="px-4 py-3 text-sm text-center">
                  {formatMoney(t.precioAnimalUSD)}
                </td>

                {/* Kg Totales - Calculado */}
                <td className="px-4 py-3 text-sm text-center">
                  {formatMoney(t.pesoTotalKg)}
                </td>

                {/* USD Totales - Calculado */}
                <td className="px-4 py-3 text-sm text-center font-semibold">
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🚚 Traslados Entre Campos</h1>
          <p className="text-gray-600 mt-1">Movimientos de animales entre tus campos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMostrarModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"
          >
            ➕ Nuevo Traslado
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            ← Volver
          </Link>
        </div>
      </div>

      {/* Egresos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
          <h2 className="text-xl font-semibold text-red-800 flex items-center gap-2">
            📤 Egresos
            <span className="text-sm font-normal text-red-600">
              (animales que salieron de este campo)
            </span>
          </h2>
        </div>
        <div className="p-4">
          {renderTabla(egresos, 'egreso')}
        </div>
      </div>

      {/* Ingresos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
          <h2 className="text-xl font-semibold text-green-800 flex items-center gap-2">
            📥 Ingresos
            <span className="text-sm font-normal text-green-600">
              (animales que llegaron a este campo)
            </span>
          </h2>
        </div>
        <div className="p-4">
          {renderTabla(ingresos, 'ingreso')}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Podés editar el peso y precio de cada traslado haciendo clic en "Editar". 
          Los valores de "Precio/Animal", "Kg Totales" y "USD Totales" se calculan automáticamente.
        </p>
      </div>

      {/* Modal de Nuevo Traslado */}
      {mostrarModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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