'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalMortandadProps = {
  onClose: () => void
  onSuccess: () => void
}

type Modulo = {
  id: string
  nombre: string
}

type Lote = {
  id: string
  nombre: string
  moduloPastoreoId: string | null
  moduloPastoreo?: Modulo | null
}

type AnimalLote = {
  id: string
  categoria: string
  cantidad: number
}

export default function ModalMortandad({ onClose, onSuccess }: ModalMortandadProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [tieneModulos, setTieneModulos] = useState(false)
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [cantidadMaxima, setCantidadMaxima] = useState(0)
  const [notas, setNotas] = useState('')
  const [caravana, setCaravana] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)

  // 🔥 AGREGAR ESTO 👇
  const esBovino = (categoria: string) => {
    const categoriaLower = categoria.toLowerCase()
    return categoriaLower.includes('vaca') || 
           categoriaLower.includes('toro') || 
           categoriaLower.includes('novillo') || 
           categoriaLower.includes('ternero') ||
           categoriaLower.includes('vaquillona')
  }
  // 🔥 HASTA AQUÍ

  // Cargar potreros al montar
  useEffect(() => {
  fetch('/api/lotes')
    .then((res) => res.json())
    .then((data) => {
      setPotreros(data)
      // Detectar si el campo usa módulos
      const hayModulos = data.some((l: Lote) => l.moduloPastoreoId !== null)
      setTieneModulos(hayModulos)
    })
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
      const potreroData = potreros.find(p => p.id === potreroSeleccionado)
const potreroNombre = potreroData?.moduloPastoreo?.nombre 
  ? `${potreroData.nombre} (${potreroData.moduloPastoreo.nombre})`
  : potreroData?.nombre
const categoriaLabel = cant === 1 ? categoriaSeleccionada.replace(/s$/, '') : categoriaSeleccionada

const descripcionBase = `Mortandad de ${cant} ${categoriaLabel} en potrero ${potreroNombre}`
const descripcionCompleta = caravana 
  ? `${descripcionBase} - Caravana: ${caravana}`
  : descripcionBase

const response = await fetch('/api/eventos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tipo: 'MORTANDAD',
    fecha: fecha,
    descripcion: descripcionCompleta,
    loteId: potreroSeleccionado,
    cantidad: cant,
    categoria: categoriaSeleccionada,
    caravana: caravana || null,
    notas: notas || null,
  }),
})

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar mortandad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💀
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Mortandad</h2>
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
  <option value="">Seleccionar potrero...</option>
  {tieneModulos ? (
    Object.entries(
      potreros.reduce((acc, potrero) => {
        const moduloNombre = potrero.moduloPastoreo?.nombre || 'Sin Módulo'
        if (!acc[moduloNombre]) acc[moduloNombre] = []
        acc[moduloNombre].push(potrero)
        return acc
      }, {} as Record<string, Lote[]>)
    ).map(([moduloNombre, lotes]) => (
      <optgroup key={moduloNombre} label={moduloNombre}>
        {lotes.map((lote) => (
          <option key={lote.id} value={lote.id}>
            {lote.nombre}
          </option>
        ))}
      </optgroup>
    ))
  ) : (
    potreros.map((lote) => (
      <option key={lote.id} value={lote.id}>
        {lote.nombre}
      </option>
    ))
  )}
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
                Selecciona un potrero para cargar los animales
              </p>
            ) : (
              <div className="space-y-3">
                {/* Categoría */}
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
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
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

        {/* CARAVANA - Solo para bovinos */}
{categoriaSeleccionada && esBovino(categoriaSeleccionada) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caravana (opcional)
            </label>
            <input
              type="text"
              value={caravana}
              onChange={(e) => setCaravana(e.target.value)}
              placeholder="Ej: 1234"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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
          disabled={loading || !potreroSeleccionado || !categoriaSeleccionada}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}