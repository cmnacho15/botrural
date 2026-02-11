// Modal de Refertilización - Aplicación de fertilizantes a cultivos existentes
'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

type ModalRefertilizacionProps = {
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
  cultivos?: any[]
}

type Cultivo = {
  id: string
  tipoCultivo: string
  hectareas: number
  fechaSiembra: string
}

type Fertilizante = {
  fuente: string
  dosis: string
  unidad: string
}

export default function ModalRefertilizacion({ onClose, onSuccess }: ModalRefertilizacionProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [cultivosDisponibles, setCultivosDisponibles] = useState<Cultivo[]>([])
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<Cultivo | null>(null)
  const [hectareas, setHectareas] = useState('')
  const [fertilizantes, setFertilizantes] = useState<Fertilizante[]>([
    { fuente: '', dosis: '', unidad: 'L/ha' }
  ])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCultivos, setLoadingCultivos] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  const [errorCultivo, setErrorCultivo] = useState(false)
  const [tieneModulos, setTieneModulos] = useState(false)

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

  // Cargar cultivos cuando se selecciona potrero
  useEffect(() => {
    if (!potreroSeleccionado) {
      setCultivosDisponibles([])
      setCultivoSeleccionado(null)
      setHectareas('')
      return
    }

    setLoadingCultivos(true)
    fetch(`/api/lotes/${potreroSeleccionado}/cultivos`)
      .then((res) => res.json())
      .then((data) => {
        setCultivosDisponibles(data)
        setLoadingCultivos(false)
      })
      .catch(() => {
        toast.error('Error al cargar cultivos')
        setLoadingCultivos(false)
      })
  }, [potreroSeleccionado])

  // Manejar selección de cultivo
  const handleCultivoChange = (cultivoId: string) => {
    const cultivo = cultivosDisponibles.find(c => c.id === cultivoId)
    setCultivoSeleccionado(cultivo || null)
    setHectareas('')
    setErrorCultivo(false)
  }

  // Botón para fertilizar todas las hectáreas
  const handleFertilizarTodo = () => {
    if (cultivoSeleccionado) {
      setHectareas(cultivoSeleccionado.hectareas.toString())
    }
  }

  // Agregar nuevo fertilizante
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

    if (!cultivoSeleccionado) {
      setErrorCultivo(true)
      return
    }

    // Validar que al menos un fertilizante tenga fuente y dosis
    const fertilizantesValidos = fertilizantes.filter(
      f => f.fuente.trim() && f.dosis.trim()
    )

    if (fertilizantesValidos.length === 0) {
      toast.error('Debe agregar al menos un fertilizante con fuente y dosis')
      return
    }

    setLoading(true)

    try {
      const potreroData = potreros.find(p => p.id === potreroSeleccionado)
const potreroNombre = potreroData?.moduloPastoreo?.nombre 
  ? `${potreroData.nombre} (${potreroData.moduloPastoreo.nombre})`
  : potreroData?.nombre
const hectareasNum = hectareas ? parseFloat(hectareas) : cultivoSeleccionado.hectareas

// Construir descripción (SIN fertilizantes, van solo en notas)
let descripcionFinal = `Refertilización de ${cultivoSeleccionado.tipoCultivo} en potrero ${potreroNombre}`

if (hectareas) {
  descripcionFinal += ` - ${hectareasNum} ha`
}
      
      // NO agregar fertilizantes aquí, van solo en las notas

      // Construir notas con detalles de fertilizantes
      let notasCompletas = ''
      if (fertilizantesValidos.length > 0) {
        notasCompletas = 'Fertilizantes aplicados:\n'
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
          tipo: 'REFERTILIZACION',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          tipoCultivo: cultivoSeleccionado.tipoCultivo,
          hectareas: hectareasNum,
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
      toast.error(error instanceof Error ? error.message : 'Error al registrar refertilización')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            🌿
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Refertilización</h2>
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
          const resumen = lote.cultivos && lote.cultivos.length > 0
            ? lote.cultivos
                .map((c: any) => `${c.tipoCultivo} ${c.hectareas}ha`)
                .join(', ')
            : 'Sin cultivos'

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
      const resumen = lote.cultivos && lote.cultivos.length > 0
        ? lote.cultivos
            .map((c: any) => `${c.tipoCultivo} ${c.hectareas}ha`)
            .join(', ')
        : 'Sin cultivos'

      return (
        <option key={lote.id} value={lote.id}>
          {lote.nombre} ({resumen})
        </option>
      )
    })
  )}
</select>
          {errorPotrero && (
            <p className="text-red-500 text-xs mt-1">El potrero es requerido</p>
          )}
        </div>
        {/* CULTIVO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cultivo <span className="text-red-500">*</span>
          </label>
          {loadingCultivos ? (
            <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
              Cargando cultivos...
            </div>
          ) : cultivosDisponibles.length === 0 && potreroSeleccionado ? (
            <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
              No hay cultivos sembrados en este potrero
            </div>
          ) : (
            <>
              <select
                value={cultivoSeleccionado?.id || ''}
                onChange={(e) => handleCultivoChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errorCultivo ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={!potreroSeleccionado || cultivosDisponibles.length === 0}
                required
              >
                <option value="">Seleccione un cultivo</option>
                {cultivosDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tipoCultivo} ({c.hectareas} ha)
                  </option>
                ))}
              </select>
              {errorCultivo && (
                <p className="text-red-500 text-xs mt-1">El cultivo es requerido</p>
              )}
            </>
          )}
        </div>
        
        {/* HECTÁREAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hectáreas</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={hectareas}
              onChange={(e) => setHectareas(e.target.value)}
              placeholder="Hectáreas (opcional, por defecto todas)"
              step="0.01"
              min="0"
              max={cultivoSeleccionado?.hectareas || undefined}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={handleFertilizarTodo}
              disabled={!cultivoSeleccionado}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap text-sm"
            >
              Todas
            </button>
          </div>
          {cultivoSeleccionado && (
            <p className="text-xs text-gray-500 mt-1">
              Total del cultivo: {cultivoSeleccionado.hectareas} ha
            </p>
          )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fert.fuente}
                    onChange={(e) => actualizarFertilizante(index, 'fuente', e.target.value)}
                    placeholder="Ej: Urea, MAP, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                {/* DOSIS Y UNIDAD */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dosis <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={fert.dosis}
                      onChange={(e) => actualizarFertilizante(index, 'dosis', e.target.value)}
                      placeholder="Cantidad"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidad <span className="text-red-500">*</span>
                    </label>
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
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notas</h3>
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
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-green-600 hover:bg-gray-50 font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}