'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

type ModalCosechaProps = {
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

export default function ModalCosecha({ onClose, onSuccess }: ModalCosechaProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [tieneModulos, setTieneModulos] = useState(false)
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [cultivosDisponibles, setCultivosDisponibles] = useState<Cultivo[]>([])
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<Cultivo | null>(null)
  const [hectareas, setHectareas] = useState('')
  const [rendimiento, setRendimiento] = useState('')
  const [unidad, setUnidad] = useState('kg')
  const [humedad, setHumedad] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCultivos, setLoadingCultivos] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  const [errorCultivo, setErrorCultivo] = useState(false)
  const [errorHectareas, setErrorHectareas] = useState(false)

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
    setErrorHectareas(false)
  }

  // Botón para cosechar todo
  const handleCosecharTodo = () => {
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

    if (!hectareas || parseFloat(hectareas) <= 0) {
      setErrorHectareas(true)
      return
    }

    const hectareasNum = parseFloat(hectareas)
    if (hectareasNum > cultivoSeleccionado.hectareas) {
      setErrorHectareas(true)
      toast.error(`No puedes cosechar más de ${cultivoSeleccionado.hectareas} ha disponibles`)
      return
    }

    setLoading(true)

    try {
               const porcentajeCosechado = ((hectareasNum / cultivoSeleccionado.hectareas) * 100).toFixed(1)
         const esCosechaCompleta = hectareasNum === cultivoSeleccionado.hectareas

         // Obtener datos completos del potrero y formatear nombre con módulo si existe
         const potreroData = potreros.find(p => p.id === potreroSeleccionado)
         const nombrePotreroFormateado = potreroData?.moduloPastoreo?.nombre 
           ? `${potreroData.nombre} (${potreroData.moduloPastoreo.nombre})`
           : potreroData?.nombre

         // Construir descripción
         let descripcionFinal = `Cosecha de ${cultivoSeleccionado.tipoCultivo} en potrero ${nombrePotreroFormateado}`
         
         descripcionFinal += ` - ${hectareasNum} ha (${porcentajeCosechado}% del cultivo)`
         
         if (esCosechaCompleta) {
           descripcionFinal += ` - Cultivo eliminado completamente`
         }
         
         if (rendimiento) {
           descripcionFinal += ` - Rendimiento: ${rendimiento} ${unidad}`
         }
         
         if (humedad) {
           descripcionFinal += ` - Humedad: ${humedad}%`
         }

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'COSECHA',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          cultivoId: cultivoSeleccionado.id,
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
      toast.error(error instanceof Error ? error.message : 'Error al registrar cosecha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            🌾
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Cosecha</h2>
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
        {/* INFORMACIÓN */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Información</h3>
          
          {/* FECHA */}
          <div className="mb-4">
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
          <div className="mb-4">
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
              <p className="text-red-500 text-xs mt-1">El potrero es obligatorio</p>
            )}
          </div>

          {/* CULTIVO */}
          <div className="mb-4">
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
                  <p className="text-red-500 text-xs mt-1">El cultivo es obligatorio</p>
                )}
              </>
            )}
          </div>

          {/* HECTÁREAS A COSECHAR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hectáreas a cosechar <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={hectareas}
                onChange={(e) => {
                  setHectareas(e.target.value)
                  setErrorHectareas(false)
                }}
                placeholder="Hectáreas a cosechar"
                step="0.01"
                min="0"
                max={cultivoSeleccionado?.hectareas || undefined}
                className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errorHectareas ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={!cultivoSeleccionado}
                required
              />
              <button
                type="button"
                onClick={handleCosecharTodo}
                disabled={!cultivoSeleccionado}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap text-sm"
              >
                Cosechar todo
              </button>
            </div>
            {cultivoSeleccionado && (
              <p className="text-xs text-gray-500 mt-1">
                Disponibles: {cultivoSeleccionado.hectareas} ha
              </p>
            )}
            {errorHectareas && (
              <p className="text-red-500 text-xs mt-1">
                Ingrese una cantidad válida (máximo {cultivoSeleccionado?.hectareas} ha)
              </p>
            )}
          </div>
        </div>

        {/* VISTA PREVIA */}
        {cultivoSeleccionado && hectareas && parseFloat(hectareas) > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Vista previa:</strong> Se cosecharán {parseFloat(hectareas).toFixed(2)} ha de{' '}
              {cultivoSeleccionado.tipoCultivo} (
              {((parseFloat(hectareas) / cultivoSeleccionado.hectareas) * 100).toFixed(1)}% del cultivo)
              {parseFloat(hectareas) === cultivoSeleccionado.hectareas && (
                <span className="font-bold"> - El cultivo se eliminará completamente del potrero</span>
              )}
            </p>
          </div>
        )}

        {/* RENDIMIENTO */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rendimiento</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rendimiento</label>
            <input
              type="number"
              value={rendimiento}
              onChange={(e) => setRendimiento(e.target.value)}
              placeholder="Rendimiento"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unidad</label>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="kg">kg</option>
              <option value="ton">ton</option>
              <option value="qq">qq</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>

        {/* HUMEDAD */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Humedad</h3>
          <input
            type="number"
            value={humedad}
            onChange={(e) => setHumedad(e.target.value)}
            placeholder="Humedad (%)"
            step="0.1"
            min="0"
            max="100"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
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