'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalSiembraProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
  hectareas: number
}

type Fertilizante = {
  fuente: string
  dosis: string
  unidad: string
}

export default function ModalSiembra({ onClose, onSuccess }: ModalSiembraProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [cultivo, setCultivo] = useState('')
  const [genetica, setGenetica] = useState('')
  const [hectareas, setHectareas] = useState('')
  const [espaciamiento, setEspaciamiento] = useState('')
  const [densidad, setDensidad] = useState('')
  const [unidadDensidad, setUnidadDensidad] = useState('Semillas/ha')
  const [fertilizantes, setFertilizantes] = useState<Fertilizante[]>([
    { fuente: '', dosis: '', unidad: 'L/ha' }
  ])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  const [errorCultivo, setErrorCultivo] = useState(false)
  const [hectareasMax, setHectareasMax] = useState<number | null>(null)
  const [cultivosDisponibles, setCultivosDisponibles] = useState<string[]>([])

  // Cargar potreros al montar
useEffect(() => {
  fetch('/api/lotes')
    .then((res) => res.json())
    .then((data) => setPotreros(data))
    .catch(() => alert('Error al cargar potreros'))
}, [])

// Actualizar hectáreas máximas cuando se selecciona potrero
useEffect(() => {
  if (potreroSeleccionado) {
    const potrero = potreros.find(p => p.id === potreroSeleccionado)
    setHectareasMax(potrero?.hectareas || null)
  } else {
    setHectareasMax(null)
  }
}, [potreroSeleccionado, potreros])

// Cargar cultivos disponibles
useEffect(() => {
  fetch('/api/tipos-cultivo')
    .then((res) => res.json())
    .then((data) => {
      const nombres = data.map((c: any) => c.nombre)
      setCultivosDisponibles(nombres)
    })
    .catch(() => {
      console.error('Error cargando cultivos')
    })
}, [])

  // Agregar fertilizante
  const agregarFertilizante = () => {
    setFertilizantes([...fertilizantes, { fuente: '', dosis: '', unidad: 'L/ha' }])
  }

  // Eliminar fertilizante
  const eliminarFertilizante = (index: number) => {
    if (fertilizantes.length > 1) {
      setFertilizantes(fertilizantes.filter((_, i) => i !== index))
    }
  }

  // Actualizar fertilizante
  const actualizarFertilizante = (index: number, campo: keyof Fertilizante, valor: string) => {
    const nuevos = [...fertilizantes]
    nuevos[index][campo] = valor
    setFertilizantes(nuevos)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!potreroSeleccionado) {
      setErrorPotrero(true)
      return
    }

    if (!cultivo.trim()) {
      setErrorCultivo(true)
      return
    }

    if (!hectareas || parseFloat(hectareas) <= 0) {
      alert('Debe ingresar las hectáreas a sembrar')
      return
    }

    if (hectareasMax && parseFloat(hectareas) > hectareasMax) {
      alert(`No puede sembrar más de ${hectareasMax} ha (tamaño del potrero)`)
      return
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre

      // Construir descripción (SIN fertilizantes aquí, van solo en notas)
      let descripcionFinal = `Siembra de ${cultivo} en potrero ${potreroNombre} - ${hectareas} ha`

      // NO agregar genética, espaciamiento, densidad ni fertilizantes a la descripción
      // Todo eso va en las notas
      
      const fertilizantesValidos = fertilizantes.filter(f => f.fuente.trim() && f.dosis.trim())

      // Construir notas con detalles
      let notasCompletas = ''
      if (genetica) notasCompletas += `Genética: ${genetica}\n`
      if (espaciamiento) notasCompletas += `Espaciamiento: ${espaciamiento} cm\n`
      if (densidad) notasCompletas += `Densidad: ${densidad} ${unidadDensidad}\n`
      
      if (fertilizantesValidos.length > 0) {
        notasCompletas += '\nFertilizantes aplicados:\n'
        fertilizantesValidos.forEach((f, i) => {
          notasCompletas += `${i + 1}. ${f.fuente}: ${f.dosis} ${f.unidad}\n`
        })
      }
      
      if (notas.trim()) {
        notasCompletas += `\nNotas adicionales: ${notas.trim()}`
      }

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'SIEMBRA',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          tipoCultivo: cultivo.trim(),
          hectareas: parseFloat(hectareas),
          notas: notasCompletas || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar siembra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            🌱
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Siembra</h2>
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
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Fecha</h3>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* POTRERO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Potrero <span className="text-red-500">*</span>
          </label>
          <select
            value={potreroSeleccionado}
            onChange={(e) => {
              setPotreroSeleccionado(e.target.value)
              setErrorPotrero(false)
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
              errorPotrero ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Potrero *</option>
            {potreros.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre} ({lote.hectareas} ha)
              </option>
            ))}
          </select>
          {errorPotrero && (
            <p className="text-red-500 text-xs mt-1">El potrero es obligatorio</p>
          )}
        </div>

        {/* CULTIVO */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Cultivo <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    list="cultivos-predefinidos"
    value={cultivo}
    onChange={(e) => {
      setCultivo(e.target.value)
      setErrorCultivo(false)
    }}
    placeholder="Seleccione o escriba un cultivo"
    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
      errorCultivo ? 'border-red-500' : 'border-gray-300'
    }`}
    required
  />
  <datalist id="cultivos-predefinidos">
  {cultivosDisponibles.map((c) => (
    <option key={c} value={c} />
  ))}
</datalist>
  {errorCultivo && (
    <p className="text-red-500 text-xs mt-1">El cultivo es obligatorio</p>
  )}
  <p className="text-xs text-gray-500 mt-1">
    💡 Seleccione de la lista o escriba un cultivo personalizado
  </p>
</div>

        {/* DETALLES DE LA SIEMBRA */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalles de la siembra</h3>
          
          {/* GENÉTICA */}
          <div className="mb-3">
            <input
              type="text"
              value={genetica}
              onChange={(e) => setGenetica(e.target.value)}
              placeholder="Genética"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* HECTÁREAS */}
          <div className="mb-3">
            <input
              type="number"
              value={hectareas}
              onChange={(e) => setHectareas(e.target.value)}
              placeholder="Hectáreas"
              step="0.01"
              min="0"
              max={hectareasMax || undefined}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
            {hectareasMax && (
              <p className="text-xs text-gray-500 mt-1">
                Máximo: {hectareasMax} ha
              </p>
            )}
          </div>

          {/* ESPACIAMIENTO */}
          <div>
            <input
              type="number"
              value={espaciamiento}
              onChange={(e) => setEspaciamiento(e.target.value)}
              placeholder="Espaciamiento"
              step="0.1"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* DENSIDAD */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Densidad</h3>
          
          <div className="mb-3">
            <input
              type="number"
              value={densidad}
              onChange={(e) => setDensidad(e.target.value)}
              placeholder="Densidad"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <select
              value={unidadDensidad}
              onChange={(e) => setUnidadDensidad(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="Semillas/ha">Semillas/ha</option>
              <option value="Plantas/ha">Plantas/ha</option>
              <option value="kg/ha">kg/ha</option>
            </select>
          </div>
        </div>

        {/* FERTILIZANTES */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Fertilizantes</h3>
          
          {fertilizantes.map((fert, index) => (
            <div key={index} className="mb-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  Fertilizante {index + 1}
                </span>
                {fertilizantes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarFertilizante(index)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* FUENTE */}
                <div>
                  <input
                    type="text"
                    value={fert.fuente}
                    onChange={(e) => actualizarFertilizante(index, 'fuente', e.target.value)}
                    placeholder="Fuente *"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* DOSIS Y UNIDAD */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      value={fert.dosis}
                      onChange={(e) => actualizarFertilizante(index, 'dosis', e.target.value)}
                      placeholder="Dosis *"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <select
                      value={fert.unidad}
                      onChange={(e) => actualizarFertilizante(index, 'unidad', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="L/ha">L/ha</option>
                      <option value="kg/ha">kg/ha</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={agregarFertilizante}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Otro Fertilizante
          </button>
        </div>

        {/* NOTAS */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notas (Opcional)</h3>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas (Opcional)"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
      </div>

      {/* BOTONES */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-blue-600 hover:bg-gray-50 font-medium"
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