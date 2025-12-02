'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ModalConsumo from '@/app/components/modales/ModalConsumo'

type ConsumoRenglon = {
  id: string
  tipoAnimal: string
  categoria: string
  cantidad: number
  pesoPromedio: number | null
  precioKgUSD: number | null
  precioAnimalUSD: number | null
  pesoTotalKg: number | null
  valorTotalUSD: number | null
  consumo: {
    fecha: string
  }
  animalLote: {
    lote: {
      nombre: string
    }
  } | null
}

type Consumo = {
  id: string
  fecha: string
  descripcion: string | null
  renglones: ConsumoRenglon[]
}

type ConsumoAgrupado = {
  categoria: string
  totalAnimales: number
  totalKg: number
  totalUSD: number
  renglones: ConsumoRenglon[]
}

export default function ConsumoPage() {
  const { data: session } = useSession()
  const [consumos, setConsumos] = useState<Consumo[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set())
  const [valoresLocales, setValoresLocales] = useState<{ [key: string]: { peso?: string, precio?: string } }>({})
  const timeoutRefs = useState<{ [key: string]: NodeJS.Timeout }>({})[0]

  useEffect(() => {
    cargarConsumos()
  }, [])

  const cargarConsumos = async () => {
    try {
      const res = await fetch('/api/consumos')
      const data: Consumo[] = await res.json()
      
      // Agregar la fecha del consumo a cada renglón
      const consumosConFecha = data.map(consumo => ({
        ...consumo,
        renglones: consumo.renglones.map(renglon => ({
          ...renglon,
          consumo: { fecha: consumo.fecha }
        }))
      }))
      
      setConsumos(consumosConFecha)
    } catch (error) {
      console.error('Error al cargar consumos:', error)
      alert('Error al cargar los consumos')
    } finally {
      setLoading(false)
    }
  }

  const handlePesoChange = (id: string, nuevoPeso: string) => {
    // Actualizar valor local inmediatamente
    setValoresLocales(prev => ({
      ...prev,
      [id]: { ...prev[id], peso: nuevoPeso }
    }))

    // Limpiar timeout anterior
    if (timeoutRefs[id]) {
      clearTimeout(timeoutRefs[id])
    }

    // Esperar 800ms antes de guardar
    timeoutRefs[id] = setTimeout(() => {
      const peso = parseFloat(nuevoPeso) || null
      actualizarRenglon(id, { pesoPromedio: peso })
    }, 800)
  }

  const handlePrecioKgChange = (id: string, nuevoPrecio: string) => {
    // Actualizar valor local inmediatamente
    setValoresLocales(prev => ({
      ...prev,
      [id]: { ...prev[id], precio: nuevoPrecio }
    }))

    // Limpiar timeout anterior
    if (timeoutRefs[id + '-precio']) {
      clearTimeout(timeoutRefs[id + '-precio'])
    }

    // Esperar 800ms antes de guardar
    timeoutRefs[id + '-precio'] = setTimeout(() => {
      const precio = parseFloat(nuevoPrecio) || null
      actualizarRenglon(id, { precioKgUSD: precio })
    }, 800)
  }

  const actualizarRenglon = async (id: string, datos: { pesoPromedio?: number | null, precioKgUSD?: number | null }) => {
    try {
      const res = await fetch(`/api/consumos/renglones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })

      if (!res.ok) throw new Error('Error al actualizar')

      await cargarConsumos()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el consumo')
    }
  }

  const agruparPorTipoYCategoria = () => {
    const agrupado: { [tipoAnimal: string]: ConsumoAgrupado[] } = {}

    consumos.forEach(consumo => {
      consumo.renglones.forEach(renglon => {
        const tipo = renglon.tipoAnimal || 'OTRO'
        
        if (!agrupado[tipo]) {
          agrupado[tipo] = []
        }

        // Buscar si ya existe esta categoría
        let categoriaExistente = agrupado[tipo].find(c => c.categoria === renglon.categoria)
        
        if (!categoriaExistente) {
          categoriaExistente = {
            categoria: renglon.categoria,
            totalAnimales: 0,
            totalKg: 0,
            totalUSD: 0,
            renglones: []
          }
          agrupado[tipo].push(categoriaExistente)
        }

        // Sumar totales
        categoriaExistente.totalAnimales += renglon.cantidad
        categoriaExistente.totalKg += renglon.pesoTotalKg || 0
        categoriaExistente.totalUSD += renglon.valorTotalUSD || 0
        categoriaExistente.renglones.push(renglon)
      })
    })

    return agrupado
  }

  const toggleDetalleCategoria = (tipoAnimal: string, categoria: string) => {
    const key = `${tipoAnimal}-${categoria}`
    setCategoriasExpandidas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const getNombreTipo = (tipo: string) => {
    const nombres: { [key: string]: string } = {
      'BOVINO': 'Vacuno',
      'OVINO': 'Ovino',
      'EQUINO': 'Equino',
      'OTRO': 'Otros'
    }
    return nombres[tipo] || tipo
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600">Cargando consumos...</div>
      </div>
    )
  }

  const consumosAgrupados = agruparPorTipoYCategoria()

  if (Object.keys(consumosAgrupados).length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
              🍖
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Consumos</h1>
          </div>
          <button
            onClick={() => setMostrarModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nuevo Consumo
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No hay consumos registrados aún</p>
        </div>

        {mostrarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <ModalConsumo
                onClose={() => setMostrarModal(false)}
                onSuccess={() => {
                  cargarConsumos()
                  setMostrarModal(false)
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            🍖
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Consumos</h1>
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Nuevo Consumo
        </button>
      </div>

      {/* TABLAS POR TIPO DE ANIMAL */}
      <div className="space-y-8">
        {Object.keys(consumosAgrupados).sort().map(tipoAnimal => {
          const nombreTipo = getNombreTipo(tipoAnimal)
          const categorias = consumosAgrupados[tipoAnimal]
          
          const totalesGenerales = categorias.reduce((acc, cat) => ({
            animales: acc.animales + cat.totalAnimales,
            kg: acc.kg + cat.totalKg,
            usd: acc.usd + cat.totalUSD
          }), { animales: 0, kg: 0, usd: 0 })
          
          return (
            <div key={tipoAnimal} className="bg-white rounded-lg shadow overflow-hidden">
              {/* HEADER TIPO */}
              <div className="bg-amber-500 px-6 py-3">
                <h2 className="text-lg font-bold text-white">{nombreTipo}</h2>
              </div>

              {/* TABLA */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Categoría</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nº Animales</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">U$S totales</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">kg totales</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorias.map((categoria) => {
                      const key = `${tipoAnimal}-${categoria.categoria}`
                      const estaExpandido = categoriasExpandidas.has(key)
                      
                      return (
                        <>
                          {/* FILA AGRUPADA */}
                          <tr key={categoria.categoria} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{categoria.categoria}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{categoria.totalAnimales}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">{categoria.totalUSD.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">{categoria.totalKg.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleDetalleCategoria(tipoAnimal, categoria.categoria)}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                              >
                                {estaExpandido ? '▲ Ocultar' : '▼ Ver detalle'}
                              </button>
                            </td>
                          </tr>

                          {/* FILAS DE DETALLE */}
                          {estaExpandido && categoria.renglones.map((renglon) => (
                            <tr key={renglon.id} className="bg-blue-50 border-b border-blue-100">
                              <td className="px-8 py-2 text-xs text-gray-600">
                                📅 {formatearFecha(renglon.consumo.fecha)}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-700">{renglon.cantidad}</td>
                              <td className="px-4 py-2 text-xs bg-blue-100">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={valoresLocales[renglon.id]?.peso !== undefined ? valoresLocales[renglon.id].peso : (renglon.pesoPromedio || '')}
                                  onChange={(e) => handlePesoChange(renglon.id, e.target.value)}
                                  placeholder="kg"
                                  className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                                <span className="ml-1 text-gray-600">kg</span>
                              </td>
                              <td className="px-4 py-2 text-xs bg-blue-100">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={valoresLocales[renglon.id]?.precio !== undefined ? valoresLocales[renglon.id].precio : (renglon.precioKgUSD || '')}
                                  onChange={(e) => handlePrecioKgChange(renglon.id, e.target.value)}
                                  placeholder="U$S"
                                  className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                                <span className="ml-1 text-gray-600">U$S/kg</span>
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-600 text-center">
                                {renglon.valorTotalUSD?.toFixed(2) || '0.00'} U$S | {renglon.pesoTotalKg?.toFixed(2) || '0.00'} kg
                              </td>
                            </tr>
                          ))}
                        </>
                      )
                    })}

                    {/* FILA DE TOTALES GENERALES */}
                    <tr className="bg-amber-100 font-bold">
                      <td className="px-4 py-3 text-sm">TOTAL</td>
                      <td className="px-4 py-3 text-sm">{totalesGenerales.animales}</td>
                      <td className="px-4 py-3 text-sm">{totalesGenerales.usd.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{totalesGenerales.kg.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ModalConsumo
              onClose={() => setMostrarModal(false)}
              onSuccess={() => {
                cargarConsumos()
                setMostrarModal(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}