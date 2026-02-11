'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

type ModalCompraProps = {
  onClose: () => void
  onSuccess: () => void
}

type Renglon = {
  id: string
  tipoAnimal: string
  categoria: string
  cantidad: number
  precioKg: number
  pesoPromedio: number
  agregarAlStock: boolean
  animalLoteId: string | null
}

export default function ModalCompra({ onClose, onSuccess }: ModalCompraProps) {
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)

  // PASO 1: Datos generales
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [proveedor, setProveedor] = useState('')
  const [consignatario, setConsignatario] = useState('')
  const [nroTropa, setNroTropa] = useState('')
  const [nroFactura, setNroFactura] = useState('')
  const [metodoPago, setMetodoPago] = useState('Contado')
  const [diasPlazo, setDiasPlazo] = useState(0)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [pagado, setPagado] = useState(false)
  const [notas, setNotas] = useState('')

  // PASO 2: Renglones
  const [renglones, setRenglones] = useState<Renglon[]>([
    {
      id: '1',
      tipoAnimal: 'BOVINO',
      categoria: '',
      cantidad: 0,
      precioKg: 0,
      pesoPromedio: 0,
      agregarAlStock: false,
      animalLoteId: null,
    },
  ])

  // Cargar categorías de animales
  const [categoriasBovinas, setCategoriasBovinas] = useState<string[]>([])
  const [categoriasOvinas, setCategoriasOvinas] = useState<string[]>([])

  // Cargar potreros
  const [potreros, setPotreros] = useState<any[]>([])

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await fetch('/api/categorias-animal')
        if (res.ok) {
          const data = await res.json()
          const bovinas = data
            .filter((c: any) => c.tipoAnimal === 'BOVINO')
            .map((c: any) => c.nombreSingular)
          const ovinas = data
            .filter((c: any) => c.tipoAnimal === 'OVINO')
            .map((c: any) => c.nombreSingular)
          
          setCategoriasBovinas(bovinas.length > 0 ? bovinas : ['Vaca', 'Vaquillona', 'Novillo', 'Ternero', 'Toro'])
          setCategoriasOvinas(ovinas.length > 0 ? ovinas : ['Oveja', 'Cordero', 'Capón', 'Carnero'])
        }
      } catch (err) {
        console.error('Error cargando categorías:', err)
        setCategoriasBovinas(['Vaca', 'Vaquillona', 'Novillo', 'Ternero', 'Toro'])
        setCategoriasOvinas(['Oveja', 'Cordero', 'Capón', 'Carnero'])
      }
    }

    const cargarPotreros = async () => {
      try {
        const res = await fetch('/api/lotes')
        if (res.ok) {
          const data = await res.json()
          setPotreros(data)
        }
      } catch (err) {
        console.error('Error cargando potreros:', err)
      }
    }

    cargarCategorias()
    cargarPotreros()
  }, [])

  const handleRenglonChange = (id: string, field: keyof Renglon, value: any) => {
    setRenglones(prev =>
      prev.map(r => {
        if (r.id !== id) return r

        let updated = { ...r, [field]: value }

        // Si cambia el tipo de animal, resetear categoría
        if (field === 'tipoAnimal') {
          updated.categoria = ''
          updated.animalLoteId = null
        }

        // Si desmarca agregarAlStock, limpiar animalLoteId
        if (field === 'agregarAlStock' && !value) {
          updated.animalLoteId = null
        }

        return updated
      })
    )
  }

  const agregarRenglon = () => {
    setRenglones(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        tipoAnimal: 'BOVINO',
        categoria: '',
        cantidad: 0,
        precioKg: 0,
        pesoPromedio: 0,
        agregarAlStock: false,
        animalLoteId: null,
      },
    ])
  }

  const eliminarRenglon = (id: string) => {
    if (renglones.length === 1) return
    setRenglones(prev => prev.filter(r => r.id !== id))
  }

  const calcularTotales = () => {
    const subtotal = renglones.reduce((sum, r) => {
      const pesoTotal = r.cantidad * r.pesoPromedio
      const importe = pesoTotal * r.precioKg
      return sum + importe
    }, 0)

    return {
      subtotal,
      neto: subtotal,
    }
  }

  const totales = calcularTotales()

  const validarPaso1 = () => {
    if (!fecha || !proveedor.trim()) {
      toast.error('Completá fecha y proveedor')
      return false
    }

    if (metodoPago === 'Plazo' && diasPlazo < 1) {
      toast.error('Ingresá los días de plazo')
      return false
    }

    return true
  }

  const validarPaso2 = () => {
    if (renglones.some(r => !r.categoria || r.cantidad <= 0 || r.precioKg <= 0 || r.pesoPromedio <= 0)) {
      toast.error('Completá todos los renglones con valores válidos')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validarPaso2()) return

    setLoading(true)

    try {
      const payload = {
        fecha,
        proveedor: proveedor.trim(),
        consignatario: consignatario.trim() || null,
        nroTropa: nroTropa.trim() || null,
        nroFactura: nroFactura.trim() || null,
        metodoPago,
        diasPlazo: metodoPago === 'Plazo' ? diasPlazo : null,
        fechaVencimiento: fechaVencimiento || null,
        pagado: metodoPago === 'Contado' ? true : pagado,
        moneda: 'USD',
        tasaCambio: null,
        subtotalUSD: totales.subtotal,
        totalImpuestosUSD: 0,
        totalNetoUSD: totales.neto,
        impuestos: null,
        imageUrl: null,
        imageName: null,
        notas: notas.trim() || null,
        renglones: renglones.map(r => ({
          tipoAnimal: r.tipoAnimal,
          categoria: r.categoria,
          raza: null,
          cantidad: r.cantidad,
          pesoPromedio: r.pesoPromedio,
          precioKgUSD: r.precioKg,
          agregarAlStock: r.agregarAlStock,
          animalLoteId: r.animalLoteId,
        })),
      }

      const response = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Error al crear compra')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error:', error)
      toast.error(error.message || 'Error al crear la compra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            🛒
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Nueva Compra</h2>
            <p className="text-sm text-gray-600">
              {paso === 1 ? 'Paso 1: Datos generales' : 'Paso 2: Detalle de animales'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* PASO 1: DATOS GENERALES */}
      {paso === 1 && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Información de la Compra</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Compra *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor *
                </label>
                <input
                  type="text"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej: Estancia Las Rosas..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consignatario
                </label>
                <input
                  type="text"
                  value={consignatario}
                  onChange={(e) => setConsignatario(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nro. Tropa
                </label>
                <input
                  type="text"
                  value={nroTropa}
                  onChange={(e) => setNroTropa(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nro. Factura
                </label>
                <input
                  type="text"
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* CONDICIÓN DE PAGO */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Condición de Pago</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={metodoPago === 'Contado'}
                    onChange={() => setMetodoPago('Contado')}
                  />
                  Contado
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={metodoPago === 'Plazo'}
                    onChange={() => setMetodoPago('Plazo')}
                  />
                  Plazo
                </label>
              </div>

              {metodoPago === 'Plazo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Días de Plazo *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={diasPlazo}
                      onChange={(e) => setDiasPlazo(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Vencimiento
                    </label>
                    <input
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={pagado}
                        onChange={(e) => setPagado(e.target.checked)}
                      />
                      Marcar como pagado
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOTAS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
              type="button"
              onClick={() => {
                if (validarPaso1()) setPaso(2)
              }}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: RENGLONES */}
      {paso === 2 && (
        <div className="space-y-6">
          <div className="bg-green-50 rounded-lg p-3 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
              {renglones.length}
            </span>
            <h3 className="font-semibold text-gray-900">Renglones de Compra</h3>
          </div>

          <div className="space-y-4">
            {renglones.map((renglon, idx) => {
              const categorias = renglon.tipoAnimal === 'BOVINO' ? categoriasBovinas : categoriasOvinas

              return (
                <div
                  key={renglon.id}
                  className="border-l-4 border-green-500 pl-4 py-3 bg-gray-50 rounded-r-lg relative"
                >
                  {renglones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarRenglon(renglon.id)}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  )}

                  <div className="mb-2 font-medium text-gray-700">Renglón {idx + 1}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tipo Animal</label>
                      <select
                        value={renglon.tipoAnimal}
                        onChange={(e) => handleRenglonChange(renglon.id, 'tipoAnimal', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="BOVINO">Bovino</option>
                        <option value="OVINO">Ovino</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                      <select
                        value={renglon.categoria}
                        onChange={(e) => handleRenglonChange(renglon.id, 'categoria', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Seleccionar...</option>
                        {categorias.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={renglon.cantidad || ''}
                        onChange={(e) => handleRenglonChange(renglon.id, 'cantidad', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Precio/kg (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={renglon.precioKg || ''}
                        onChange={(e) => handleRenglonChange(renglon.id, 'precioKg', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Peso/animal (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={renglon.pesoPromedio || ''}
                        onChange={(e) => handleRenglonChange(renglon.id, 'pesoPromedio', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {/* CÁLCULOS AUTOMÁTICOS */}
                  {renglon.cantidad > 0 && renglon.precioKg > 0 && renglon.pesoPromedio > 0 && (
                    <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio/animal:</span>
                        <span className="font-semibold">{(renglon.pesoPromedio * renglon.precioKg).toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Peso lote:</span>
                        <span className="font-semibold">{(renglon.cantidad * renglon.pesoPromedio).toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Importe:</span>
                        <span className="font-bold text-green-600">{(renglon.cantidad * renglon.pesoPromedio * renglon.precioKg).toFixed(2)} USD</span>
                      </div>
                    </div>
                  )}

                  {/* AGREGAR AL STOCK */}
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input
                        type="checkbox"
                        checked={renglon.agregarAlStock}
                        onChange={(e) => handleRenglonChange(renglon.id, 'agregarAlStock', e.target.checked)}
                      />
                      <span className="font-medium">Agregar al stock</span>
                    </label>

                    {renglon.agregarAlStock && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Potrero de destino
                        </label>
                        <select
                          value={renglon.animalLoteId || ''}
                          onChange={(e) => handleRenglonChange(renglon.id, 'animalLoteId', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                        >
                          <option value="">Seleccionar potrero...</option>
                          {potreros.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                        {potreros.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            No hay potreros disponibles
                          </p>
                        )}
                      </div>
                    )}

                    {!renglon.agregarAlStock && (
                      <p className="text-xs text-gray-600">
                        💡 Marcá esto si querés agregar estos animales al stock del campo
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AGREGAR RENGLÓN */}
          <button
            type="button"
            onClick={agregarRenglon}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
              +
            </span>
            Agregar Otro Renglón
          </button>

          {/* TOTALES */}
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-900">Subtotal:</span>
              <span className="text-xl font-bold text-gray-900">
                {totales.subtotal.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total Neto:</span>
              <span className="text-2xl font-bold text-green-600">
                {totales.neto.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Atrás
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Guardando...' : 'Confirmar Compra'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}