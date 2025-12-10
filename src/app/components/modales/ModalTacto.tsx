'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalTactoProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
}

export default function ModalTacto({ onClose, onSuccess }: ModalTactoProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesTactados, setAnimalesTactados] = useState('')
  const [animalesPreñados, setAnimalesPreñados] = useState('')
  const [porcentajePreñez, setPorcentajePreñez] = useState(0)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // Estados para rodeos
  const [rodeoId, setRodeoId] = useState<string>('')
  const [rodeos, setRodeos] = useState<any[]>([])
  const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')

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

  // Calcular porcentaje automáticamente
  useEffect(() => {
    const tactados = parseInt(animalesTactados) || 0
    const preñados = parseInt(animalesPreñados) || 0

    if (tactados > 0 && preñados >= 0 && preñados <= tactados) {
      const porcentaje = Math.round((preñados / tactados) * 100)
      setPorcentajePreñez(porcentaje)
    } else {
      setPorcentajePreñez(0)
    }
  }, [animalesTactados, animalesPreñados])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      alert('Debe seleccionar un potrero')
      return
    }

    const tactados = parseInt(animalesTactados)
    const preñados = parseInt(animalesPreñados)

    if (!tactados || tactados <= 0) {
      alert('Debe ingresar la cantidad de animales tactados')
      return
    }

    if (preñados < 0 || preñados > tactados) {
      alert('La cantidad de animales preñados no puede ser mayor a los tactados')
      return
    }

    // VALIDAR RODEO OBLIGATORIO
    if (modoRodeo === 'OBLIGATORIO' && !rodeoId) {
      alert('Seleccioná un rodeo')
      return
    }

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'TACTO',
          fecha: fecha,
          descripcion: `Tacto en potrero ${potreroNombre}${rodeoId && rodeos.find(r => r.id === rodeoId) ? ` - Lote ${rodeos.find(r => r.id === rodeoId)?.nombre}` : ''}: ${tactados} animales tactados, ${preñados} preñados (${porcentajePreñez}% de preñez)`,
          loteId: potreroSeleccionado,
          cantidad: tactados,
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
      alert(error instanceof Error ? error.message : 'Error al registrar tacto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            ✋
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Tacto</h2>
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
        {/* INFORMACIÓN BÁSICA */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Información Básica</h3>
          
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

            {/* Potrero */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Potrero</label>
              <select
                value={potreroSeleccionado}
                onChange={(e) => setPotreroSeleccionado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Potrero</option>
                {potreros.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* INDICADORES */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Indicadores</h3>
          
          <div className="space-y-4">
            {/* Animales Tactados */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Animales Tactados
              </label>
              <input
                type="number"
                value={animalesTactados}
                onChange={(e) => setAnimalesTactados(e.target.value)}
                min="1"
                placeholder="120"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Animales Preñados y Porcentaje en el mismo renglón */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Animales preñados
                </label>
                <input
                  type="number"
                  value={animalesPreñados}
                  onChange={(e) => setAnimalesPreñados(e.target.value)}
                  min="0"
                  max={animalesTactados}
                  placeholder="Animales preñados"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porcentaje de preñez
                </label>
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-semibold">
                  {porcentajePreñez}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RODEO */}
        {modoRodeo !== 'NO_INCLUIR' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Lotes {modoRodeo === 'OBLIGATORIO' && <span className="text-red-500">*</span>}
            </h3>
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
                No hay lotes creados. Podés crear uno en Preferencias → Lotes
              </p>
            )}
          </div>
        )}

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
          disabled={loading || !potreroSeleccionado || !animalesTactados || !animalesPreñados}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}