'use client'

import { useState, useEffect } from 'react'

type Insumo = {
  id: string
  nombre: string
  unidad: string
  stock: number
}

type ModalIngresoInsumosProps = {
  onClose: () => void
  onSuccess: () => void
}

export default function ModalIngresoInsumos({ onClose, onSuccess }: ModalIngresoInsumosProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [insumoId, setInsumoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loadingInsumos, setLoadingInsumos] = useState(true)
  
  // Crear nuevo insumo
  const [mostrarCrearInsumo, setMostrarCrearInsumo] = useState(false)
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('')
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('Litros')

  const unidades = [
    'Litros', 'Kilos', 'Gramos', 'Toneladas', 'Unidades', 
    'Metros', 'Centímetros', 'Bolsas', 'Cajas', 'Dosis'
  ]

  // Cargar insumos
  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        const res = await fetch('/api/insumos')
        const data = await res.json()
        setInsumos(data)
      } catch (error) {
        console.error('Error cargando insumos:', error)
      } finally {
        setLoadingInsumos(false)
      }
    }

    fetchInsumos()
  }, [])

  const insumoSeleccionado = insumos.find(i => i.id === insumoId)

  const handleCrearInsumo = async () => {
    if (!nuevoInsumoNombre.trim()) {
      alert('Ingresá un nombre para el insumo')
      return
    }

    try {
      const res = await fetch('/api/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoInsumoNombre,
          unidad: nuevoInsumoUnidad,
          stock: 0
        })
      })

      if (!res.ok) throw new Error('Error al crear insumo')

      const nuevoInsumo = await res.json()
      setInsumos([...insumos, nuevoInsumo])
      setInsumoId(nuevoInsumo.id)
      setMostrarCrearInsumo(false)
      setNuevoInsumoNombre('')
      setNuevoInsumoUnidad('Litros')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear el insumo')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!insumoId || !cantidad) {
      alert('Completá todos los campos obligatorios')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'INGRESO_INSUMO',
          fecha,
          descripcion: `Ingreso de ${insumoSeleccionado?.nombre}: ${cantidad} ${insumoSeleccionado?.unidad}`,
          insumoId,
          cantidad: parseFloat(cantidad),
          monto: monto ? parseFloat(monto) : null,
          notas,
        }),
      })

      if (!response.ok) throw new Error('Error al guardar')

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar el ingreso de insumo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            📥
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Ingreso de Insumos</h2>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Insumo *</label>
          {loadingInsumos ? (
            <div className="text-sm text-gray-500">Cargando insumos...</div>
          ) : (
            <>
              <select
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={mostrarCrearInsumo}
              >
                <option value="">Seleccioná un insumo</option>
                {insumos.map((insumo) => (
                  <option key={insumo.id} value={insumo.id}>
                    {insumo.nombre} ({insumo.unidad})
                  </option>
                ))}
              </select>

              {!mostrarCrearInsumo ? (
                <button
                  type="button"
                  onClick={() => setMostrarCrearInsumo(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Crear nuevo insumo
                </button>
              ) : (
                <div className="mt-3 p-4 bg-blue-50 rounded-lg space-y-3">
                  <h3 className="font-medium text-gray-900">Crear nuevo insumo</h3>
                  
                  <input
                    type="text"
                    placeholder="Nombre del insumo"
                    value={nuevoInsumoNombre}
                    onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />

                  <select
                    value={nuevoInsumoUnidad}
                    onChange={(e) => setNuevoInsumoUnidad(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {unidades.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCrearInsumo}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Crear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarCrearInsumo(false)
                        setNuevoInsumoNombre('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cantidad * {insumoSeleccionado && `(${insumoSeleccionado.unidad})`}
          </label>
          <input
            type="number"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto (opcional)
          </label>
          <input
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00 UYU"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Si ingresás un monto, se registrará automáticamente como gasto
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Proveedor, factura, observaciones..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
          disabled={loading || loadingInsumos || mostrarCrearInsumo}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}