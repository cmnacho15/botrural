'use client'

import { useState, useEffect } from 'react'

type ModalEditarIngresoProps = {
  gasto: {
    id: string
    tipo: 'GASTO' | 'INGRESO'
    fecha: string
    monto: number
    categoria: string
    descripcion?: string
    iva?: number
    comprador?: string
    metodoPago?: string
    pagado?: boolean
    diasPlazo?: number
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

export default function ModalEditarIngreso({ gasto, onClose, onSuccess }: ModalEditarIngresoProps) {
  const [fecha, setFecha] = useState(new Date(gasto.fecha).toISOString().split('T')[0])
  const [comprador, setComprador] = useState(gasto.comprador || '')
  const [moneda, setMoneda] = useState('UYU')
  const [metodoPago, setMetodoPago] = useState<'Contado' | 'Plazo'>(
    gasto.metodoPago === 'Plazo' ? 'Plazo' : 'Contado'
  )
  const [diasPlazo, setDiasPlazo] = useState<number>(gasto.diasPlazo || 0)
  const [pagado, setPagado] = useState(gasto.pagado ?? true)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // ✅ Auto-marcar como cobrado si es contado
  useEffect(() => {
    if (metodoPago === 'Contado') {
      setPagado(true)
      setDiasPlazo(0)
    } else {
      setPagado(false)
    }
  }, [metodoPago])

  useEffect(() => {
    if (gasto.descripcion) {
      const partes = gasto.descripcion.split(' - ')
      if (partes.length > 1) {
        setNotas(partes.slice(1).join(' - ') || '')
      }
    }
  }, [gasto.descripcion])

  const [items, setItems] = useState<ItemIngreso[]>([
    {
      id: '1',
      item: gasto.descripcion?.split(' - ')[0] || '',
      precio: gasto.monto / (1 + (gasto.iva || 22) / 100),
      iva: gasto.iva || 22,
      precioFinal: gasto.monto,
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

  // 🟢 MARCAR COMO COBRADO (sin editar nada más)
  const handleMarcarCobrado = async () => {
    if (!confirm('¿Confirmar que este ingreso ya fue cobrado?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/ingresos/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: gasto.fecha,
          descripcion: gasto.descripcion,
          categoria: gasto.categoria,
          monto: gasto.monto,
          iva: gasto.iva,
          comprador: gasto.comprador,
          metodoPago: gasto.metodoPago,
          diasPlazo: gasto.diasPlazo,
          pagado: true,
        }),
      })

      if (!res.ok) throw new Error('Error al marcar como cobrado')

      alert('✅ Ingreso marcado como cobrado')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      alert('❌ Error al marcar como cobrado')
    } finally {
      setLoading(false)
    }
  }

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
      const item = items[0]
      
      const response = await fetch(`/api/ingresos/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fecha,
          descripcion: `${item.item}${notas ? ` - ${notas}` : ''}`,
          categoria: gasto.categoria,
          monto: item.precioFinal,
          iva: item.iva,
          comprador: comprador ? comprador.trim() : null,
          metodoPago,
          diasPlazo: metodoPago === 'Plazo' ? diasPlazo : null,
          pagado: metodoPago === 'Contado' ? true : pagado,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        console.error('Error response:', errorData)
        throw new Error(errorData?.error || 'Error al actualizar')
      }

      alert('✅ Ingreso actualizado correctamente')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert(`❌ Error al actualizar el ingreso: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  const esPlazoYPendiente = metodoPago === 'Plazo' && !pagado

  return (
    <div className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
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
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
        >
          ✕
        </button>
      </div>

      {/* ALERTA DE COBRO PENDIENTE */}
      {esPlazoYPendiente && (
        <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 mb-1">Cobro Pendiente</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Este ingreso está pendiente de cobro. Podés marcarlo como cobrado sin editar nada más.
              </p>
              <button
                type="button"
                onClick={handleMarcarCobrado}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition shadow-sm"
              >
                {loading ? '⏳ Marcando...' : '✓ Marcar como Cobrado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFORMACIÓN BÁSICA */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
          Información Básica
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comprador</label>
            <input
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del comprador (opcional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
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

        {/* CONDICIÓN DE PAGO */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Condición de Pago</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMetodoPago('Contado')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
                  metodoPago === 'Contado'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                💵 Contado
              </button>
              <button
                type="button"
                onClick={() => setMetodoPago('Plazo')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
                  metodoPago === 'Plazo'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                📅 Plazo
              </button>
            </div>

            {metodoPago === 'Plazo' && (
              <div className="space-y-3">
                <div className="flex gap-3 items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">Días de plazo:</label>
                  <input
                    type="number"
                    min={1}
                    value={diasPlazo}
                    onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                  />
                  <span className="text-xs text-gray-600">
                    (se marcará automáticamente como cobrado)
                  </span>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="pagado"
                    checked={pagado}
                    onChange={(e) => setPagado(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <label htmlFor="pagado" className="text-sm font-medium text-gray-700">
                    ✅ Marcar como cobrado ahora
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETALLES DEL INGRESO */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
          Detalles del Ingreso
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del ítem</label>
            <input
              type="text"
              value={items[0].item}
              onChange={(e) => handleItemChange(items[0].id, 'item', e.target.value)}
              placeholder="Ej: Venta de terneros, Cosecha de soja..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Base</label>
              <input
                type="number"
                step="0.01"
                value={items[0].precio || ''}
                onChange={(e) => handleItemChange(items[0].id, 'precio', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IVA (%)</label>
              <select
                value={items[0].iva}
                onChange={(e) => handleItemChange(items[0].id, 'iva', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
              >
                <option value="0">Sin IVA</option>
                <option value="10">10%</option>
                <option value="22">22%</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
              <input
                type="text"
                value={items[0].precioFinal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 bg-green-50 border border-green-300 rounded-lg text-green-900 font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TOTAL */}
      <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-xl flex justify-between items-center">
        <span className="font-semibold text-gray-900 text-lg">💰 Monto Total</span>
        <span className="text-3xl font-bold text-green-600">${montoTotal.toFixed(2)}</span>
      </div>

      {/* NOTAS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Información adicional sobre este ingreso..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition resize-none"
        />
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
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition shadow-sm"
        >
          {loading ? '⏳ Guardando...' : '✓ Guardar Cambios'}
        </button>
      </div>
    </div>
  )
}