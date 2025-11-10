'use client'

import { useState } from 'react'

type ModalNacimientoProps = {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalNacimiento({ onClose, onSuccess }: ModalNacimientoProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cantidad, setCantidad] = useState('')
  const [categoria, setCategoria] = useState('ternero')
  const [loteId, setLoteId] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'NACIMIENTO',
          fecha: new Date(fecha),
          descripcion: `Nacimiento de ${cantidad} ${categoria}${parseInt(cantidad) > 1 ? 's' : ''}${notas ? `: ${notas}` : ''}`,
          loteId: loteId || null,
          cantidad: parseInt(cantidad),
          categoria,
        }),
      })

      if (!response.ok) throw new Error('Error al guardar')

      onSuccess()
      onClose()
    } catch {
      alert('Error al guardar el nacimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
            🐣
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Registrar Nacimiento</h2>
        </div>
        <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ternero">Ternero</option>
              <option value="ternera">Ternera</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lote</label>
          <select
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar lote...</option>
            <option value="1">Lote 1</option>
            <option value="2">Lote 2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones sobre el nacimiento..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}