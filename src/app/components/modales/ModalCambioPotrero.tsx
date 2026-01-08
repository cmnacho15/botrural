'use client'

import { useState, useEffect } from 'react'
import { obtenerFechaLocal } from '@/lib/fechas'

type ModalCambioPotreroProps = {
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
}

type AnimalLote = {
  id: string
  categoria: string
  cantidad: number
}

export default function ModalCambioPotrero({ onClose, onSuccess }: ModalCambioPotreroProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal())
  const [potreros, setPotreros] = useState<Lote[]>([])
  const [tieneModulos, setTieneModulos] = useState(false)
  const [potreroOrigen, setPotreroOrigen] = useState('')
  const [potreroDestino, setPotreroDestino] = useState('')
  const [animalesDisponibles, setAnimalesDisponibles] = useState<AnimalLote[]>([])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAnimales, setLoadingAnimales] = useState(false)

  // ✅ Estado para múltiples animales
  const [animalesAMover, setAnimalesAMover] = useState<Array<{
    id: string
    categoria: string
    cantidad: string
    cantidadMaxima: number
  }>>([{ id: '1', categoria: '', cantidad: '', cantidadMaxima: 0 }])

  // ✅ Estados para rodeos/lotes
  const [rodeos, setRodeos] = useState<{ id: string; nombre: string }[]>([])
  const [rodeoSeleccionado, setRodeoSeleccionado] = useState('')
  const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')

  // ✅ Cargar configuración, potreros y rodeos al montar
  useEffect(() => {
    Promise.all([
      fetch('/api/configuracion-rodeos').then(r => r.json()),
      fetch('/api/lotes').then(r => r.json()),
      fetch('/api/rodeos').then(r => r.json())
    ])
      .then(([config, lotes, rodeosData]) => {
  setModoRodeo(config.modoRodeo || 'OPCIONAL')
  setPotreros(lotes)
  setRodeos(rodeosData)
  
  // Detectar si el campo usa módulos
  const hayModulos = lotes.some((l: Lote) => l.moduloPastoreoId !== null)
  setTieneModulos(hayModulos)
})

      .catch(() => alert('Error al cargar datos'))
  }, [])

  // Cargar animales cuando se selecciona potrero origen
  useEffect(() => {
    if (!potreroOrigen) {
      setAnimalesDisponibles([])
      setAnimalesAMover([{ id: '1', categoria: '', cantidad: '', cantidadMaxima: 0 }])
      return
    }

    setLoadingAnimales(true)
    fetch(`/api/lotes/${potreroOrigen}/animales`)
      .then((res) => res.json())
      .then((data) => {
        setAnimalesDisponibles(data)
        setAnimalesAMover([{ id: '1', categoria: '', cantidad: '', cantidadMaxima: 0 }])
        setLoadingAnimales(false)
      })
      .catch(() => {
        alert('Error al cargar animales')
        setLoadingAnimales(false)
      })
  }, [potreroOrigen])

  // ✅ Funciones para manejar múltiples animales
  const agregarAnimal = () => {
    setAnimalesAMover([
      ...animalesAMover,
      { id: Date.now().toString(), categoria: '', cantidad: '', cantidadMaxima: 0 }
    ])
  }

  const eliminarAnimal = (id: string) => {
    if (animalesAMover.length > 1) {
      setAnimalesAMover(animalesAMover.filter(a => a.id !== id))
    }
  }

  const actualizarAnimal = (id: string, campo: 'categoria' | 'cantidad', valor: string) => {
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

  // Categorías ya seleccionadas (para no repetir)
  const categoriasSeleccionadas = animalesAMover.map(a => a.categoria).filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (potreroOrigen === potreroDestino) {
      alert('El potrero destino debe ser diferente al origen')
      return
    }

    // Validar animales
    const animalesValidos = animalesAMover.filter(a => 
      a.categoria && a.cantidad && parseInt(a.cantidad) > 0
    )

    if (animalesValidos.length === 0) {
      alert('Debe seleccionar al menos una categoría con cantidad')
      return
    }

    // Validar cantidades
    for (const animal of animalesValidos) {
      const cantidad = parseInt(animal.cantidad)
      if (cantidad <= 0 || cantidad > animal.cantidadMaxima) {
        alert(`La cantidad de ${animal.categoria} debe estar entre 1 y ${animal.cantidadMaxima}`)
        return
      }
    }

    setLoading(true)

    try {
      const response = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  tipo: 'CAMBIO_POTRERO',
  fecha: fecha,
  descripcion: (() => {
  const potreroOrigenData = potreros.find(p => p.id === potreroOrigen)
  const potreroDestinoData = potreros.find(p => p.id === potreroDestino)
  
  const nombreOrigen = potreroOrigenData?.moduloPastoreo?.nombre 
    ? `${potreroOrigenData.nombre} (${potreroOrigenData.moduloPastoreo.nombre})`
    : potreroOrigenData?.nombre
    
  const nombreDestino = potreroDestinoData?.moduloPastoreo?.nombre
    ? `${potreroDestinoData.nombre} (${potreroDestinoData.moduloPastoreo.nombre})`
    : potreroDestinoData?.nombre
  
  const rodeoTexto = rodeoSeleccionado && rodeos.find(r => r.id === rodeoSeleccionado) 
    ? ` - Lote ${rodeos.find(r => r.id === rodeoSeleccionado)?.nombre}` 
    : ''
  
  return `Cambio de ${animalesValidos.map(a => `${a.cantidad} ${a.categoria}`).join(', ')} del potrero "${nombreOrigen}" al potrero "${nombreDestino}"${rodeoTexto}`
})(),
          loteId: potreroOrigen,
          loteDestinoId: potreroDestino,
          animales: animalesValidos.map(a => ({
            categoria: a.categoria,
            cantidad: parseInt(a.cantidad)
          })),
          notas: notas || null,
          rodeoId: rodeoSeleccionado || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar')
      }

      onSuccess()
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar de potrero')
    } finally {
      setLoading(false)
    }
  }

  // Verificar si hay al menos un animal válido seleccionado
  const hayAnimalesValidos = animalesAMover.some(a => a.categoria && a.cantidad && parseInt(a.cantidad) > 0)

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            ⊞
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Cambio De Potrero</h2>
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

        {/* POTREROS CON MÓDULOS */}
<div>
  <label className="block text-sm font-medium text-gray-900 mb-3">Potreros</label>
  
  <div className="grid grid-cols-2 gap-4">
    {/* Potrero Origen */}
    <div>
      <label className="block text-xs text-gray-600 mb-1">Potrero Origen</label>
      <select
        value={potreroOrigen}
        onChange={(e) => setPotreroOrigen(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
        required
      >
        <option value="">Seleccionar...</option>
        {tieneModulos ? (
  Object.entries(
    potreros
      .reduce((acc, potrero) => {
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
          // Sin módulos
          potreros.map((lote) => (
            <option key={lote.id} value={lote.id}>
              {lote.nombre}
            </option>
          ))
        )}
      </select>
    </div>

    {/* Potrero Destino */}
    <div>
      <label className="block text-xs text-gray-600 mb-1">Potrero Destino</label>
      <select
        value={potreroDestino}
        onChange={(e) => setPotreroDestino(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
        required
        disabled={!potreroOrigen}
      >
        <option value="">Seleccionar...</option>
        {tieneModulos ? (
  Object.entries(
    potreros
      .filter((p) => p.id !== potreroOrigen)
      .reduce((acc, potrero) => {
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
          potreros
            .filter((p) => p.id !== potreroOrigen)
            .map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nombre}
              </option>
            ))
        )}
      </select>
    </div>
  </div>
</div>

        {/* ANIMALES - MÚLTIPLES CATEGORÍAS */}
        {potreroOrigen && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Animales</h3>

            {loadingAnimales ? (
              <p className="text-sm text-gray-600 italic">Cargando animales...</p>
            ) : animalesDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                No hay animales en este potrero
              </p>
            ) : (
              <div className="space-y-3">
                {animalesAMover.map((animal, index) => (
                  <div key={animal.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Categoría */}
                    <div className="col-span-5">
                      <label className="block text-xs text-gray-600 mb-1">Categoría</label>
                      <select
                        value={animal.categoria}
                        onChange={(e) => actualizarAnimal(animal.id, 'categoria', e.target.value)}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
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
                        placeholder="0"
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        disabled={!animal.categoria}
                      />
                    </div>

                    {/* Botón eliminar */}
                    <div className="col-span-2 flex items-end pb-1">
                      <button
                        type="button"
                        onClick={() => eliminarAnimal(animal.id)}
                        className="w-full py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition text-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={animalesAMover.length === 1}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}

                {/* Botón agregar más */}
                {animalesDisponibles.length > categoriasSeleccionadas.length && (
                  <button
                    type="button"
                    onClick={agregarAnimal}
                    className="w-full py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 transition text-sm font-medium"
                  >
                    + Agregar otra categoría
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ✅ SELECTOR DE RODEO/LOTE */}
        {modoRodeo !== 'NO_INCLUIR' && rodeos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lote {modoRodeo === 'OBLIGATORIO' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={rodeoSeleccionado}
              onChange={(e) => setRodeoSeleccionado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              required={modoRodeo === 'OBLIGATORIO'}
            >
              <option value="">Seleccionar lote...</option>
              {rodeos.map((rodeo) => (
                <option key={rodeo.id} value={rodeo.id}>
                  {rodeo.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* NOTAS */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (Opcional)</label>
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
          disabled={loading || !potreroOrigen || !potreroDestino || !hayAnimalesValidos || (modoRodeo === 'OBLIGATORIO' && !rodeoSeleccionado)}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Guardando...' : 'Continuar'}
        </button>
      </div>
    </form>
  )
}