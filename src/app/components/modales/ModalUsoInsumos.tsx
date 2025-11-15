'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type Insumo = {
  id: string
  nombre: string
  unidad: string
  stock: number
}

type ModalUsoInsumosProps = {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalUsoInsumos({ onClose, onSuccess }: ModalUsoInsumosProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [insumoId, setInsumoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loadingInsumos, setLoadingInsumos] = useState(true)

  // Cargar insumos desde la API
  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        const res = await fetch('/api/insumos')
        const data = await res.json()
        setInsumos(data)
      } catch (error) {
        console.error('Error cargando insumos:', error)
      } finally {
        setLoadingInsumos(false)
      }
    }

    fetchInsumos()
  }, [])

  const insumoSeleccionado = insumos.find(i => i.id === insumoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!insumoId || !cantidad) {
      alert('Completá todos los campos obligatorios')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'USO_INSUMO',
          fecha,
          descripcion: `Uso de ${insumoSeleccionado?.nombre}: ${cantidad} ${insumoSeleccionado?.unidad}`,
          insumoId,
          cantidad: parseFloat(cantidad),
          notas,
        }),
      })

      if (!response.ok) throw new Error('Error al guardar')

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar el uso de insumo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            📤
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Uso de Insumos</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Insumo *</label>
          {loadingInsumos ? (
            <div className="text-sm text-gray-500">Cargando insumos...</div>
          ) : (
            <select
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccioná un insumo</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre} (Stock: {insumo.stock} {insumo.unidad})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cantidad * {insumoSeleccionado && `(${insumoSeleccionado.unidad})`}
          </label>
          <input
            type="number"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
          {insumoSeleccionado && parseFloat(cantidad) > insumoSeleccionado.stock && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ La cantidad supera el stock disponible ({insumoSeleccionado.stock})
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || loadingInsumos}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}