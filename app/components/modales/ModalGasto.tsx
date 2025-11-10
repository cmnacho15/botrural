'use client'

import { useState } from 'react'
import { CATEGORIAS_GASTOS, METODOS_PAGO } from '@/lib/constants'

type ModalGastoProps = {
  onClose: () => void
  onSuccess: () => void
}

type ItemGasto = {
  id: string
  item: string
  categoria: string
  precio: number
  iva: number
  precioFinal: number
}

export default function ModalGasto({ onClose, onSuccess }: ModalGastoProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState('')
  const [moneda, setMoneda] = useState('UYU')
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  const [items, setItems] = useState<ItemGasto[]>([
    {
      id: '1',
      item: '',
      categoria: CATEGORIAS_GASTOS[0],
      precio: 0,
      iva: 0,
      precioFinal: 0,
    },
  ])

  const calcularPrecioFinal = (precio: number, iva: number) => {
    return precio + (precio * iva) / 100
  }

  const handleItemChange = (id: string, field: keyof ItemGasto, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const updated = { ...item, [field]: value }

        // Recalcular precio final si cambia precio o IVA
        if (field === 'precio' || field === 'iva') {
          updated.precioFinal = calcularPrecioFinal(
            field === 'precio' ? parseFloat(value) || 0 : updated.precio,
            field === 'iva' ? parseFloat(value) || 0 : updated.iva
          )
        }

        return updated
      })
    )
  }

  const agregarItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        item: '',
        categoria: CATEGORIAS_GASTOS[0],
        precio: 0,
        iva: 0,
        precioFinal: 0,
      },
    ])
  }

  const eliminarItem = (id: string) => {
    if (items.length === 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const montoTotal = items.reduce((sum, item) => sum + item.precioFinal, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.some((item) => !item.item || item.precio <= 0)) {
      alert('Completá todos los ítems con nombre y precio válido')
      return
    }

    setLoading(true)

    try {
      // Crear un gasto por cada ítem
      for (const item of items) {
        const response = await fetch('/api/eventos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'GASTO',
            fecha,
            descripcion: `${item.item}${proveedor ? ` - ${proveedor}` : ''}${notas ? ` - ${notas}` : ''}`,
            categoria: item.categoria,
            monto: item.precioFinal,
            metodoPago,
          }),
        })

        if (!response.ok) throw new Error('Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar los gastos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💸
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Gasto</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* INFORMACIÓN BÁSICA */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Información Básica</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="mb-6">
        <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
            {items.length}
          </span>
          <h3 className="font-semibold text-gray-900">Items</h3>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => eliminarItem(item.id)}
                  className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={item.item}
                  onChange={(e) => handleItemChange(item.id, 'item', e.target.value)}
                  placeholder="Item"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />

                <select
                  value={item.categoria}
                  onChange={(e) => handleItemChange(item.id, 'categoria', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIAS_GASTOS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.precio || ''}
                    onChange={(e) => handleItemChange(item.id, 'precio', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">IVA</label>
                  <select
                    value={item.iva}
                    onChange={(e) => handleItemChange(item.id, 'iva', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">Sin IVA</option>
                    <option value="10">10%</option>
                    <option value="22">22%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Precio Final</label>
                  <input
                    type="text"
                    value={item.precioFinal.toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarItem}
          className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
            +
          </span>
          Agregar Otro Item
        </button>
      </div>

      {/* MONTO TOTAL */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
        <span className="font-semibold text-gray-900">Monto Total</span>
        <span className="text-2xl font-bold text-blue-600">{montoTotal.toFixed(2)}</span>
      </div>

      {/* NOTAS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas adicionales..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
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