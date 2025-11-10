'use client'

import { useState, useEffect } from 'react'

type ModalEditarIngresoProps = {
  gasto: {  // ← CAMBIADO DE "ingreso" A "gasto"
    id: string
    tipo: 'GASTO' | 'INGRESO'
    fecha: string
    monto: number
    categoria: string
    descripcion?: string
  }
  onClose: () => void
  onSuccess: () => void
}

type ItemIngreso = {
  id: string
  item: string
  precio: number
  iva: number
  precioFinal: number
}

export default function ModalEditarIngreso({ gasto, onClose, onSuccess }: ModalEditarIngresoProps) {  // ← CAMBIADO
  const [fecha, setFecha] = useState(new Date(gasto.fecha).toISOString().split('T')[0])  // ← CAMBIADO
  const [comprador, setComprador] = useState('')
  const [moneda, setMoneda] = useState('UYU')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (gasto.descripcion) {  // ← CAMBIADO
      const partes = gasto.descripcion.split(' - ')  // ← CAMBIADO
      if (partes.length > 1) {
        setComprador(partes[1] || '')
      }
      if (partes.length > 2) {
        setNotas(partes[2] || '')
      }
    }
  }, [gasto.descripcion])  // ← CAMBIADO

  const [items, setItems] = useState<ItemIngreso[]>([
    {
      id: '1',
      item: gasto.descripcion?.split(' - ')[0] || '',  // ← CAMBIADO
      precio: gasto.monto / 1.22,  // ← CAMBIADO
      iva: 22,
      precioFinal: gasto.monto,  // ← CAMBIADO
    },
  ])

  const calcularPrecioFinal = (precio: number, iva: number) => {
    return precio + (precio * iva) / 100
  }

  const handleItemChange = (id: string, field: keyof ItemIngreso, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        let updated = { ...item }

        if (field === 'precio') {
          const numValue = parseFloat(value)
          updated.precio = isNaN(numValue) ? 0 : numValue
          updated.precioFinal = calcularPrecioFinal(updated.precio, updated.iva)
        } else if (field === 'iva') {
          const numValue = parseFloat(value)
          updated.iva = isNaN(numValue) ? 0 : numValue
          updated.precioFinal = calcularPrecioFinal(updated.precio, updated.iva)
        } else {
          updated = { ...updated, [field]: value }
        }

        return updated
      })
    )
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
      const item = items[0]
      
      const response = await fetch(`/api/gastos/${gasto.id}`, {  // ← CAMBIADO
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'INGRESO',
          fecha: fecha,
          descripcion: `${item.item}${comprador ? ` - ${comprador}` : ''}${notas ? ` - ${notas}` : ''}`,
          categoria: 'Otros',
          monto: item.precioFinal,
        }),
      })

      if (!response.ok) throw new Error('Error al actualizar')

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el ingreso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            💰
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Ingreso</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Información Básica</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comprador</label>
            <input
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del comprador"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="bg-green-50 rounded-lg p-3 mb-3 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
            1
          </span>
          <h3 className="font-semibold text-gray-900">Item</h3>
        </div>

        <div className="border-l-4 border-green-500 pl-4 py-3 bg-gray-50 rounded-r-lg">
          <div className="mb-3">
            <input
              type="text"
              value={items[0].item}
              onChange={(e) => handleItemChange(items[0].id, 'item', e.target.value)}
              placeholder="Item"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Precio</label>
              <input
                type="number"
                step="0.01"
                value={items[0].precio || ''}
                onChange={(e) => handleItemChange(items[0].id, 'precio', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">IVA</label>
              <select
                value={items[0].iva}
                onChange={(e) => handleItemChange(items[0].id, 'iva', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                value={items[0].precioFinal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
        <span className="font-semibold text-gray-900">Monto Total</span>
        <span className="text-2xl font-bold text-green-600">{montoTotal.toFixed(2)}</span>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas adicionales..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

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
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}