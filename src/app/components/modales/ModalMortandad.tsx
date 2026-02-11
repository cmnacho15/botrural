'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

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
  animalesLote?: any[]
}

type AnimalLote = {
  id: string
  categoria: string
  cantidad: number
}

type AnimalMuerto = {
  id: string
  categoria: string
  cantidad: string
  caravana: string
}

export default function ModalMortandad({ onClose, onSuccess }: ModalMortandadProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [tieneModulos, setTieneModulos] = useState(false)
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)

  const [animalesMuertos, setAnimalesMuertos] = useState<AnimalMuerto[]>([
    { id: '1', categoria: '', cantidad: '', caravana: '' }
  ])

  const esBovino = (categoria: string) => {
    const categoriaLower = categoria.toLowerCase()
    return categoriaLower.includes('vaca') ||
           categoriaLower.includes('toro') ||
           categoriaLower.includes('novillo') ||
           categoriaLower.includes('ternero') ||
           categoriaLower.includes('vaquillona')
  }

  const agregarCategoria = () => {
    setAnimalesMuertos([
      ...animalesMuertos,
      { id: Date.now().toString(), categoria: '', cantidad: '', caravana: '' }
    ])
  }

  const eliminarCategoria = (id: string) => {
    if (animalesMuertos.length > 1) {
      setAnimalesMuertos(animalesMuertos.filter(a => a.id !== id))
    }
  }

  const actualizarCategoria = (id: string, campo: keyof AnimalMuerto, valor: string) => {
    setAnimalesMuertos(animalesMuertos.map(a =>
      a.id === id ? { ...a, [campo]: valor } : a
    ))
  }

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

  // Cargar animales cuando se selecciona potrero
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
        toast.error('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      toast.error('Debe seleccionar un potrero')
      return
    }

    // Validar que haya al menos 1 categoría con datos
    const animalesValidos = animalesMuertos.filter(a => a.categoria && parseInt(a.cantidad) > 0)
    if (animalesValidos.length < 1) {
      toast.error('Debe registrar al menos 1 categoría con cantidad')
      return
    }

    // Validar que no exceda cantidades disponibles
    for (const animal of animalesValidos) {
      const disponible = animalesDisponibles.find(d => d.categoria === animal.categoria)
      if (!disponible) {
        toast.error(`No hay animales de tipo ${animal.categoria} en este potrero`)
        return
      }
      const cantidadSolicitada = parseInt(animal.cantidad)
      if (cantidadSolicitada > disponible.cantidad) {
        toast.info(`Solo hay ${disponible.cantidad} ${animal.categoria} disponibles`)
        return
      }
    }

    setLoading(true)

    try {
      const potreroData = potreros.find(p => p.id === potreroSeleccionado)
      const potreroNombre = potreroData?.moduloPastoreo?.nombre
        ? `${potreroData.nombre} (${potreroData.moduloPastoreo.nombre})`
        : potreroData?.nombre

      // Construir descripción con todos los resultados
      const detalles = animalesValidos.map(a => {
        const cant = parseInt(a.cantidad)
        const categoriaLabel = cant === 1 ? a.categoria.replace(/s$/, '') : a.categoria
        return a.caravana
          ? `${cant} ${categoriaLabel} (Caravana: ${a.caravana})`
          : `${cant} ${categoriaLabel}`
      }).join(', ')

      const descripcion = `Mortandad en potrero ${potreroNombre}: ${detalles}`

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'MORTANDAD',
          fecha: fecha,
          descripcion: descripcion,
          loteId: potreroSeleccionado,
          cantidad: animalesValidos.reduce((sum, a) => sum + parseInt(a.cantidad), 0),
          categoria: animalesValidos[0].categoria,
          categorias: animalesValidos.map(a => ({
            categoria: a.categoria,
            cantidad: parseInt(a.cantidad),
            caravana: a.caravana || null
          })),
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
      toast.error(error instanceof Error ? error.message : 'Error al registrar mortandad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            💀
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Mortandad</h2>
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
    setAnimalesMuertos([{ id: '1', categoria: '', cantidad: '', caravana: '' }])
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
        {lotes.map((lote) => {
          const resumen = lote.animalesLote && lote.animalesLote.length > 0
            ? lote.animalesLote
                .filter((a: any) => a.cantidad > 0)
                .map((a: any) => `${a.categoria} ${a.cantidad}`)
                .join(', ')
            : 'Sin animales'

          return (
            <option key={lote.id} value={lote.id}>
              {lote.nombre} ({resumen})
            </option>
          )
        })}
      </optgroup>
    ))
  ) : (
    potreros.map((lote) => {
      const resumen = lote.animalesLote && lote.animalesLote.length > 0
        ? lote.animalesLote
            .filter((a: any) => a.cantidad > 0)
            .map((a: any) => `${a.categoria} ${a.cantidad}`)
            .join(', ')
        : 'Sin animales'

      return (
        <option key={lote.id} value={lote.id}>
          {lote.nombre} ({resumen})
        </option>
      )
    })
  )}
</select>
        </div>

        {/* ANIMALES */}
        {potreroSeleccionado && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Animales</h3>
              <button
                type="button"
                onClick={agregarCategoria}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <span className="text-xl">➕</span> Agregar otra categoría
              </button>
            </div>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                No hay animales en este potrero
              </p>
            ) : (
              <div className="space-y-4">
                {animalesMuertos.map((animal, index) => (
                  <div key={animal.id} className="bg-white rounded-lg p-3 relative">
                    {animalesMuertos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarCategoria(animal.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">Categoría {index + 1}</p>
                      {/* Categoría */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                        <select
                          value={animal.categoria}
                          onChange={(e) => actualizarCategoria(animal.id, 'categoria', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                        >
                          <option value="">Seleccionar categoría...</option>
                          {animalesDisponibles.map((a) => (
                            <option key={a.id} value={a.categoria}>
                              {a.categoria} ({a.cantidad} disponibles)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Cantidad */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={animal.cantidad}
                          onChange={(e) => actualizarCategoria(animal.id, 'cantidad', e.target.value)}
                          min="1"
                          placeholder="Cantidad"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {/* Caravana - Solo para bovinos */}
                      {animal.categoria && esBovino(animal.categoria) && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Caravana (opcional)</label>
                          <input
                            type="text"
                            value={animal.caravana}
                            onChange={(e) => actualizarCategoria(animal.id, 'caravana', e.target.value)}
                            placeholder="Ej: 1234"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
          disabled={loading || !potreroSeleccionado}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}