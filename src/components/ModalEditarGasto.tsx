'use client'

import { useState, useEffect } from 'react'
import { CATEGORIAS_GASTOS, METODOS_PAGO } from '@/lib/constants'

type ModalEditarGastoProps = {
  gasto: {
    id: string
    tipo: 'GASTO' | 'INGRESO'
    fecha: string
    monto: number
    categoria: string
    descripcion?: string
    metodoPago?: string
    iva?: number
    pagado?: boolean
    diasPlazo?: number
    proveedor?: string
  }
  onClose: () => void
  onSuccess: () => void
}

export default function ModalEditarGasto({ gasto, onClose, onSuccess }: ModalEditarGastoProps) {
  const [fecha, setFecha] = useState(new Date(gasto.fecha).toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState(gasto.proveedor || '')
  const [proveedores, setProveedores] = useState<string[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [categoria, setCategoria] = useState(gasto.categoria)
  const [metodoPago, setMetodoPago] = useState(gasto.metodoPago || 'Contado')
  const [diasPlazo, setDiasPlazo] = useState(gasto.diasPlazo || 0)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [pagado, setPagado] = useState(gasto.pagado ?? true)
  const [iva, setIva] = useState(gasto.iva || 22)
  const [precioBase, setPrecioBase] = useState(gasto.monto / (1 + (gasto.iva || 22) / 100))
  const [item, setItem] = useState('')

  // Parsear descripción
  useEffect(() => {
    if (gasto.descripcion) {
      const partes = gasto.descripcion.split(' - ')
      setItem(partes[0] || '')
      if (partes.length > 1) setNotas(partes[1] || '')
    }
  }, [gasto.descripcion])

  // Cargar proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const res = await fetch('/api/proveedores')
        if (res.ok) {
          const data = await res.json()
          setProveedores(data.filter(Boolean))
        }
      } catch (err) {
        console.warn('No se pudieron cargar proveedores')
      }
    }
    fetchProveedores()
  }, [])

  const precioFinal = precioBase + (precioBase * iva) / 100

  const proveedoresFiltrados = proveedores.filter(p =>
    p.toLowerCase().includes(proveedor.toLowerCase())
  )

  // 🟢 MARCAR COMO PAGADO (sin editar nada más)
  const handleMarcarPagado = async () => {
    if (!confirm('¿Confirmar que este gasto ya fue pagado?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagado: true }),
      })

      if (!res.ok) throw new Error('Error al marcar como pagado')

      alert('✅ Gasto marcado como pagado')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      alert('❌ Error al marcar como pagado')
    } finally {
      setLoading(false)
    }
  }

  // 🟢 GUARDAR CAMBIOS COMPLETOS
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!item.trim() || precioBase <= 0) {
      alert('❌ Completá el nombre del ítem y un precio válido')
      return
    }

    if (metodoPago === 'Plazo' && diasPlazo < 1) {
      alert('❌ Ingresá una cantidad de días válida para pago a plazo')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/gastos/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'GASTO',
          fecha,
          descripcion: `${item.trim()}${notas ? ` - ${notas}` : ''}`,
          categoria,
          monto: precioFinal,
          metodoPago,
          iva,
          diasPlazo: metodoPago === 'Plazo' ? diasPlazo : null,
          pagado: metodoPago === 'Contado' ? true : pagado,
          proveedor: proveedor.trim() || null,
        }),
      })

      if (!response.ok) throw new Error('Error al actualizar')

      alert('✅ Gasto actualizado correctamente')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('❌ Error al actualizar el gasto')
    } finally {
      setLoading(false)
    }
  }

  const esPlazoYPendiente = metodoPago === 'Plazo' && !pagado

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            ✏️
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Gasto</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
        >
          ✕
        </button>
      </div>

      {/* ALERTA DE PAGO PENDIENTE */}
      {esPlazoYPendiente && (
        <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 mb-1">Pago Pendiente</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Este gasto está pendiente de pago. Podés marcarlo como pagado sin editar nada más.
              </p>
              <button
                type="button"
                onClick={handleMarcarPagado}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition shadow-sm"
              >
                {loading ? '⏳ Marcando...' : '✓ Marcar como Pagado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFORMACIÓN BÁSICA */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
          Información Básica
        </h3>

        <div className="space-y-4">
          {/* FECHA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>

          {/* PROVEEDOR CON AUTOCOMPLETADO */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor {proveedores.length > 0 && (
                <span className="text-xs text-blue-600 font-semibold">
                  ({proveedores.length} guardados)
                </span>
              )}
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => {
                setProveedor(e.target.value)
                setMostrarSugerencias(true)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
              placeholder="Ej: AgroSalto, Barraca del Campo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />

            {/* SUGERENCIAS */}
            {mostrarSugerencias && proveedoresFiltrados.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                <div className="p-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                  <p className="text-xs font-semibold text-blue-700">
                    {proveedoresFiltrados.length} resultados
                  </p>
                </div>
                {proveedoresFiltrados.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setProveedor(p)
                      setMostrarSugerencias(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-100 text-sm text-gray-900 border-b last:border-b-0 transition font-medium"
                  >
                    📦 {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CATEGORÍA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              {CATEGORIAS_GASTOS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DETALLES DEL GASTO */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
          Detalles del Gasto
        </h3>

        <div className="space-y-4">
          {/* ITEM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del ítem</label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Ej: Fertilizante NPK 20kg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>

          {/* PRECIO + IVA + TOTAL */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Base</label>
              <input
                type="number"
                step="0.01"
                value={precioBase || ''}
                onChange={(e) => setPrecioBase(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IVA (%)</label>
              <select
                value={iva}
                onChange={(e) => setIva(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
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
                value={precioFinal.toFixed(2)}
                readOnly
                className="w-full px-3 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONDICIONES DE PAGO */}
      <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
          Condiciones de Pago
        </h3>

        <div className="space-y-4">
          {/* MÉTODO DE PAGO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMetodoPago('Contado')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
                  metodoPago === 'Contado'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
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
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                📅 Plazo
              </button>
            </div>
          </div>

          {/* PLAZO + CHECKBOX PAGADO */}
          {metodoPago === 'Plazo' && (
            <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Días de plazo:</label>
                <input
                  type="number"
                  min={1}
                  value={diasPlazo}
                  onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pagado}
                  onChange={(e) => setPagado(e.target.checked)}
                  className="w-4 h-4 text-green-600 focus:ring-2 focus:ring-green-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Marcar como pagado
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NOTAS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Información adicional sobre este gasto..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
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
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition shadow-sm"
        >
          {loading ? '⏳ Guardando...' : '✓ Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}