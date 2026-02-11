'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

type ModalNacimientoProps = {
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

export default function ModalNacimiento({ onClose, onSuccess }: ModalNacimientoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [tieneModulos, setTieneModulos] = useState(false)
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [loadingAnimales, setLoadingAnimales] = useState(false)
  
  const [tipoAnimal, setTipoAnimal] = useState<'terneros' | 'corderos'>('terneros')
  const [cantidad, setCantidad] = useState('1')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

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
    .catch(() => toast.error('Error al cargar potreros'))
}, [])

  // Cargar animales cuando se selecciona potrero (para mostrar info)
  useEffect(() => {
    if (!potreroSeleccionado) {
      setAnimalesDisponibles([])
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
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      toast.error('Debe seleccionar un potrero')
      return
    }

    const cant = parseInt(cantidad)
    if (cant <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    setLoading(true)

    try {
      // Convertir a la categoría correcta con "Mamones"
      const categoriaGuardar = tipoAnimal === 'terneros' 
  ? 'Terneros nacidos'  // ✅ NUEVA CATEGORÍA
  : 'Corderos/as Mamones'

      const potreroData = potreros.find(p => p.id === potreroSeleccionado)
const potreroNombre = potreroData?.moduloPastoreo?.nombre 
  ? `${potreroData.nombre} (${potreroData.moduloPastoreo.nombre})`
  : potreroData?.nombre

const response = await fetch('/api/eventos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tipo: 'NACIMIENTO',
    fecha: fecha,
    descripcion: `Nacimiento de ${cant} ${tipoAnimal} en potrero ${potreroNombre}`,
    loteId: potreroSeleccionado,
    cantidad: cant,
    categoria: categoriaGuardar,
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
      toast.error(error instanceof Error ? error.message : 'Error al registrar nacimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
            🐣
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Nacimiento</h2>
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
  onChange={(e) => setPotreroSeleccionado(e.target.value)}
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
            ) : (
              <div className="space-y-3">
                {/* Tipo de animal */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tipo de animal</label>
                  <select
                    value={tipoAnimal}
                    onChange={(e) => setTipoAnimal(e.target.value as 'terneros' | 'corderos')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    required
                  >
                    <option value="terneros">Terneros nacidos</option>
                    <option value="corderos">Corderos/as Mamones</option>
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    required
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
          disabled={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}