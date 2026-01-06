'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalDAOProps = {
  onClose: () => void
  onSuccess: () => void
}

type Lote = {
  id: string
  nombre: string
  animalesLote?: AnimalLote[]
}

type AnimalLote = {
  id: string
  categoria: string
  cantidad: number
}

type ResultadoDAO = {
  id: string
  categoria: string
  cantidadExaminada: string
  prenado: string
  ciclando: string
  anestroSuperficial: string
  anestroProfundo: string
}

export default function ModalDAO({ onClose, onSuccess }: ModalDAOProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [potreroSeleccionado, setPotreroSeleccionado] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)
  const [errorPotrero, setErrorPotrero] = useState(false)
  
  // Estados para rodeos
  const [rodeoId, setRodeoId] = useState<string>('')
  const [rodeos, setRodeos] = useState<any[]>([])
  const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')
  
  // Estados para resultados DAO
  const [resultadosDAO, setResultadosDAO] = useState<ResultadoDAO[]>([
    { 
      id: '1', 
      categoria: '', 
      cantidadExaminada: '', 
      prenado: '', 
      ciclando: '', 
      anestroSuperficial: '', 
      anestroProfundo: '' 
    }
  ])

  // Cargar potreros al montar (solo los que tengan vacunos)
  useEffect(() => {
    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => {
        // Filtrar solo potreros con animales bovinos
        const potrerosConVacunos = data.filter((lote: Lote) => 
          lote.animalesLote && lote.animalesLote.some((a: AnimalLote) => 
            ['Vaquillonas +2 años', 'Vaquillonas 1–2 años', 'Vacas', 'Vacas Gordas'].includes(a.categoria) && a.cantidad > 0
          )
        )
        setPotreros(potrerosConVacunos)
      })
      .catch(() => alert('Error al cargar potreros'))
  }, [])

  // Cargar rodeos y configuración
  useEffect(() => {
    fetch('/api/configuracion-rodeos')
      .then(r => r.json())
      .then(data => setModoRodeo(data.modoRodeo || 'OPCIONAL'))
      .catch(err => console.error('Error cargando configuración rodeos:', err))
    
    fetch('/api/rodeos')
      .then(r => r.json())
      .then(data => setRodeos(data))
      .catch(err => console.error('Error cargando rodeos:', err))
  }, [])

 // Cargar animales cuando se selecciona potrero (solo categorías aptas para DAO)
  useEffect(() => {
    if (!potreroSeleccionado) {
      setAnimalesDisponibles([])
      return
    }

    setLoadingAnimales(true)
    fetch(`/api/lotes/${potreroSeleccionado}/animales`)
      .then((res) => res.json())
      .then((data) => {
        // Filtrar solo categorías femeninas aptas para DAO
        const categoriasDAO = data.filter((a: AnimalLote) => 
          ['Vaquillonas +2 años', 'Vaquillonas 1–2 años', 'Vacas', 'Vacas Gordas'].includes(a.categoria)
        )
        setAnimalesDisponibles(categoriasDAO)
        setLoadingAnimales(false)
      })
      .catch(() => {
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroSeleccionado])

  const agregarCategoria = () => {
    setResultadosDAO([
      ...resultadosDAO,
      { 
        id: Date.now().toString(), 
        categoria: '', 
        cantidadExaminada: '', 
        prenado: '', 
        ciclando: '', 
        anestroSuperficial: '', 
        anestroProfundo: '' 
      }
    ])
  }

  const eliminarCategoria = (id: string) => {
    if (resultadosDAO.length > 1) {
      setResultadosDAO(resultadosDAO.filter(r => r.id !== id))
    }
  }

  const actualizarResultado = (id: string, campo: keyof ResultadoDAO, valor: string) => {
    setResultadosDAO(resultadosDAO.map(r =>
      r.id === id ? { ...r, [campo]: valor } : r
    ))
  }

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!potreroSeleccionado) {
      setErrorPotrero(true)
      return
    }

    // Validar rodeo obligatorio
    if (modoRodeo === 'OBLIGATORIO' && !rodeoId) {
      alert('Seleccioná un rodeo')
      return
    }

    // Validar que haya al menos 1 categoría con datos
const resultadosValidos = resultadosDAO.filter(r => {
  const suma = (parseInt(r.prenado) || 0) + 
               (parseInt(r.ciclando) || 0) + 
               (parseInt(r.anestroSuperficial) || 0) + 
               (parseInt(r.anestroProfundo) || 0)
  return r.categoria && suma > 0
})

if (resultadosValidos.length < 1) {
  alert('Debe registrar al menos 1 categoría con datos')
  return
}

    

    // Validar que no exceda cantidades disponibles
for (const resultado of resultadosValidos) {
  const disponible = animalesDisponibles.find(d => d.categoria === resultado.categoria)
  if (!disponible) {
    alert(`No hay animales de tipo ${resultado.categoria} en este potrero`)
    return
  }
  const cantidadExaminada = (parseInt(resultado.prenado) || 0) + 
                            (parseInt(resultado.ciclando) || 0) + 
                            (parseInt(resultado.anestroSuperficial) || 0) + 
                            (parseInt(resultado.anestroProfundo) || 0)
  if (cantidadExaminada > disponible.cantidad) {
    alert(`Solo hay ${disponible.cantidad} ${resultado.categoria} disponibles`)
    return
  }
}

    setLoading(true)

    try {
      const potreroNombre = potreros.find(p => p.id === potreroSeleccionado)?.nombre
      
      // Construir descripción con todos los resultados
      const detallesResultados = resultadosValidos.map(r => {
  const cantidadExaminada = (parseInt(r.prenado) || 0) + 
                            (parseInt(r.ciclando) || 0) + 
                            (parseInt(r.anestroSuperficial) || 0) + 
                            (parseInt(r.anestroProfundo) || 0)
  return `${r.categoria}: ${cantidadExaminada} examinadas (Preñadas: ${r.prenado || 0}, Ciclando: ${r.ciclando || 0}, Anestro Superficial: ${r.anestroSuperficial || 0}, Anestro Profundo: ${r.anestroProfundo || 0})`
}).join(' | ')

      const descripcionFinal = `DAO${rodeoId && rodeos.find(r => r.id === rodeoId) ? ` - Lote ${rodeos.find(r => r.id === rodeoId)?.nombre}` : ''} en potrero ${potreroNombre}: ${detallesResultados}`

      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'DAO',
          fecha: fecha,
          descripcion: descripcionFinal,
          loteId: potreroSeleccionado,
          notas: notas || null,
          rodeoId: rodeoId || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar DAO')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl">
            🔬
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">DAO</h2>
            <p className="text-sm text-gray-500">Diagnóstico de Actividad Ovárica</p>
          </div>
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
              setErrorPotrero(false)
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
              errorPotrero ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Seleccionar potrero...</option>
            {potreros.map((lote: any) => {
              const categoriasDAO = ['Vaquillonas +2 años', 'Vaquillonas 1–2 años', 'Vacas', 'Vacas Gordas']
              const resumen = lote.animalesLote && lote.animalesLote.length > 0
                ? lote.animalesLote
                    .filter((a: any) => categoriasDAO.includes(a.categoria) && a.cantidad > 0)
                    .map((a: any) => `${a.categoria} ${a.cantidad}`)
                    .join(', ')
                : 'Sin animales'
              
              return (
                <option key={lote.id} value={lote.id}>
                  {lote.nombre} ({resumen})
                </option>
              )
            })}
          </select>
          {errorPotrero && (
            <p className="text-red-500 text-xs mt-1">El potrero es obligatorio</p>
          )}
        </div>

        {/* RESULTADOS DAO */}
        {potreroSeleccionado && (
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
  <h3 className="font-semibold text-gray-900">Resultados del Monitoreo</h3>
</div>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                Este potrero no tiene animales disponibles
              </p>
            ) : (
              <div className="space-y-4">
                {resultadosDAO.map((resultado, index) => {
                  
                  
                  return (
                    <div key={resultado.id} className="bg-white rounded-lg p-3 border border-purple-200">
  {/* Primera fila: Categoría y botón eliminar */}
  <div className="grid grid-cols-12 gap-2 mb-3">
    <div className="col-span-11">
      <label className="block text-xs text-gray-600 mb-1">Categoría</label>
      <select
        value={resultado.categoria}
        onChange={(e) => actualizarResultado(resultado.id, 'categoria', e.target.value)}
        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
        required
      >
        <option value="">Seleccionar...</option>
        {animalesDisponibles.map((a) => (
          <option key={a.id} value={a.categoria}>
            {a.categoria} ({a.cantidad} disponibles)
          </option>
        ))}
      </select>
    </div>

    <div className="col-span-1 flex items-end pb-2">
      <button
        type="button"
        onClick={() => eliminarCategoria(resultado.id)}
        className="text-red-500 hover:text-red-700 text-xl"
        disabled={resultadosDAO.length === 1}
      >
        🗑️
      </button>
    </div>
  </div>

  {/* Segunda fila: Los 4 campos de resultados */}
  <div className="grid grid-cols-4 gap-2 mb-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Preñado</label>
                          <input
                            type="number"
                            value={resultado.prenado}
                            onChange={(e) => actualizarResultado(resultado.id, 'prenado', e.target.value)}
                            min="0"
                            placeholder="0"
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Ciclando</label>
                          <input
                            type="number"
                            value={resultado.ciclando}
                            onChange={(e) => actualizarResultado(resultado.id, 'ciclando', e.target.value)}
                            min="0"
                            placeholder="0"
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Anestro Sup.</label>
                          <input
                            type="number"
                            value={resultado.anestroSuperficial}
                            onChange={(e) => actualizarResultado(resultado.id, 'anestroSuperficial', e.target.value)}
                            min="0"
                            placeholder="0"
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                        </div>

                        <div>
          <label className="block text-xs text-gray-600 mb-1">Anestro Prof.</label>
          <input
            type="number"
            value={resultado.anestroProfundo}
            onChange={(e) => actualizarResultado(resultado.id, 'anestroProfundo', e.target.value)}
            min="0"
            placeholder="0"
            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
      </div>

      {/* Tercera fila: Cantidad Examinada (calculada) */}
      <div className="mt-3 pt-3 border-t border-purple-100">
        <label className="block text-xs text-gray-600 mb-1">Cantidad Examinada (Total)</label>
        <div className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-purple-50 text-sm font-semibold text-purple-900">
          {(parseInt(resultado.prenado) || 0) + 
           (parseInt(resultado.ciclando) || 0) + 
           (parseInt(resultado.anestroSuperficial) || 0) + 
           (parseInt(resultado.anestroProfundo) || 0)}
        </div>
      </div>
    </div>
                  )
                })}

                {/* Botón agregar */}
                <button
                  type="button"
                  onClick={agregarCategoria}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium text-sm"
                >
                  <span className="text-xl">➕</span> Agregar Otra Categoría
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
            placeholder="Observaciones adicionales del monitoreo reproductivo..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
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
          className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}