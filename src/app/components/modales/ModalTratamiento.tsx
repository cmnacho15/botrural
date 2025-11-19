'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalTratamientoProps = {
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

export default function ModalTratamiento({ onClose, onSuccess }: ModalTratamientoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [marca, setMarca] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)

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
        setAnimalesDisponibles(data)
        setLoadingAnimales(false)
      })
      .catch(() => {
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      setErrorPotrero(true)
      return
    }

    if (!tratamiento.trim()) {
      alert('Debe ingresar el tratamiento')
      return
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'TRATAMIENTO',
          fecha: fecha,
          descripcion: `Tratamiento: ${tratamiento}${marca ? ` - ${marca}` : ''}${categoriaSeleccionada ? ` en ${categoriaSeleccionada}` : ''} en potrero ${potreroNombre}`,
          loteId: potreroSeleccionado,
          categoria: categoriaSeleccionada || null,
          notas: notas || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar tratamiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-2xl">
            💉
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Tratamiento</h2>
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
              setErrorPotrero(false)
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errorPotrero ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Potrero</option>
            {potreros.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre}
              </option>
            ))}
          </select>
          {errorPotrero && (
            <p className="text-red-500 text-xs mt-1">El potrero es obligatorio</p>
          )}
        </div>

        {/* TRATAMIENTO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tratamiento</label>
          <input
            type="text"
            value={tratamiento}
            onChange={(e) => setTratamiento(e.target.value)}
            placeholder="Tratamiento"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* MARCA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Marca (Opcional)</label>
          <input
            type="text"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca (Opcional)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ANIMALES */}
        {potreroSeleccionado && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Animales</h3>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                Selecciona un potrero para cargar los animales
              </p>
            ) : (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Categoría (Opcional)</label>
                <select
                  value={categoriaSeleccionada}
                  onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Todos los animales</option>
                  {animalesDisponibles.map((animal) => (
                    <option key={animal.id} value={animal.categoria}>
                      {animal.categoria} ({animal.cantidad} disponibles)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* NOTAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas"
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
          disabled={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}