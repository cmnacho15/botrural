'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'
import { toast } from '@/app/components/Toast'

type ModalTrasladoProps = {
  onClose: () => void
  onSuccess: () => void
}

type Campo = {
  id: string
  nombre: string
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

type AnimalAMover = {
  id: string
  tipoAnimal: string
  categoria: string
  cantidad: string
  cantidadMaxima: number
  pesoPromedio: string
  precioKgUSD: string
}

export default function ModalTraslado({ onClose, onSuccess }: ModalTrasladoProps) {
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)

  // Paso 1: Origen
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potrerosOrigen, setPotrerosOrigen] = useState<Lote[]>([])
  const [potreroOrigenId, setPotreroOrigenId] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [loadingAnimales, setLoadingAnimales] = useState(false)
  const [notas, setNotas] = useState('')

  // Animales a mover
  const [animalesAMover, setAnimalesAMover] = useState<AnimalAMover[]>([
    { id: '1', tipoAnimal: 'BOVINO', categoria: '', cantidad: '', cantidadMaxima: 0, pesoPromedio: '', precioKgUSD: '' }
  ])

  // Paso 2: Destino
  const [camposDestino, setCamposDestino] = useState<Campo[]>([])
  const [campoDestinoId, setCampoDestinoId] = useState('')
  const [potrerosDestino, setPotrerosDestino] = useState<Lote[]>([])
  const [potreroDestinoId, setPotreroDestinoId] = useState('')
  const [loadingPotreros, setLoadingPotreros] = useState(false)
const [cargandoCampos, setCargandoCampos] = useState(true)
const [tieneModulosOrigen, setTieneModulosOrigen] = useState(false)
const [tieneModulosDestino, setTieneModulosDestino] = useState(false)

  // Cargar potreros del campo actual y campos disponibles
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar potreros del campo actual
        const resPot = await fetch('/api/lotes')
if (resPot.ok) {
  const data = await resPot.json()
  setPotrerosOrigen(data)
  const hayModulos = data.some((l: Lote) => l.moduloPastoreoId !== null)
  setTieneModulosOrigen(hayModulos)
}

        // Cargar campos del usuario (para destino)
        const resCampos = await fetch('/api/campos')
        if (resCampos.ok) {
          const data = await resCampos.json()
          // Obtener el grupo del campo activo
          const campoActivo = data.find((c: any) => c.esActivo)
          const grupoActivo = campoActivo?.grupoId
          
          // Filtrar: mismo grupo + no es el campo activo
          const otrosCampos = data.filter((c: any) => 
            !c.esActivo && c.grupoId === grupoActivo
          )
          setCamposDestino(otrosCampos)
        }
        setCargandoCampos(false)
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }

    cargarDatos()
  }, [])

  // Cargar animales cuando se selecciona potrero origen
  useEffect(() => {
    if (!potreroOrigenId) {
      setAnimalesDisponibles([])
      setAnimalesAMover([{ id: '1', tipoAnimal: 'BOVINO', categoria: '', cantidad: '', cantidadMaxima: 0, pesoPromedio: '', precioKgUSD: '' }])
      return
    }

    setLoadingAnimales(true)
    fetch(`/api/lotes/${potreroOrigenId}/animales`)
      .then((res) => res.json())
      .then((data) => {
        setAnimalesDisponibles(data)
        setAnimalesAMover([{ id: '1', tipoAnimal: 'BOVINO', categoria: '', cantidad: '', cantidadMaxima: 0, pesoPromedio: '', precioKgUSD: '' }])
      })
      .catch(() => toast.error('Error al cargar animales'))
      .finally(() => setLoadingAnimales(false))
  }, [potreroOrigenId])

  // Cargar potreros del campo destino
  useEffect(() => {
    if (!campoDestinoId) {
      setPotrerosDestino([])
      setPotreroDestinoId('')
      return
    }

    setLoadingPotreros(true)
    fetch(`/api/lotes?campoId=${campoDestinoId}`)
  .then((res) => res.json())
  .then((data) => {
    setPotrerosDestino(data)
    const hayModulos = data.some((l: Lote) => l.moduloPastoreoId !== null)
    setTieneModulosDestino(hayModulos)
    setPotreroDestinoId('')
  })
      .catch(() => toast.error('Error al cargar potreros del campo destino'))
      .finally(() => setLoadingPotreros(false))
  }, [campoDestinoId])

  // Funciones para manejar animales
  const agregarAnimal = () => {
    setAnimalesAMover([
      ...animalesAMover,
      { id: Date.now().toString(), tipoAnimal: 'BOVINO', categoria: '', cantidad: '', cantidadMaxima: 0, pesoPromedio: '', precioKgUSD: '' }
    ])
  }

  const eliminarAnimal = (id: string) => {
    if (animalesAMover.length > 1) {
      setAnimalesAMover(animalesAMover.filter(a => a.id !== id))
    }
  }

  const actualizarAnimal = (id: string, campo: keyof AnimalAMover, valor: string) => {
    setAnimalesAMover(animalesAMover.map(a => {
      if (a.id !== id) return a

      if (campo === 'categoria') {
        const animalDisponible = animalesDisponibles.find(ad => ad.categoria === valor)
        return {
          ...a,
          categoria: valor,
          cantidad: animalDisponible?.cantidad.toString() || '',
          cantidadMaxima: animalDisponible?.cantidad || 0
        }
      }

      return { ...a, [campo]: valor }
    }))
  }

  const categoriasSeleccionadas = animalesAMover.map(a => a.categoria).filter(Boolean)

  const validarPaso1 = () => {
    if (!potreroOrigenId) {
      toast.error('Seleccioná un potrero de origen')
      return false
    }

    const animalesValidos = animalesAMover.filter(a =>
      a.categoria && a.cantidad && parseInt(a.cantidad) > 0
    )

    if (animalesValidos.length === 0) {
      toast.error('Debe seleccionar al menos una categoría con cantidad')
      return false
    }

    for (const animal of animalesValidos) {
      const cantidad = parseInt(animal.cantidad)
      if (cantidad <= 0 || cantidad > animal.cantidadMaxima) {
        toast.error(`La cantidad de ${animal.categoria} debe estar entre 1 y ${animal.cantidadMaxima}`)
        return false
      }
    }

    return true
  }

  const validarPaso2 = () => {
    if (!campoDestinoId) {
      toast.error('Seleccioná un campo de destino')
      return false
    }

    if (!potreroDestinoId) {
      toast.error('Seleccioná un potrero de destino')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validarPaso2()) return

    setLoading(true)

    try {
      const animalesValidos = animalesAMover.filter(a =>
        a.categoria && a.cantidad && parseInt(a.cantidad) > 0
      )

      const payload = {
        fecha,
        potreroOrigenId,
        campoDestinoId,
        potreroDestinoId,
        animales: animalesValidos.map(a => ({
          tipoAnimal: a.tipoAnimal,
          categoria: a.categoria,
          cantidad: parseInt(a.cantidad),
          pesoPromedio: a.pesoPromedio ? parseFloat(a.pesoPromedio) : null,
          precioKgUSD: a.precioKgUSD ? parseFloat(a.precioKgUSD) : null
        })),
        notas: notas || null
      }

      const response = await fetch('/api/traslados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear traslado')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear traslado')
    } finally {
      setLoading(false)
    }
  }

  const hayAnimalesValidos = animalesAMover.some(a =>
    a.categoria && a.cantidad && parseInt(a.cantidad) > 0
  )

  return (
    <div className="p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">
            🚚
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Traslado Entre Campos</h2>
            <p className="text-sm text-gray-600">
              {paso === 1 ? 'Paso 1: Origen y animales' : 'Paso 2: Campo destino'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* SIN CAMPOS DISPONIBLES */}
      {!cargandoCampos && camposDestino.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-yellow-800">
            ⚠️ No tenés otros campos para trasladar. Primero creá otro campo desde el menú de usuario.
          </p>
        </div>
      )}

      {/* PASO 1: ORIGEN */}
      {paso === 1 && camposDestino.length > 0 && (
        <div className="space-y-6">
          {/* FECHA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* POTRERO ORIGEN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Potrero de origen (campo actual)
            </label>
            <select
  value={potreroOrigenId}
  onChange={(e) => setPotreroOrigenId(e.target.value)}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
  required
>
  <option value="">Seleccionar potrero...</option>
  {tieneModulosOrigen ? (
    Object.entries(
      potrerosOrigen.reduce((acc, potrero) => {
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
    potrerosOrigen.map((lote) => (
      <option key={lote.id} value={lote.id}>
        {lote.nombre}
      </option>
    ))
  )}
</select>
          </div>

          {/* ANIMALES */}
          {potreroOrigenId && (
            <div className="bg-indigo-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Animales a trasladar</h3>

              {loadingAnimales ? (
                <p className="text-sm text-gray-600 italic">Cargando animales...</p>
              ) : animalesDisponibles.length === 0 ? (
                <p className="text-sm text-gray-600 italic">No hay animales en este potrero</p>
              ) : (
                <div className="space-y-4">
                  {animalesAMover.map((animal) => (
                    <div key={animal.id} className="bg-white rounded-lg p-4 border border-indigo-200">
                      <div className="grid grid-cols-12 gap-2 items-start mb-3">
                        {/* Categoría */}
                        <div className="col-span-5">
                          <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                          <select
                            value={animal.categoria}
                            onChange={(e) => actualizarAnimal(animal.id, 'categoria', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">Seleccionar...</option>
                            {animalesDisponibles
                              .filter(a => !categoriasSeleccionadas.includes(a.categoria) || a.categoria === animal.categoria)
                              .map((a) => (
                                <option key={a.id} value={a.categoria}>
                                  {a.categoria} ({a.cantidad})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Cantidad */}
                        <div className="col-span-5">
                          <label className="block text-xs text-gray-600 mb-1">
                            Cantidad {animal.cantidadMaxima > 0 && `(máx: ${animal.cantidadMaxima})`}
                          </label>
                          <input
                            type="number"
                            value={animal.cantidad}
                            onChange={(e) => actualizarAnimal(animal.id, 'cantidad', e.target.value)}
                            min="1"
                            max={animal.cantidadMaxima}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={!animal.categoria}
                          />
                        </div>

                        {/* Eliminar */}
                        <div className="col-span-2 flex items-end pb-1">
                          <button
                            type="button"
                            onClick={() => eliminarAnimal(animal.id)}
                            className="w-full py-2 text-red-500 hover:text-red-700 rounded-lg text-lg disabled:opacity-30"
                            disabled={animalesAMover.length === 1}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Peso y Precio (opcionales) */}
                      {animal.categoria && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Peso promedio (kg) <span className="text-gray-400">- opcional</span>
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={animal.pesoPromedio}
                              onChange={(e) => actualizarAnimal(animal.id, 'pesoPromedio', e.target.value)}
                              placeholder="ej: 450"
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Precio/kg USD <span className="text-gray-400">- opcional</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={animal.precioKgUSD}
                              onChange={(e) => actualizarAnimal(animal.id, 'precioKgUSD', e.target.value)}
                              placeholder="ej: 2.50"
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>

                          {/* Cálculos automáticos */}
                          {animal.pesoPromedio && animal.precioKgUSD && animal.cantidad && (
                            <div className="col-span-2 bg-green-50 rounded-lg p-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Precio/animal:</span>
                                <span className="font-semibold">
                                  {(parseFloat(animal.pesoPromedio) * parseFloat(animal.precioKgUSD)).toFixed(2)} USD
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total:</span>
                                <span className="font-bold text-green-700">
                                  {(parseInt(animal.cantidad) * parseFloat(animal.pesoPromedio) * parseFloat(animal.precioKgUSD)).toFixed(2)} USD
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Agregar más */}
                  {animalesDisponibles.length > categoriasSeleccionadas.length && (
                    <button
                      type="button"
                      onClick={agregarAnimal}
                      className="w-full py-2 border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:bg-indigo-50 text-sm font-medium"
                    >
                      + Agregar otra categoría
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* NOTAS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones del traslado..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* BOTONES PASO 1 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (validarPaso1()) setPaso(2)
              }}
              disabled={!hayAnimalesValidos}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: DESTINO */}
      {paso === 2 && (
        <div className="space-y-6">
          {/* RESUMEN DE ORIGEN */}
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">📤 Desde</h3>
            <p className="text-gray-700">
              Potrero: <strong>{potrerosOrigen.find(p => p.id === potreroOrigenId)?.nombre}</strong>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {animalesAMover.filter(a => a.categoria && a.cantidad).map(a => 
                `${a.cantidad} ${a.categoria}`
              ).join(', ')}
            </p>
          </div>

          {/* CAMPO DESTINO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campo de destino
            </label>
            <select
              value={campoDestinoId}
              onChange={(e) => setCampoDestinoId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Seleccionar campo...</option>
              {camposDestino.map((campo) => (
                <option key={campo.id} value={campo.id}>
                  {campo.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* POTRERO DESTINO */}
          {campoDestinoId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Potrero de destino
              </label>
              {loadingPotreros ? (
                <p className="text-sm text-gray-600 italic">Cargando potreros...</p>
              ) : potrerosDestino.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Este campo no tiene potreros. Creá uno primero desde la web.
                  </p>
                </div>
              ) : (
                <select
  value={potreroDestinoId}
  onChange={(e) => setPotreroDestinoId(e.target.value)}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
  required
>
  <option value="">Seleccionar potrero...</option>
  {tieneModulosDestino ? (
    Object.entries(
      potrerosDestino.reduce((acc, potrero) => {
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
    potrerosDestino.map((lote) => (
      <option key={lote.id} value={lote.id}>
        {lote.nombre}
      </option>
    ))
  )}
</select>
              )}
            </div>
          )}

          {/* BOTONES PASO 2 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              ← Atrás
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !potreroDestinoId}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Guardando...' : 'Confirmar Traslado'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}