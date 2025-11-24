'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type Insumo = {
  id: string
  nombre: string
  unidad: string
  stock: number
}

type Lote = {
  id: string
  nombre: string
}

type InsumoSeleccionado = {
  id: string
  insumoId: string
  nombre: string
  unidad: string
  cantidad: string
  stockDisponible: number
}

type ModalUsoInsumosProps = {
  onClose: () => void
  onSuccess: () => void
  insumoPreseleccionadoId?: string | null 
}

export default function ModalUsoInsumos({ onClose, onSuccess, insumoPreseleccionadoId }: ModalUsoInsumosProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loteId, setLoteId] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loadingInsumos, setLoadingInsumos] = useState(true)
  
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<InsumoSeleccionado[]>([
    { id: crypto.randomUUID(), insumoId: '', nombre: '', unidad: '', cantidad: '', stockDisponible: 0 }
  ])
  
  // Crear nuevo insumo
  const [mostrarCrearInsumo, setMostrarCrearInsumo] = useState(false)
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('')
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('Litros')

  const unidades = [
    'Litros', 'Kilos', 'Gramos', 'Toneladas', 'Unidades', 
    'Metros', 'Centímetros', 'Bolsas', 'Cajas', 'Dosis',
    'Mililitros', 'Frascos', 'Rollos'
  ]

  // Cargar insumos y lotes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [insumosRes, lotesRes] = await Promise.all([
          fetch('/api/insumos'),
          fetch('/api/lotes')
        ])
        
        const insumosData = await insumosRes.json()
        const lotesData = await lotesRes.json()
        
        setInsumos(insumosData)
        setLotes(lotesData)
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setLoadingInsumos(false)
      }
    }

    fetchData()
  }, [])

   // Preseleccionar insumo si viene desde la página
useEffect(() => {
  if (insumoPreseleccionadoId && insumos.length > 0) {
    const insumo = insumos.find(i => i.id === insumoPreseleccionadoId)
    if (insumo) {
      setInsumosSeleccionados([{
        id: crypto.randomUUID(),
        insumoId: insumo.id,
        nombre: insumo.nombre,
        unidad: insumo.unidad,
        cantidad: '',
        stockDisponible: insumo.stock  // 👈 IMPORTANTE: incluir stock
      }])
    }
  }
}, [insumoPreseleccionadoId, insumos])

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
      setMostrarCrearInsumo(false)
      setNuevoInsumoNombre('')
      setNuevoInsumoUnidad('Litros')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear el insumo')
    }
  }

  const handleInsumoChange = (id: string, insumoId: string) => {
    const insumo = insumos.find(i => i.id === insumoId)
    setInsumosSeleccionados(prev =>
      prev.map(item =>
        item.id === id
          ? { 
              ...item, 
              insumoId, 
              nombre: insumo?.nombre || '', 
              unidad: insumo?.unidad || '',
              stockDisponible: insumo?.stock || 0
            }
          : item
      )
    )
  }

  const handleCantidadChange = (id: string, cantidad: string) => {
    setInsumosSeleccionados(prev =>
      prev.map(item => (item.id === id ? { ...item, cantidad } : item))
    )
  }

  const agregarInsumo = () => {
    setInsumosSeleccionados([
      ...insumosSeleccionados,
      { id: crypto.randomUUID(), insumoId: '', nombre: '', unidad: '', cantidad: '', stockDisponible: 0 }
    ])
  }

  const eliminarInsumo = (id: string) => {
    if (insumosSeleccionados.length === 1) return
    setInsumosSeleccionados(prev => prev.filter(item => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const insumosValidos = insumosSeleccionados.filter(i => i.insumoId && i.cantidad)
    
    if (insumosValidos.length === 0) {
      alert('Agregá al menos un insumo con cantidad')
      return
    }

    // Validar stock
    for (const insumo of insumosValidos) {
      const cantidad = parseFloat(insumo.cantidad)
      if (cantidad > insumo.stockDisponible) {
        alert(`No hay suficiente stock de ${insumo.nombre}. Disponible: ${insumo.stockDisponible} ${insumo.unidad}`)
        return
      }
    }

    setLoading(true)

    try {
      for (const insumo of insumosValidos) {
        const response = await fetch('/api/insumos/movimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'USO',
            fecha,
            insumoId: insumo.insumoId,
            cantidad: parseFloat(insumo.cantidad),
            loteId: loteId || null,
            notas,
          }),
        })

        if (!response.ok) throw new Error('Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar el uso de insumos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
            📤
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Uso de Insumos</h2>
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
        {/* FECHA */}
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

        {/* POTRERO (OPCIONAL) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Potrero (Opcional)</label>
          <select
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccioná un potrero (opcional)</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* INSUMOS */}
        <div className="bg-orange-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Insumos</h3>

          {loadingInsumos ? (
            <div className="text-sm text-gray-500">Cargando insumos...</div>
          ) : (
            <div className="space-y-3">
              {insumosSeleccionados.map((item, index) => (
                <div key={item.id} className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    {/* Item */}
                    <div className="col-span-5">
                      {index === 0 && <label className="block text-xs text-gray-600 mb-1">Item</label>}
                      <select
                        value={item.insumoId}
                        onChange={(e) => handleInsumoChange(item.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                        required
                      >
                        <option value="">Seleccionar</option>
                        {insumos.map((insumo) => (
                          <option key={insumo.id} value={insumo.id}>
                            {insumo.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cantidad */}
                    <div className="col-span-4">
                      {index === 0 && <label className="block text-xs text-gray-600 mb-1">Cantidad</label>}
                      <input
                        type="number"
                        step="0.01"
                        value={item.cantidad}
                        onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        required
                      />
                    </div>

                    {/* Unidad */}
                    <div className="col-span-2">
                      {index === 0 && <label className="block text-xs text-gray-600 mb-1">Unidad</label>}
                      <input
                        type="text"
                        value={item.unidad}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600"
                      />
                    </div>

                    {/* Botón eliminar */}
                    <div className="col-span-1 flex items-end">
                      {index === 0 && <div className="h-[21px]"></div>}
                      {insumosSeleccionados.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarInsumo(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock disponible */}
                  {item.insumoId && (
                    <div className="text-xs text-gray-600 pl-1">
                      Stock disponible: <span className="font-medium">{item.stockDisponible} {item.unidad}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Botón agregar otro insumo */}
              <button
                type="button"
                onClick={agregarInsumo}
                className="w-full py-2 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <span>+</span>
                <span>Agregar Otro Insumo</span>
              </button>

              {/* Crear nuevo insumo */}
              {!mostrarCrearInsumo ? (
                <button
                  type="button"
                  onClick={() => setMostrarCrearInsumo(true)}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  + Crear nuevo insumo
                </button>
              ) : (
                <div className="mt-3 p-4 bg-white rounded-lg border border-orange-200 space-y-3">
                  <h4 className="font-medium text-gray-900 text-sm">Crear nuevo insumo</h4>
                  
                  <input
                    type="text"
                    placeholder="Nombre del insumo"
                    value={nuevoInsumoNombre}
                    onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />

                  <select
                    value={nuevoInsumoUnidad}
                    onChange={(e) => setNuevoInsumoUnidad(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {unidades.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCrearInsumo}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
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
            </div>
          )}
        </div>

        {/* NOTAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (Opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ingresá cualquier otro dato que quieras registrar para esta transacción."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* BOTONES */}
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
          className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}