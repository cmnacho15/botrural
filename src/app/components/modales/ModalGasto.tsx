'use client'

import { useState, useEffect } from 'react'
import { METODOS_PAGO } from '@/lib/constants'
import { obtenerFechaLocal } from '@/lib/fechas'
import { esCategoriaVariable, ESPECIES_VALIDAS } from '@/lib/costos/categoriasCostos'

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
  especie: string | null // ✅ NUEVO CAMPO
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

  // 🆕 CATEGORÍAS DINÁMICAS
  const [categorias, setCategorias] = useState<string[]>([])

  const [items, setItems] = useState<ItemGasto[]>([
    {
      id: '1',
      item: '',
      categoria: '',
      precio: 0,
      iva: 0,
      precioFinal: 0,
      especie: null, // ✅ NUEVO
    },
  ])

  // CARGAR PROVEEDORES
  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        const res = await fetch('/api/proveedores')
        if (res.ok) {
          const data = await res.json()

          const proveedoresLimpios = data
            .filter((p: any) => p && typeof p === 'string' && p.trim() !== '')
            .map((p: string) => p.trim())

          const unicos = Array.from(
            new Set(proveedoresLimpios.map((p: string) => p.toLowerCase()))
          )
            .map(lower =>
              proveedoresLimpios.find((p: string) => p.toLowerCase() === lower)
            )
            .filter(Boolean) as string[]

          setProveedoresPrevios(unicos)
        }
      } catch (err) {
        console.error('Error cargando proveedores:', err)
      }
    }
    cargarProveedores()
  }, [])

  // 🆕 CARGAR CATEGORÍAS DINÁMICAS DESDE BACKEND
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await fetch('/api/categorias-gasto')
        if (res.ok) {
          const data = await res.json()
          const nombres = data.map((cat: any) => cat.nombre)
          setCategorias(nombres)

          // Setear primera categoría en el primer item
          if (nombres.length > 0 && items.length > 0 && !items[0].categoria) {
            setItems(prev =>
              prev.map((item, idx) =>
                idx === 0 ? { ...item, categoria: nombres[0] } : item
              )
            )
          }
        }
      } catch (err) {
        console.error('Error cargando categorías:', err)
      }
    }
    cargarCategorias()
  }, [])

  const calcularPrecioFinal = (precio: number, iva: number) =>
    precio + (precio * iva) / 100

  const handleItemChange = (id: string, field: keyof ItemGasto, value: any) => {
    setItems(prev =>
      prev.map(item => {
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
        } else if (field === 'categoria') {
          // ✅ Si cambia a categoría variable, resetear especie
          updated.categoria = value
          if (esCategoriaVariable(value)) {
            updated.especie = null
          }
        } else {
          updated = { ...updated, [field]: value }
        }
        return updated
      })
    )
  }

  const agregarItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        item: '',
        categoria: categorias[0] || '',
        precio: 0,
        iva: 0,
        precioFinal: 0,
        especie: null, // ✅ NUEVO
      },
    ])
  }

  const eliminarItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const montoTotal = items.reduce((sum, item) => sum + item.precioFinal, 0)

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (items.some(item => !item.item || item.precio <= 0)) {
    alert('Completá todos los ítems con nombre y precio válido')
    return
  }

  // ✅ VALIDACIÓN: Variables requieren especie
  const itemSinEspecie = items.find(item => 
    esCategoriaVariable(item.categoria) && !item.especie
  )
  
  if (itemSinEspecie) {
    alert(`El item "${itemSinEspecie.item}" es un costo variable y requiere que asignes una especie (Vacunos/Ovinos/Equinos)`)
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
            monto: item.precioFinal,
            moneda: moneda,
            metodoPago: esPlazo ? 'Plazo' : 'Contado',
            iva: item.iva,
            diasPlazo: esPlazo ? diasPlazo : null,
            pagado: esPlazo ? pagado : true,
            proveedor: proveedor.trim() || null,
            especie: item.especie, // ✅ NUEVO CAMPO
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.error || 'Error al guardar')
        }

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

  const proveedoresFiltrados = proveedoresPrevios.filter(p =>
    p.toLowerCase().includes(proveedor.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💰
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Gasto</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* INFO BÁSICA */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">
          Información Básica
        </h3>

        {/* FECHA */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* PROVEEDOR + SUGERENCIAS */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor{' '}
              {proveedoresPrevios.length > 0 && (
                <span className="text-xs text-blue-600 font-semibold">
                  ({proveedoresPrevios.length} guardados)
                </span>
              )}
            </label>

            <input
              type="text"
              value={proveedor}
              onChange={e => {
                setProveedor(e.target.value)
                setMostrarSugerencias(true)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 300)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: AgroSalto, Barraca del Campo..."
            />

            {mostrarSugerencias && proveedoresFiltrados.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                <div className="p-2 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs font-semibold text-blue-700">
                    {proveedoresFiltrados.length}{' '}
                    {proveedoresFiltrados.length === 1
                      ? 'resultado'
                      : 'resultados'}
                  </p>
                </div>

                {proveedoresFiltrados.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
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

            {mostrarSugerencias &&
              proveedor &&
              proveedoresFiltrados.length === 0 &&
              proveedoresPrevios.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                  <p className="text-sm text-gray-600">
                    ❌ No existe "{proveedor}". Se guardará como nuevo.
                  </p>
                </div>
              )}
          </div>

          {/* MONEDA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moneda
            </label>
            <select
              value={moneda}
              onChange={e => setMoneda(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="UYU">UYU (Pesos Uruguayos)</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* CONDICIÓN DE PAGO */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">
            Condición de Pago
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={!esPlazo}
                  onChange={() => setEsPlazo(false)}
                />
                Pago contado
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={esPlazo}
                  onChange={() => setEsPlazo(true)}
                />
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
                    onChange={e => setDiasPlazo(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={pagado}
                    onChange={e => setPagado(e.target.checked)}
                  />
                  <label className="text-sm text-gray-700">
                    Marcar como pagado
                  </label>
                </div>
              </>
            )}
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
          {items.map(item => {
            const esVariable = esCategoriaVariable(item.categoria)
            
            return (
              <div
                key={item.id}
                className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative"
              >
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
                    onChange={e =>
                      handleItemChange(item.id, 'item', e.target.value)
                    }
                    placeholder="Item"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />

                  {/* CATEGORÍAS DINÁMICAS */}
                  <select
                    value={item.categoria}
                    onChange={e =>
                      handleItemChange(item.id, 'categoria', e.target.value)
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={categorias.length === 0}
                  >
                    {categorias.length === 0 ? (
                      <option value="">Cargando categorías...</option>
                    ) : (
                      categorias.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* ✅ CAMPO ESPECIE (solo si es VARIABLE) */}
                {esVariable && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">
                      Especie (requerido para variables)
                      <span className="ml-2 text-green-600 text-[10px] font-semibold">
                        COSTO VARIABLE DIRECTO
                      </span>
                    </label>
                    <select
                      value={item.especie || ''}
                      onChange={e =>
                        handleItemChange(
                          item.id,
                          'especie',
                          e.target.value || null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">Seleccionar especie...</option>
                      {ESPECIES_VALIDAS.map(esp => (
                        <option key={esp} value={esp}>
                          {esp.charAt(0) + esp.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ✅ INFO para costos fijos */}
                {!esVariable && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      💼 Costo Fijo - Se distribuye automáticamente según % UG
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Precio
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.precio || ''}
                      onChange={e =>
                        handleItemChange(item.id, 'precio', e.target.value)
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      IVA
                    </label>
                    <select
                      value={item.iva}
                      onChange={e =>
                        handleItemChange(item.id, 'iva', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0">Sin IVA</option>
                      <option value="10">10%</option>
                      <option value="22">22%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Precio Final
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={item.precioFinal.toFixed(2)}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* AGREGAR ITEM */}
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
        <span className="text-2xl font-bold text-blue-600">
          {montoTotal.toLocaleString('es-UY', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {moneda}
        </span>
      </div>

      {/* NOTAS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
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