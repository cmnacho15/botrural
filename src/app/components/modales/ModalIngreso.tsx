'use client'

import { useState, useEffect } from 'react'

type ModalIngresoProps = {
  onClose: () => void
  onSuccess: () => void
}

type ItemIngreso = {
  id: string
  item: string
  precio: number
  iva: number
  precioFinal: number
  tipoItem: 'manual' | 'animal'
  animalLoteId?: string
  cantidad?: number
}

export default function ModalIngreso({ onClose, onSuccess }: ModalIngresoProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [comprador, setComprador] = useState('')
  const [moneda, setMoneda] = useState('UYU')
  const [metodoPago, setMetodoPago] = useState<'Contado' | 'Plazo'>('Contado')
  const [diasPlazo, setDiasPlazo] = useState<number>(0)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // ✅ Nuevos estados
  const [lotes, setLotes] = useState<any[]>([])
  const [animalesDisponibles, setAnimalesDisponibles] = useState<any[]>([])

  const [items, setItems] = useState<ItemIngreso[]>([
    { id: '1', item: '', precio: 0, iva: 22, precioFinal: 0, tipoItem: 'manual' },
  ])

  // ✅ Cargar lotes y animales
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const res = await fetch('/api/lotes')
        const data = await res.json()
        setLotes(data)

        const todosAnimales = data.flatMap((lote: any) =>
          lote.animalesLote.map((animal: any) => ({
            ...animal,
            loteNombre: lote.nombre,
            loteId: lote.id,
          }))
        )
        setAnimalesDisponibles(todosAnimales)
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }
    cargarDatos()
  }, [])

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

  const agregarItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        item: '',
        precio: 0,
        iva: 22,
        precioFinal: 0,
        tipoItem: 'manual',
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
      alert('❌ Completá todos los ítems con nombre y precio válido')
      return
    }

    if (metodoPago === 'Plazo' && diasPlazo < 1) {
      alert('❌ Ingresá una cantidad de días válida para el plazo')
      return
    }

    setLoading(true)

    try {
      const baseDate = new Date(fecha)

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const fechaConHora = new Date(baseDate)
        fechaConHora.setSeconds(i)

        const response = await fetch('/api/ingresos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: fechaConHora.toISOString(),
            descripcion: `${item.item}${notas ? ` - ${notas}` : ''}`,
            categoria: 'Otros',
            monto: item.precioFinal,
            iva: item.iva,
            comprador: comprador ? comprador.trim() : null,
            metodoPago,
            diasPlazo: metodoPago === 'Plazo' ? diasPlazo : null,
            pagado: metodoPago === 'Contado' ? true : false,
            // ✅ nuevos campos
            animalLoteId: item.tipoItem === 'animal' ? item.animalLoteId : null,
            cantidadVendida: item.tipoItem === 'animal' ? item.cantidad : null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          console.error('Error response:', errorData)
          throw new Error(errorData?.error || 'Error al guardar')
        }
      }

      alert('✅ Ingresos guardados correctamente')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('💥 Error:', error)
      alert(
        `❌ Error al guardar los ingresos: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            💰
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Ingreso</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
        >
          ✕
        </button>
      </div>

      {/* INFORMACIÓN BÁSICA */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
            1
          </span>
          Información Básica
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprador
            </label>
            <input
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del comprador (opcional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moneda
            </label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            >
              <option value="UYU">🇺🇾 UYU - Pesos Uruguayos</option>
              <option value="USD">🇺🇸 USD - Dólares</option>
            </select>
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
            2
          </span>
          Items ({items.length})
        </h3>

        {items.map((item, idx) => (
          <div
            key={item.id}
            className="border-l-4 border-green-500 pl-4 py-3 bg-white rounded-r-lg mb-3 relative"
          >
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => eliminarItem(item.id)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 transition"
              >
                🗑️
              </button>
            )}

            {/* Tipo de Item */}
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">
                Tipo de Item
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleItemChange(item.id, 'tipoItem', 'manual')}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition ${
                    item.tipoItem === 'manual'
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  ✍️ Manual
                </button>
                <button
                  type="button"
                  onClick={() => handleItemChange(item.id, 'tipoItem', 'animal')}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition ${
                    item.tipoItem === 'animal'
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  🐄 Animal
                </button>
              </div>
            </div>

            {/* Descripción o selección de animal */}
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">
                {item.tipoItem === 'animal'
                  ? 'Seleccionar Animal'
                  : `Item #${idx + 1}`}
              </label>
              {item.tipoItem === 'manual' ? (
                <input
                  type="text"
                  value={item.item}
                  onChange={(e) => handleItemChange(item.id, 'item', e.target.value)}
                  placeholder="Ej: Cosecha de soja..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                  required
                />
              ) : (
                <select
                  value={item.animalLoteId || ''}
                  onChange={(e) => {
                    const animalSeleccionado = animalesDisponibles.find(
                      (a) => a.id === e.target.value
                    )
                    handleItemChange(item.id, 'animalLoteId', e.target.value)
                    if (animalSeleccionado) {
                      handleItemChange(
                        item.id,
                        'item',
                        `${animalSeleccionado.categoria} - Lote ${animalSeleccionado.loteNombre}`
                      )
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                  required
                >
                  <option value="">Seleccionar animal...</option>
                  {animalesDisponibles.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.categoria} ({animal.cantidad} disp.) - Lote{' '}
                      {animal.loteNombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Cantidad a vender si es animal */}
            {item.tipoItem === 'animal' && (
              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-1">
                  Cantidad a vender
                </label>
                <input
                  type="number"
                  min={1}
                  value={item.cantidad || ''}
                  onChange={(e) =>
                    handleItemChange(item.id, 'cantidad', parseInt(e.target.value))
                  }
                  placeholder="Cantidad"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                  required
                />
              </div>
            )}

            {/* Precio / IVA / Total */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Precio Base
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={item.precio || ''}
                  onChange={(e) => handleItemChange(item.id, 'precio', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">IVA (%)</label>
                <select
                  value={item.iva}
                  onChange={(e) => handleItemChange(item.id, 'iva', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                >
                  <option value="0">Sin IVA</option>
                  <option value="10">10%</option>
                  <option value="22">22%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Total</label>
                <input
                  type="text"
                  value={item.precioFinal.toFixed(2)}
                  readOnly
                  className="w-full px-3 py-2 bg-green-50 border border-green-300 rounded-lg text-green-900 font-bold"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={agregarItem}
          className="mt-3 flex items-center gap-2 text-green-600 hover:text-green-700 font-medium transition"
        >
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
            +
          </span>
          Agregar Otro Item
        </button>
      </div>

      {/* TOTAL */}
      <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-xl flex justify-between items-center">
        <span className="font-semibold text-gray-900 text-lg">💰 Monto Total</span>
        <span className="text-3xl font-bold text-green-600">
          ${montoTotal.toFixed(2)}
        </span>
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition shadow-sm"
        >
          {loading ? '⏳ Guardando...' : '✓ Confirmar Ingresos'}
        </button>
      </div>
    </div>
  )
}