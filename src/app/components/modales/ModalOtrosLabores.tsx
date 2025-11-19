'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalOtrosLaboresProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
}

export default function ModalOtrosLabores({ onClose, onSuccess }: ModalOtrosLaboresProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [laborRealizado, setLaborRealizado] = useState('')
  const [hectareas, setHectareas] = useState('')
  const [cultivo, setCultivo] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorLabor, setErrorLabor] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  const [errorCultivo, setErrorCultivo] = useState(false)

  // Cargar potreros al montar
  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => setPotreros(data))
      .catch(() => alert('Error al cargar potreros'))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    let hasError = false

    if (!laborRealizado.trim()) {
      setErrorLabor(true)
      hasError = true
    } else {
      setErrorLabor(false)
    }

    if (!potreroSeleccionado) {
      setErrorPotrero(true)
      hasError = true
    } else {
      setErrorPotrero(false)
    }

    if (!cultivo.trim()) {
      setErrorCultivo(true)
      hasError = true
    } else {
      setErrorCultivo(false)
    }

    if (hasError) return

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre
      const hectareasNum = hectareas ? parseFloat(hectareas) : null

      let descripcionFinal = `${laborRealizado} en cultivo de ${cultivo}, potrero ${potreroNombre}`
      if (hectareasNum) {
        descripcionFinal += ` (${hectareasNum} hectáreas)`
      }

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'OTROS_LABORES',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          tipoCultivo: cultivo,
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
      alert(error instanceof Error ? error.message : 'Error al registrar labor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
            🔧
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Otros Labores</h2>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      <div className="space-y-6">
        {/* INFORMACIÓN */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Información</h3>
          
          <div className="space-y-4">
            {/* Fecha */}
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

            {/* Labor Realizado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labor Realizado *
              </label>
              <input
                type="text"
                value={laborRealizado}
                onChange={(e) => {
                  setLaborRealizado(e.target.value)
                  setErrorLabor(false)
                }}
                placeholder="Ingresa el labor realizado"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errorLabor ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errorLabor && (
                <p className="text-red-500 text-xs mt-1">El labor es requerido</p>
              )}
            </div>

            {/* Potrero */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Potrero *</label>
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
                <option value="">Potrero *</option>
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

            {/* Hectáreas (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hectáreas</label>
              <input
                type="number"
                step="0.1"
                value={hectareas}
                onChange={(e) => setHectareas(e.target.value)}
                placeholder="Hectáreas"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cultivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cultivo *</label>
              <input
                type="text"
                value={cultivo}
                onChange={(e) => {
                  setCultivo(e.target.value)
                  setErrorCultivo(false)
                }}
                placeholder="Cultivo *"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errorCultivo ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errorCultivo && (
                <p className="text-red-500 text-xs mt-1">El cultivo es requerido</p>
              )}
            </div>
          </div>
        </div>

        {/* NOTAS */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Notas</h3>
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