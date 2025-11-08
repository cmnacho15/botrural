'use client'

import { useState, useEffect } from 'react'
import { CATEGORIAS_GASTOS, METODOS_PAGO } from '@/lib/constants'

type ModalGastoProps = {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalGasto({ onClose, onSuccess }: ModalGastoProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTOS[0])
  const [descripcion, setDescripcion] = useState('')
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!monto || parseFloat(monto) <= 0) {
      alert('Ingresá un monto válido')
      return
    }

    setLoading(true)

    try {
      // Crear el evento
      const responseEvento = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'CONSUMO',
          fecha,
          descripcion: descripcion || `Gasto en ${categoria}`,
          categoria,
          monto: parseFloat(monto),
          metodoPago,
        }),
      })

      if (!responseEvento.ok) throw new Error('Error al guardar')

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar el gasto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💸
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Registrar Gasto</h2>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monto (UYU)</label>
            <input
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {CATEGORIAS_GASTOS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {METODOS_PAGO.map((metodo) => (
              <option key={metodo} value={metodo}>
                {metodo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalles del gasto..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          disabled={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}