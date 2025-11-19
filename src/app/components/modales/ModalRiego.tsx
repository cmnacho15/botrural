// Modal de Riego - Registro de riego de cultivos con lámina, método y duración

'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalRiegoProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
}

type Cultivo = {
  id: string
  tipoCultivo: string
  hectareas: number
  fechaSiembra: string
}

export default function ModalRiego({ onClose, onSuccess }: ModalRiegoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [cultivosDisponibles, setCultivosDisponibles] = useState<Cultivo[]>([])
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<Cultivo | null>(null)
  const [hectareas, setHectareas] = useState('')
  const [laminaRiego, setLaminaRiego] = useState('')
  const [metodoRiego, setMetodoRiego] = useState('')
  const [duracion, setDuracion] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCultivos, setLoadingCultivos] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  const [errorCultivo, setErrorCultivo] = useState(false)
  const [errorLamina, setErrorLamina] = useState(false)

  // Cargar potreros al montar
  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => setPotreros(data))
      .catch(() => alert('Error al cargar potreros'))
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
        alert('Error al cargar cultivos')
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

  // Botón para regar todas las hectáreas
  const handleRegarTodo = () => {
    if (cultivoSeleccionado) {
      setHectareas(cultivoSeleccionado.hectareas.toString())
    }
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

    if (!laminaRiego || parseFloat(laminaRiego) <= 0) {
      setErrorLamina(true)
      return
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre
      const hectareasNum = hectareas ? parseFloat(hectareas) : cultivoSeleccionado.hectareas

      // Construir descripción
      let descripcionFinal = `Riego de ${cultivoSeleccionado.tipoCultivo} en potrero ${potreroNombre}`
      
      if (hectareas) {
        descripcionFinal += ` - ${hectareasNum} ha`
      }
      
      descripcionFinal += ` - Lámina: ${laminaRiego} mm/ha`
      
      if (metodoRiego) {
        descripcionFinal += ` - Método: ${metodoRiego}`
      }
      
      if (duracion) {
        descripcionFinal += ` - Duración: ${duracion} horas`
      }

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'RIEGO',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          tipoCultivo: cultivoSeleccionado.tipoCultivo,
          hectareas: hectareasNum,
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
      alert(error instanceof Error ? error.message : 'Error al registrar riego')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            💧
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Riego</h2>
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errorPotrero ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Seleccione un potrero</option>
            {potreros.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre}
              </option>
            ))}
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleRegarTodo}
              disabled={!cultivoSeleccionado}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap text-sm"
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

        

        {/* RIEGO */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Riego</h3>
          
          {/* LÁMINA DE RIEGO */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lámina (mm/ha) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={laminaRiego}
              onChange={(e) => {
                setLaminaRiego(e.target.value)
                setErrorLamina(false)
              }}
              placeholder="Ingrese el riego del campo"
              step="0.1"
              min="0"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errorLamina ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {errorLamina && (
              <p className="text-red-500 text-xs mt-1">El riego es requerido</p>
            )}
          </div>

          {/* MÉTODO DE RIEGO */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de Riego (opcional)
            </label>
            <select
              value={metodoRiego}
              onChange={(e) => setMetodoRiego(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione método (opcional)</option>
              <option value="Por aspersión">Por aspersión</option>
              <option value="Por goteo">Por goteo</option>
              <option value="Por gravedad">Por gravedad</option>
              <option value="Pivote central">Pivote central</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* DURACIÓN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración (horas) (opcional)
            </label>
            <input
              type="number"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              placeholder="Duración en horas"
              step="0.5"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* NOTAS */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notas</h3>
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