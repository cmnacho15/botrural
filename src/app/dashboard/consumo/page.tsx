'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ModalConsumo from '@/app/components/modales/ModalConsumo'

type ConsumoRenglon = {
  id: string
  categoria: string
  cantidad: number
  pesoPromedio: number | null
  precioKgUSD: number | null
  precioAnimalUSD: number | null
  pesoTotalKg: number | null
  valorTotalUSD: number | null
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

type ConsumosPorCategoria = {
  [categoria: string]: ConsumoRenglon[]
}

export default function ConsumoPage() {
  const { data: session } = useSession()
  const [consumos, setConsumos] = useState<ConsumosPorCategoria>({})
  const [loading, setLoading] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)

  useEffect(() => {
    cargarConsumos()
  }, [])

  const cargarConsumos = async () => {
    try {
      const res = await fetch('/api/consumos')
      const data: Consumo[] = await res.json()
      
      // Agrupar renglones por categoría
      const agrupados: ConsumosPorCategoria = {}
      data.forEach((consumo) => {
        consumo.renglones.forEach((renglon) => {
          const categoria = renglon.categoria || 'Sin categoría'
          if (!agrupados[categoria]) {
            agrupados[categoria] = []
          }
          agrupados[categoria].push(renglon)
        })
      })
      
      setConsumos(agrupados)
    } catch (error) {
      console.error('Error al cargar consumos:', error)
      alert('Error al cargar los consumos')
    } finally {
      setLoading(false)
    }
  }

  const handlePesoChange = async (id: string, nuevoPeso: string) => {
    const peso = parseFloat(nuevoPeso) || null
    await actualizarRenglon(id, { pesoPromedio: peso })
  }

  const handlePrecioKgChange = async (id: string, nuevoPrecio: string) => {
    const precio = parseFloat(nuevoPrecio) || null
    await actualizarRenglon(id, { precioKgUSD: precio })
  }

  const actualizarRenglon = async (id: string, datos: { pesoPromedio?: number | null, precioKgUSD?: number | null }) => {
    try {
      const res = await fetch(`/api/consumos/renglones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })

      if (!res.ok) throw new Error('Error al actualizar')

      const renglonActualizado = await res.json()

      // Actualizar estado local
      setConsumos(prev => {
        const nuevos = { ...prev }
        Object.keys(nuevos).forEach(cat => {
          nuevos[cat] = nuevos[cat].map(r => 
            r.id === id ? { ...r, ...renglonActualizado } : r
          )
        })
        return nuevos
      })
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el consumo')
    }
  }

  const calcularTotales = (categoria: string) => {
    const items = consumos[categoria] || []
    const totalAnimales = items.reduce((sum, item) => sum + item.cantidad, 0)
    const totalKg = items.reduce((sum, item) => sum + (item.pesoTotalKg || 0), 0)
    const totalUSD = items.reduce((sum, item) => sum + (item.valorTotalUSD || 0), 0)

    return { totalAnimales, totalKg, totalUSD }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-600">Cargando consumos...</div>
      </div>
    )
  }

  if (Object.keys(consumos).length === 0) {
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

      {/* TABLAS POR CATEGORÍA */}
      <div className="space-y-8">
        {Object.keys(consumos).sort().map(categoria => {
          const totales = calcularTotales(categoria)
          
          return (
            <div key={categoria} className="bg-white rounded-lg shadow overflow-hidden">
              {/* HEADER CATEGORÍA */}
              <div className="bg-amber-500 px-6 py-3">
                <h2 className="text-lg font-bold text-white">{categoria}</h2>
              </div>

              {/* TABLA */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nº Animales</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">Peso</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">U$S/kg</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">U$S x cabeza</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">kg totales</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">U$S totales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumos[categoria].map((renglon) => (
                      <tr key={renglon.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{renglon.cantidad}</td>
                        
                        {/* PESO - EDITABLE */}
                        <td className="px-4 py-3 text-sm bg-yellow-50">
                          <input
                            type="number"
                            step="0.1"
                            value={renglon.pesoPromedio || ''}
                            onChange={(e) => handlePesoChange(renglon.id, e.target.value)}
                            placeholder="kg"
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>

                        {/* PRECIO KG - EDITABLE */}
                        <td className="px-4 py-3 text-sm bg-yellow-50">
                          <input
                            type="number"
                            step="0.01"
                            value={renglon.precioKgUSD || ''}
                            onChange={(e) => handlePrecioKgChange(renglon.id, e.target.value)}
                            placeholder="U$S"
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>

                        {/* CALCULADOS AUTOMÁTICAMENTE */}
                        <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">
                          {renglon.precioAnimalUSD?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">
                          {renglon.pesoTotalKg?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">
                          {renglon.valorTotalUSD?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))}

                    {/* FILA DE TOTALES */}
                    <tr className="bg-amber-100 font-bold">
                      <td className="px-4 py-3 text-sm">{totales.totalAnimales}</td>
                      <td className="px-4 py-3 text-sm" colSpan={3}></td>
                      <td className="px-4 py-3 text-sm">{totales.totalKg.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{totales.totalUSD.toFixed(2)}</td>
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