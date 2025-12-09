'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalCambioPotreroProps = {
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

export default function ModalCambioPotrero({ onClose, onSuccess }: ModalCambioPotreroProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroOrigen, setPotreroOrigen] = useState('')
  const [potreroDestino, setPotreroDestino] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [cantidadMover, setCantidadMover] = useState('')
  const [cantidadMaxima, setCantidadMaxima] = useState(0)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)

  // ✅ NUEVOS ESTADOS PARA RODEOS
  const [rodeos, setRodeos] = useState<{ id: string; nombre: string }[]>([])
  const [rodeoSeleccionado, setRodeoSeleccionado] = useState('')
  const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')

  // ✅ CARGAR CONFIGURACIÓN DE RODEOS, POTREROS Y RODEOS AL MONTAR
  useEffect(() => {
    Promise.all([
      fetch('/api/configuracion-rodeos').then(r => r.json()),
      fetch('/api/lotes').then(r => r.json()),
      fetch('/api/rodeos').then(r => r.json())
    ])
      .then(([config, lotes, rodeosData]) => {
        setModoRodeo(config.modoRodeo || 'OPCIONAL')
        setPotreros(lotes)
        setRodeos(rodeosData)
      })
      .catch(() => alert('Error al cargar datos'))
  }, [])

  // Cargar animales cuando se selecciona potrero origen
  useEffect(() => {
    if (!potreroOrigen) {
      setAnimalesDisponibles([])
      setCategoriaSeleccionada('')
      return
    }

    setLoadingAnimales(true)
    fetch(`/api/lotes/${potreroOrigen}/animales`)
      .then((res) => res.json())
      .then((data) => {
        setAnimalesDisponibles(data)
        setLoadingAnimales(false)
      })
      .catch(() => {
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroOrigen])

  // Actualizar cantidad máxima cuando se selecciona categoría
  useEffect(() => {
    if (categoriaSeleccionada) {
      const animal = animalesDisponibles.find((a) => a.categoria === categoriaSeleccionada)
      setCantidadMaxima(animal?.cantidad || 0)
      setCantidadMover(animal?.cantidad.toString() || '')
    }
  }, [categoriaSeleccionada, animalesDisponibles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (potreroOrigen === potreroDestino) {
      alert('El potrero destino debe ser diferente al origen')
      return
    }

    if (!categoriaSeleccionada || !cantidadMover) {
      alert('Debe seleccionar animales y cantidad')
      return
    }

    const cantidad = parseInt(cantidadMover)
    if (cantidad <= 0 || cantidad > cantidadMaxima) {
      alert(`La cantidad debe estar entre 1 y ${cantidadMaxima}`)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'CAMBIO_POTRERO',
          fecha: fecha,
          descripcion: `Cambio de ${cantidad} ${categoriaSeleccionada} al ${potreros.find(p => p.id === potreroDestino)?.nombre}${rodeoSeleccionado && rodeos.find(r => r.id === rodeoSeleccionado) ? ` - Rodeo ${rodeos.find(r => r.id === rodeoSeleccionado)?.nombre}` : ''}`,
          loteId: potreroOrigen,
          loteDestinoId: potreroDestino,
          categoria: categoriaSeleccionada,
          cantidad,
          notas: notas || null,
          rodeoId: rodeoSeleccionado || null, // ✅ AGREGAR RODEO
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar de potrero')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            ⊞
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Cambio De Potrero</h2>
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

        {/* POTREROS */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">Potreros</label>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Potrero Origen */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Potrero Original</label>
              <select
                value={potreroOrigen}
                onChange={(e) => {
                  setPotreroOrigen(e.target.value)
                  setCategoriaSeleccionada('')
                  setCantidadMover('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                required
              >
                <option value="">Seleccionar...</option>
                {potreros.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Potrero Destino */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Potrero Destino</label>
              <select
                value={potreroDestino}
                onChange={(e) => setPotreroDestino(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                required
                disabled={!potreroOrigen}
              >
                <option value="">Seleccionar...</option>
                {potreros
                  .filter((p) => p.id !== potreroOrigen)
                  .map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* ANIMALES */}
        {potreroOrigen && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Animales</h3>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                Selecciona los potreros para cargar los animales
              </p>
            ) : (
              <div className="space-y-3">
                {/* Selector de categoría */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                  <select
                    value={categoriaSeleccionada}
                    onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    required
                  >
                    <option value="">Seleccionar categoría...</option>
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
                    <label className="block text-xs text-gray-600 mb-1">
                      Cantidad (máx: {cantidadMaxima})
                    </label>
                    <input
                      type="number"
                      value={cantidadMover}
                      onChange={(e) => setCantidadMover(e.target.value)}
                      min="1"
                      max={cantidadMaxima}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ✅ SELECTOR DE RODEO */}
        {modoRodeo !== 'NO_INCLUIR' && rodeos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rodeo {modoRodeo === 'OBLIGATORIO' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={rodeoSeleccionado}
              onChange={(e) => setRodeoSeleccionado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              required={modoRodeo === 'OBLIGATORIO'}
            >
              <option value="">Seleccionar rodeo...</option>
              {rodeos.map((rodeo) => (
                <option key={rodeo.id} value={rodeo.id}>
                  {rodeo.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* NOTAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (Opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas (Opcional)"
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
          disabled={loading || !potreroOrigen || !potreroDestino || !categoriaSeleccionada || (modoRodeo === 'OBLIGATORIO' && !rodeoSeleccionado)}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Continuar'}
        </button>
      </div>
    </form>
  )
}

// Modal para cambio de potrero - 2025-12-08