'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ModalEsquilaProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CategoriaLana {
  categoria: string
  pesoKg: number
}

const CATEGORIAS_LANA = [
  { id: 'vellon', nombre: 'Vellón' },
  { id: 'barriga', nombre: 'Barriga' },
  { id: 'barriguera', nombre: 'Barriguera' },
  { id: 'pedazeria', nombre: 'Pedacería' },
]

export default function ModalEsquila({ isOpen, onClose, onSuccess }: ModalEsquilaProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Datos del formulario
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [nroAnimales, setNroAnimales] = useState('')
  const [precioRefUSD, setPrecioRefUSD] = useState('')
  const [notas, setNotas] = useState('')
  
  // Categorías de lana
  const [categorias, setCategorias] = useState<CategoriaLana[]>([
    { categoria: 'Vellón', pesoKg: 0 },
  ])

  const agregarCategoria = () => {
    setCategorias([...categorias, { categoria: 'Barriga', pesoKg: 0 }])
  }

  const eliminarCategoria = (index: number) => {
    if (categorias.length > 1) {
      setCategorias(categorias.filter((_, i) => i !== index))
    }
  }

  const actualizarCategoria = (index: number, campo: 'categoria' | 'pesoKg', valor: string | number) => {
  const nuevas = [...categorias]
  if (campo === 'categoria') {
    nuevas[index].categoria = valor as string
  } else {
    nuevas[index].pesoKg = valor as number
  }
  setCategorias(nuevas)
}

  const totalKg = categorias.reduce((sum, cat) => sum + (Number(cat.pesoKg) || 0), 0)
  const pesoPromedioPorAnimal = nroAnimales ? totalKg / Number(nroAnimales) : 0
  const valorEstimado = totalKg * (Number(precioRefUSD) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!fecha || !nroAnimales || !precioRefUSD) {
      setError('Por favor completá todos los campos obligatorios')
      return
    }

    if (categorias.length === 0 || totalKg === 0) {
      setError('Debés agregar al menos una categoría con peso')
      return
    }

    // Validar que no haya categorías duplicadas
    const categoriasNombres = categorias.map(c => c.categoria)
    const duplicadas = categoriasNombres.filter((item, index) => categoriasNombres.indexOf(item) !== index)
    if (duplicadas.length > 0) {
      setError('No podés tener categorías duplicadas')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/esquilas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          nroAnimales: parseInt(nroAnimales),
          precioRefUSD: parseFloat(precioRefUSD),
          notas: notas || null,
          categorias: categorias.map(cat => ({
            categoria: cat.categoria,
            pesoKg: parseFloat(cat.pesoKg.toString()),
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al crear esquila')
      }

      onSuccess()
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al crear esquila')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFecha(new Date().toISOString().split('T')[0])
    setNroAnimales('')
    setPrecioRefUSD('')
    setNotas('')
    setCategorias([{ categoria: 'Vellón', pesoKg: 0 }])
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🧶 Registrar Esquila</h2>
            <p className="text-sm text-gray-600 mt-1">Registrá la esquila y el stock de lana obtenido</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ERROR */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* DATOS GENERALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Esquila *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nº Animales Esquilados *
              </label>
              <input
                type="number"
                value={nroAnimales}
                onChange={(e) => setNroAnimales(e.target.value)}
                placeholder="2340"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio Referencia (USD/kg) *
              </label>
              <input
                type="number"
                step="0.01"
                value={precioRefUSD}
                onChange={(e) => setPrecioRefUSD(e.target.value)}
                placeholder="5.34"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* CATEGORÍAS DE LANA */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Desglose por Categoría *
              </label>
              <button
                type="button"
                onClick={agregarCategoria}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Agregar Categoría
              </button>
            </div>

            <div className="space-y-3">
              {categorias.map((cat, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      value={cat.categoria}
                      onChange={(e) => actualizarCategoria(index, 'categoria', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {CATEGORIAS_LANA.map((catOpt) => (
                        <option key={catOpt.id} value={catOpt.nombre}>
                          {catOpt.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      value={cat.pesoKg || ''}
                      onChange={(e) => actualizarCategoria(index, 'pesoKg', parseFloat(e.target.value) || 0)}
                      placeholder="Peso en kg"
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {categorias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarCategoria(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-700"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* TOTALES CALCULADOS */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">📊 Totales Calculados</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Total kg</p>
                <p className="text-lg font-bold text-gray-900">
                  {totalKg.toLocaleString('es-UY', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Promedio/animal</p>
                <p className="text-lg font-bold text-gray-900">
                  {pesoPromedioPorAnimal.toLocaleString('es-UY', { maximumFractionDigits: 2 })} kg
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Precio ref.</p>
                <p className="text-lg font-bold text-gray-900">
                  ${Number(precioRefUSD || 0).toFixed(2)}/kg
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Valor estimado</p>
                <p className="text-lg font-bold text-green-600">
                  ${valorEstimado.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* NOTAS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones sobre la esquila..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* BOTONES */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar Esquila'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}