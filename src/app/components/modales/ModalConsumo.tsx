'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalConsumoProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
}

type AnimalLote = {
  id: string
  categoria: string
  cantidad: number
}

export default function ModalConsumo({ onClose, onSuccess }: ModalConsumoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [cantidadMaxima, setCantidadMaxima] = useState(0)
  const [peso, setPeso] = useState('')
  const [precioKg, setPrecioKg] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)

  // Cargar potreros al montar
  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => setPotreros(data))
      .catch(() => alert('Error al cargar potreros'))
  }, [])

  // Cargar animales cuando se selecciona potrero
  useEffect(() => {
    if (!potreroSeleccionado) {
      setAnimalesDisponibles([])
      setCategoriaSeleccionada('')
      return
    }

    setLoadingAnimales(true)
    fetch(`/api/lotes/${potreroSeleccionado}/animales`)
      .then((res) => res.json())
      .then((data) => {
        // ✅ FILTRAR EQUINOS (no se comen)
        const animalesFiltrados = data.filter((animal: AnimalLote) => {
          const categoria = animal.categoria.toLowerCase()
          return !categoria.includes('yeguarizo') && 
                 !categoria.includes('yeguarizos') &&
                 !categoria.includes('padrillo') &&
                 !categoria.includes('padrillos') &&
                 !categoria.includes('caballo') &&
                 !categoria.includes('yegua') &&
                 !categoria.includes('potro') &&
                 !categoria.includes('potrillo')
        })
        setAnimalesDisponibles(animalesFiltrados)
        setLoadingAnimales(false)
      })
      .catch(() => {
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  // Actualizar cantidad máxima cuando se selecciona categoría
  useEffect(() => {
    if (categoriaSeleccionada) {
      const animal = animalesDisponibles.find((a) => a.categoria === categoriaSeleccionada)
      setCantidadMaxima(animal?.cantidad || 0)
    }
  }, [categoriaSeleccionada, animalesDisponibles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      alert('Debe seleccionar un potrero')
      return
    }

    if (!categoriaSeleccionada) {
      alert('Debe seleccionar una categoría')
      return
    }

    const cant = parseInt(cantidad)
    if (cant <= 0 || cant > cantidadMaxima) {
      alert(`La cantidad debe estar entre 1 y ${cantidadMaxima}`)
      return
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre
      const categoriaLabel = cant === 1 ? categoriaSeleccionada.replace(/s$/, '') : categoriaSeleccionada

      // Obtener el animalLoteId
      const animalLote = animalesDisponibles.find(a => a.categoria === categoriaSeleccionada)

      console.log('🐄 Animal Lote encontrado:', animalLote)
      console.log('📦 Datos a enviar:', {
        fecha,
        descripcion: `Consumo de ${cant} ${categoriaLabel} del potrero ${potreroNombre}`,
        notas: notas || null,
        renglon: {
          categoria: categoriaSeleccionada,
          cantidad: cant,
          pesoPromedio: peso ? parseFloat(peso) : null,
          precioKgUSD: precioKg ? parseFloat(precioKg) : null,
          animalLoteId: animalLote?.id || null,
          loteId: potreroSeleccionado,
        }
      })

      const response = await fetch('/api/consumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fecha,
          descripcion: `Consumo de ${cant} ${categoriaLabel} del potrero ${potreroNombre}`,
          notas: notas || null,
          renglon: {
            categoria: categoriaSeleccionada,
            cantidad: cant,
            pesoPromedio: peso ? parseFloat(peso) : null,
            precioKgUSD: precioKg ? parseFloat(precioKg) : null,
            animalLoteId: animalLote?.id || null,
            loteId: potreroSeleccionado,
          }
        }),
      })

      console.log('📡 Response status:', response.status)
      
      const responseData = await response.json()
      console.log('📡 Response data:', responseData)

      if (!response.ok) {
        throw new Error(responseData.error || 'Error al guardar')
      }

      console.log('✅ Consumo creado exitosamente')
      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar consumo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            🍖
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Consumo</h2>
        </div>
        <button
          onClick={onClose}
          type="button"
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

        {/* POTRERO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Potrero</label>
          <select
            value={potreroSeleccionado}
            onChange={(e) => {
              setPotreroSeleccionado(e.target.value)
              setCategoriaSeleccionada('')
              setCantidad('1')
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Seleccionar potrero</option>
            {potreros.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* ANIMALES */}
        {potreroSeleccionado && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Animales</h3>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                No hay animales disponibles para consumo en este potrero
              </p>
            ) : (
              <div className="space-y-3">
                {/* Tipo de animal */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tipo de animal</label>
                  <select
                    value={categoriaSeleccionada}
                    onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {animalesDisponibles.map((animal) => (
                      <option key={animal.id} value={animal.categoria}>
                        {animal.categoria} ({animal.cantidad} disponibles)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                {categoriaSeleccionada && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                    <input
                      type="number"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      min="1"
                      max={cantidadMaxima}
                      placeholder="Cantidad"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                )}

                {/* Peso (opcional) */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Peso promedio (kg) - Opcional</label>
                  <input
                    type="number"
                    step="0.1"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    placeholder="Ej: 380"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Precio/kg (opcional) */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Precio U$S/kg - Opcional</label>
                  <input
                    type="number"
                    step="0.01"
                    value={precioKg}
                    onChange={(e) => setPrecioKg(e.target.value)}
                    placeholder="Ej: 1.60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (Opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas adicionales..."
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
          disabled={loading || !potreroSeleccionado || !categoriaSeleccionada}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}