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

type AnimalTratado = {
  id: string
  cantidad: string
  tipo: string
  peso: string
}

export default function ModalTratamiento({ onClose, onSuccess }: ModalTratamientoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [tratamiento, setTratamiento] = useState('')
  const [marca, setMarca] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  
  // Estados para rodeos
  const [rodeoId, setRodeoId] = useState<string>('')
  const [rodeos, setRodeos] = useState<any[]>([])
  const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')
  
  const [showPotreroDropdown, setShowPotreroDropdown] = useState(false)

const [animalesTratados, setAnimalesTratados] = useState<AnimalTratado[]>([
    { id: '1', cantidad: '', tipo: '', peso: '' }
  ])

  // Cargar potreros al montar
  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => setPotreros(data))
      .catch(() => alert('Error al cargar potreros'))
  }, [])

  // Cargar rodeos y configuración
  useEffect(() => {
    // Cargar configuración de rodeos
    fetch('/api/configuracion-rodeos')
      .then(r => r.json())
      .then(data => setModoRodeo(data.modoRodeo || 'OPCIONAL'))
      .catch(err => console.error('Error cargando configuración rodeos:', err))
    
    // Cargar lista de rodeos
    fetch('/api/rodeos')
      .then(r => r.json())
      .then(data => setRodeos(data))
      .catch(err => console.error('Error cargando rodeos:', err))
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
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  const agregarAnimal = () => {
    setAnimalesTratados([
      ...animalesTratados,
      { id: Date.now().toString(), cantidad: '', tipo: '', peso: '' }
    ])
  }

  const eliminarAnimal = (id: string) => {
    if (animalesTratados.length > 1) {
      setAnimalesTratados(animalesTratados.filter(a => a.id !== id))
    }
  }

  const actualizarAnimal = (id: string, campo: keyof AnimalTratado, valor: string) => {
    setAnimalesTratados(animalesTratados.map(a =>
      a.id === id ? { ...a, [campo]: valor } : a
    ))
  }

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

    // VALIDAR RODEO OBLIGATORIO
    if (modoRodeo === 'OBLIGATORIO' && !rodeoId) {
      alert('Seleccioná un rodeo')
      return
    }

    // Validar animales tratados
    const animalesValidos = animalesTratados.filter(a => 
      a.cantidad && a.tipo && parseInt(a.cantidad) > 0
    )

    if (animalesValidos.length === 0) {
      alert('Debe agregar al menos un animal con cantidad y tipo')
      return
    }

    // Validar que no exceda cantidades disponibles
    for (const animal of animalesValidos) {
      const disponible = animalesDisponibles.find(d => d.categoria === animal.tipo)
      if (!disponible) {
        alert(`No hay animales de tipo ${animal.tipo} en este potrero`)
        return
      }
      if (parseInt(animal.cantidad) > disponible.cantidad) {
        alert(`Solo hay ${disponible.cantidad} ${animal.tipo} disponibles`)
        return
      }
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre
      
      // Construir descripción con todos los animales
      const descripcionAnimales = animalesValidos.map(a => 
        `${a.cantidad} ${a.tipo}${a.peso ? ` (${a.peso} kg)` : ''}`
      ).join(', ')

      const descripcionFinal = `Tratamiento${rodeoId && rodeos.find(r => r.id === rodeoId) ? ` - Lote ${rodeos.find(r => r.id === rodeoId)?.nombre}` : ''}: ${tratamiento}${marca ? ` - ${marca}` : ''} aplicado a ${descripcionAnimales} en potrero ${potreroNombre}`

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'TRATAMIENTO',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          notas: notas || null,
          rodeoId: rodeoId || null,  // AGREGAR ESTA LÍNEA
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
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
<div className="relative">
  <label className="block text-sm font-medium text-gray-700 mb-2">Potrero</label>
  
  <div
    onClick={() => setShowPotreroDropdown(!showPotreroDropdown)}
    className={`w-full px-4 py-2 border rounded-lg cursor-pointer bg-white flex justify-between items-center ${
      errorPotrero ? 'border-red-500' : 'border-gray-300'
    }`}
  >
    <span className={potreroSeleccionado ? 'text-gray-900' : 'text-gray-400'}>
      {potreroSeleccionado 
        ? potreros.find(p => p.id === potreroSeleccionado)?.nombre 
        : 'Seleccionar potrero...'}
    </span>
    <span className="text-gray-400">▼</span>
  </div>

  {showPotreroDropdown && (
    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
      {potreros.map((lote: any) => {
        const resumenAnimales = lote.animalesLote && lote.animalesLote.length > 0
          ? lote.animalesLote
              .filter((a: any) => a.cantidad > 0)
              .map((a: any) => `${a.categoria} (${a.cantidad})`)
              .join(', ')
          : 'Sin animales'
        
        return (
          <div
            key={lote.id}
            onClick={() => {
              setPotreroSeleccionado(lote.id)
              setShowPotreroDropdown(false)
              setErrorPotrero(false)
            }}
            className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
              potreroSeleccionado === lote.id ? 'bg-blue-100' : ''
            }`}
          >
            <div className="font-medium text-gray-900">{lote.nombre}</div>
            <div className="text-sm text-gray-500">{resumenAnimales}</div>
          </div>
        )
      })}
    </div>
  )}

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
              <div className="space-y-3">
                {animalesTratados.map((animal, index) => (
                  <div key={animal.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Cantidad */}
                    <div className="col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        value={animal.cantidad}
                        onChange={(e) => actualizarAnimal(animal.id, 'cantidad', e.target.value)}
                        min="1"
                        placeholder="100"
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* Tipo de animal */}
                    <div className="col-span-4">
                      <label className="block text-xs text-gray-600 mb-1">Tipo de animal</label>
                      <select
                        value={animal.tipo}
                        onChange={(e) => actualizarAnimal(animal.id, 'tipo', e.target.value)}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Tipo</option>
                        {animalesDisponibles.map((a) => (
                          <option key={a.id} value={a.categoria}>
                            {a.categoria} ({a.cantidad})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Peso */}
                    <div className="col-span-4">
                      <label className="block text-xs text-gray-600 mb-1">Peso</label>
                      <input
                        type="text"
                        value={animal.peso}
                        onChange={(e) => actualizarAnimal(animal.id, 'peso', e.target.value)}
                        placeholder="Peso"
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {/* Botón eliminar */}
                    <div className="col-span-1 flex items-end pb-2">
                      <button
                        type="button"
                        onClick={() => eliminarAnimal(animal.id)}
                        className="text-red-500 hover:text-red-700 text-xl"
                        disabled={animalesTratados.length === 1}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}

                {/* Botón agregar */}
                <button
                  type="button"
                  onClick={agregarAnimal}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  <span className="text-xl">➕</span> Agregar Más Animales
                </button>
              </div>
            )}
          </div>
        )}

        {/* RODEO */}
        {modoRodeo !== 'NO_INCLUIR' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lote {modoRodeo === 'OBLIGATORIO' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={rodeoId}
              onChange={(e) => setRodeoId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required={modoRodeo === 'OBLIGATORIO'}
            >
              <option value="">Seleccionar lote...</option>
              {rodeos.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            {rodeos.length === 0 && (
              <p className="text-xs text-yellow-600 mt-2">
                ⚠️ No hay lotes creados. Podés crear uno en Preferencias → Lotes
              </p>
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