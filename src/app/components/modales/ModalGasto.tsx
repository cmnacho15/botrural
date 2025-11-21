'use client'

import { useState, useEffect } from 'react'
import { CATEGORIAS_GASTOS, METODOS_PAGO } from '@/lib/constants'
import { obtenerFechaLocal } from '@/lib/fechas'

async function obtenerTasaCambioUSD() {
  try {
    const res = await fetch('/api/currency')
    if (!res.ok) throw new Error('Error al obtener moneda')
    const data = await res.json()
    return data?.USD ?? 40
  } catch (error) {
    console.error('Error obteniendo tasa USD:', error)
    return 40 // fallback
  }
}

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
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [proveedor, setProveedor] = useState('')
  const [proveedoresPrevios, setProveedoresPrevios] = useState<string[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [moneda, setMoneda] = useState('UYU')
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // PAGO A PLAZO
  const [esPlazo, setEsPlazo] = useState(false)
  const [diasPlazo, setDiasPlazo] = useState(0)
  const [pagado, setPagado] = useState(false)

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

  // CARGAR PROVEEDORES DESDE EL BACKEND
  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        const res = await fetch('/api/proveedores')
        if (res.ok) {
          const data = await res.json()
          console.log('Proveedores cargados:', data) // Debug

          // Filtrar y limpiar proveedores
          const proveedoresLimpios = data
            .filter((p: any) => p && typeof p === 'string' && p.trim() !== '')
            .map((p: string) => p.trim())
          
          // Eliminar duplicados (case-insensitive pero mantener original)
          const unicos = Array.from(new Set(proveedoresLimpios.map((p: string) => p.toLowerCase())))
            .map(lower => proveedoresLimpios.find((p: string) => p.toLowerCase() === lower))
            .filter(Boolean) as string[]

          console.log('Proveedores únicos:', unicos) // Debug
          setProveedoresPrevios(unicos)
        }
      } catch (err) {
        console.error('Error cargando proveedores:', err)
      }
    }
    cargarProveedores()
  }, [])

  const calcularPrecioFinal = (precio: number, iva: number) => precio + (precio * iva) / 100

  const handleItemChange = (id: string, field: keyof ItemGasto, value: any) => {
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

  if (esPlazo && diasPlazo < 1) {
    alert('Si es pago a plazo, ingresá una cantidad de días válida')
    return
  }

  setLoading(true)

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  tipo: 'GASTO',
  fecha: fecha,
  descripcion: `${item.item}${notas ? ` - ${notas}` : ''}`,
  categoria: item.categoria,

  // 💵 MONTO ORIGINAL INGRESADO
  montoOriginal: item.precioFinal,

  // 💸 MONEDA SELECCIONADA
  moneda: moneda,

  // 💱 TASA DE CAMBIO (si es USD → usás la API)
  tasaCambio: moneda === 'USD' ? await obtenerTasaCambioUSD() : null,

  // 💵 MONTO EN UYU (si es USD → convertir)
  montoEnUYU:
    moneda === 'USD'
      ? item.precioFinal * (await obtenerTasaCambioUSD())
      : item.precioFinal,

  // ⚠️ LO QUE YA TENÍAS
  metodoPago: esPlazo ? 'Plazo' : 'Contado',
  iva: item.iva,
  diasPlazo: esPlazo ? diasPlazo : null,
  pagado: esPlazo ? pagado : true,
  proveedor: proveedor.trim() || null,
}),
      })

      if (!response.ok) throw new Error('Error al guardar')
      
      // ⏱️ Pequeña pausa entre items para que tengan timestamps diferentes
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
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

  // Filtrar proveedores según lo que el usuario escribe
  const proveedoresFiltrados = proveedoresPrevios.filter(p =>
    p.toLowerCase().includes(proveedor.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">💰</div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Gasto</h2>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
      </div>

      {/* INFORMACIÓN BÁSICA */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Información Básica</h3>

        <div className="space-y-3">
          {/* FECHA */}
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

          {/* PROVEEDOR CON AUTOCOMPLETADO MEJORADO */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor {proveedoresPrevios.length > 0 && (
                <span className="text-xs text-blue-600 font-semibold">({proveedoresPrevios.length} guardados)</span>
              )}
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => {
                setProveedor(e.target.value)
                setMostrarSugerencias(true)
              }}
              onFocus={() => {
                console.log('Focus en proveedor') // Debug
                setMostrarSugerencias(true)
              }}
              onBlur={() => {
                console.log('Blur en proveedor') // Debug
                setTimeout(() => setMostrarSugerencias(false), 300)
              }}
              placeholder="Ej: AgroSalto, Barraca del Campo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            {/* DEBUG INFO */}
            {proveedoresPrevios.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                💡 Empezá a escribir para ver sugerencias (hay {proveedoresPrevios.length} guardados)
              </p>
            )}
            
            {/* SUGERENCIAS DROPDOWN - CON MEJOR Z-INDEX */}
            {mostrarSugerencias && proveedoresFiltrados.length > 0 && (
              <div 
                className="absolute z-[9999] w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-60 overflow-y-auto"
                style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
              >
                <div className="p-2 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs font-semibold text-blue-700">
                    {proveedoresFiltrados.length} {proveedoresFiltrados.length === 1 ? 'resultado' : 'resultados'}
                  </p>
                </div>
                {proveedoresFiltrados.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault() // Evita que se active el onBlur
                      console.log('Seleccionado:', p) // Debug
                      setProveedor(p)
                      setMostrarSugerencias(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-100 text-sm text-gray-900 border-b last:border-b-0 transition-colors font-medium"
                  >
                    📦 {p}
                  </button>
                ))}
              </div>
            )}

            {/* MENSAJE SI NO ENCUENTRA COINCIDENCIAS */}
            {mostrarSugerencias && proveedor && proveedoresFiltrados.length === 0 && proveedoresPrevios.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                <p className="text-sm text-gray-600">
                  ❌ No se encontró "{proveedor}". Se guardará como nuevo proveedor.
                </p>
              </div>
            )}

            {/* MENSAJE SI NO HAY PROVEEDORES */}
            {proveedoresPrevios.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ Ingresá un proveedor nuevo. Se guardará automáticamente para futuros gastos.
              </p>
            )}
          </div>

          {/* MONEDA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="UYU">UYU (Pesos Uruguayos)</option>
              <option value="USD">USD (Dólares)</option>
            </select>
          </div>
        </div>

        {/* CONDICIÓN DE PAGO */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Condición de Pago</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" checked={!esPlazo} onChange={() => setEsPlazo(false)} className="text-blue-600" />
                Pago contado
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" checked={esPlazo} onChange={() => setEsPlazo(true)} className="text-blue-600" />
                Pago a plazo
              </label>
            </div>

            {esPlazo && (
              <>
                <div className="flex gap-3 items-center">
                  <label className="text-sm text-gray-700">Plazo (días):</label>
                  <input
                    type="number"
                    min={1}
                    value={diasPlazo}
                    onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={pagado}
                    onChange={(e) => setPagado(e.target.checked)}
                    className="text-blue-600"
                  />
                  <label className="text-sm text-gray-700">Marcar como pagado</label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="mb-6">
        <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">{items.length}</span>
          <h3 className="font-semibold text-gray-900">Items</h3>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative">
              {items.length > 1 && (
                <button type="button" onClick={() => eliminarItem(item.id)} className="absolute top-2 right-2 text-red-600 hover:text-red-800">
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
                    <option key={cat} value={cat}>{cat}</option>
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
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">+</span>
          Agregar Otro Item
        </button>
      </div>

      {/* MONTO TOTAL */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex justify-between items-center">
        <span className="font-semibold text-gray-900">Monto Total</span>
        <span className="text-2xl font-bold text-blue-600">{montoTotal.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {moneda}</span>
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