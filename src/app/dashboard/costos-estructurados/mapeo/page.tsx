'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CATEGORIAS_COSTOS_ESTRUCTURADOS, getAllSubcategorias } from '@/lib/costos-estructurados'

type CategoriaGasto = {
  id: string
  nombre: string
  color: string
  activo: boolean
  mapeadaACostos: boolean
  categoriaCostoEstructurado?: string
  subcategoriaCosto?: string
  porcentajeVacuno: number
  porcentajeOvino: number
  porcentajeEquino: number
  porcentajeDesperdicios: number
}

type SubcategoriaOption = {
  categoria: string
  subcategoria: string
  nombreCategoria: string
  nombreSubcategoria: string
}

export default function MapeoCategoriasPage() {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [aplicandoMapeoInicial, setAplicandoMapeoInicial] = useState(false)
  
  // Modal de edición
  const [modalEditar, setModalEditar] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaGasto | null>(null)
  
  // Formulario
  const [mapeadaACostos, setMapeadaACostos] = useState(false)
  const [categoriaDestino, setCategoriaDestino] = useState('')
  const [subcategoriaDestino, setSubcategoriaDestino] = useState('')
  const [porcentajeVacuno, setPorcentajeVacuno] = useState(100)
  const [porcentajeOvino, setPorcentajeOvino] = useState(0)
  const [porcentajeEquino, setPorcentajeEquino] = useState(0)
  const [porcentajeDesperdicios, setPorcentajeDesperdicios] = useState(0)

  // Opciones de subcategorías
  const [subcategorias, setSubcategorias] = useState<SubcategoriaOption[]>([])

  useEffect(() => {
    cargarCategorias()
    setSubcategorias(getAllSubcategorias())
  }, [])

  const cargarCategorias = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/categorias-gasto')
      if (res.ok) {
        const data = await res.json()
        setCategorias(data.filter((c: CategoriaGasto) => c.activo))
      }
    } catch (error) {
      console.error('Error cargando categorías:', error)
    } finally {
      setLoading(false)
    }
  }

  const aplicarMapeoInicial = async () => {
    if (!confirm('¿Aplicar mapeo inicial sugerido a todas las categorías compatibles? Esto sobrescribirá configuraciones existentes.')) {
      return
    }

    try {
      setAplicandoMapeoInicial(true)
      const res = await fetch('/api/categorias-gasto/mapeo-inicial', {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al aplicar mapeo')
        return
      }

      const resultado = await res.json()
      alert(`✅ ${resultado.message}`)
      await cargarCategorias()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al aplicar mapeo inicial')
    } finally {
      setAplicandoMapeoInicial(false)
    }
  }

  const abrirEdicion = (categoria: CategoriaGasto) => {
    setCategoriaEditando(categoria)
    setMapeadaACostos(categoria.mapeadaACostos)
    setCategoriaDestino(categoria.categoriaCostoEstructurado || '')
    setSubcategoriaDestino(categoria.subcategoriaCosto || '')
    setPorcentajeVacuno(categoria.porcentajeVacuno)
    setPorcentajeOvino(categoria.porcentajeOvino)
    setPorcentajeEquino(categoria.porcentajeEquino)
    setPorcentajeDesperdicios(categoria.porcentajeDesperdicios)
    setModalEditar(true)
  }

  const guardarMapeo = async () => {
    if (!categoriaEditando) return

    // Validar porcentajes
    const suma = porcentajeVacuno + porcentajeOvino + porcentajeEquino + porcentajeDesperdicios
    if (mapeadaACostos && Math.abs(suma - 100) > 0.01) {
      alert('Los porcentajes deben sumar exactamente 100%')
      return
    }

    if (mapeadaACostos && (!categoriaDestino || !subcategoriaDestino)) {
      alert('Debe seleccionar categoría y subcategoría de destino')
      return
    }

    try {
      const res = await fetch(`/api/categorias-gasto/${categoriaEditando.id}/mapeo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapeadaACostos,
          categoriaCostoEstructurado: mapeadaACostos ? categoriaDestino : null,
          subcategoriaCosto: mapeadaACostos ? subcategoriaDestino : null,
          porcentajeVacuno,
          porcentajeOvino,
          porcentajeEquino,
          porcentajeDesperdicios,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al guardar')
        return
      }

      alert('✅ Mapeo guardado exitosamente')
      setModalEditar(false)
      await cargarCategorias()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar mapeo')
    }
  }

  const eliminarMapeo = async (categoriaId: string) => {
    if (!confirm('¿Eliminar el mapeo de esta categoría?')) {
      return
    }

    try {
      const res = await fetch(`/api/categorias-gasto/${categoriaId}/mapeo`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al eliminar')
        return
      }

      alert('✅ Mapeo eliminado')
      await cargarCategorias()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar mapeo')
    }
  }

  // Filtrar subcategorías por categoría seleccionada
  const subcategoriasFiltradas = categoriaDestino
    ? subcategorias.filter(s => s.categoria === categoriaDestino)
    : []

  // Estadísticas
  const totalCategorias = categorias.length
  const categoriasMapeadas = categorias.filter(c => c.mapeadaACostos).length
  const porcentajeMapeado = totalCategorias > 0 ? (categoriasMapeadas / totalCategorias) * 100 : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/costos-estructurados"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xl">⚙️</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Mapeo de Categorías
            </h1>
          </div>

          <button
            onClick={aplicarMapeoInicial}
            disabled={aplicandoMapeoInicial}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {aplicandoMapeoInicial ? 'Aplicando...' : '✨ Aplicar Mapeo Sugerido'}
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {/* ESTADÍSTICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600 mb-1">Total Categorías</div>
            <div className="text-3xl font-bold text-gray-900">{totalCategorias}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600 mb-1">Mapeadas</div>
            <div className="text-3xl font-bold text-green-600">{categoriasMapeadas}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-600 mb-1">Progreso</div>
            <div className="text-3xl font-bold text-blue-600">{porcentajeMapeado.toFixed(0)}%</div>
          </div>
        </div>

        {/* INSTRUCCIONES */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Cada categoría de gastos puede mapearse a un renglón específico de costos estructurados</li>
            <li>• Los porcentajes de distribución deben sumar 100%</li>
            <li>• Al importar gastos, se aplicará automáticamente esta configuración</li>
            <li>• Podés usar el botón "Aplicar Mapeo Sugerido" para configurar automáticamente categorías comunes</li>
          </ul>
        </div>

        {/* TABLA DE CATEGORÍAS */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría Gasto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapea a
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distribución
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categorias.map((categoria) => (
                  <tr key={categoria.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: categoria.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {categoria.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {categoria.mapeadaACostos ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          ✓ Mapeada
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                          Sin mapear
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {categoria.mapeadaACostos && categoria.categoriaCostoEstructurado ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {CATEGORIAS_COSTOS_ESTRUCTURADOS[categoria.categoriaCostoEstructurado as keyof typeof CATEGORIAS_COSTOS_ESTRUCTURADOS]?.nombre}
                          </div>
                          <div className="text-gray-500">
                            {categoria.subcategoriaCosto}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {categoria.mapeadaACostos ? (
                        <div className="text-xs text-gray-600">
                          <div>🐄 {categoria.porcentajeVacuno}%</div>
                          <div>🐑 {categoria.porcentajeOvino}%</div>
                          <div>🐴 {categoria.porcentajeEquino}%</div>
                          {categoria.porcentajeDesperdicios > 0 && (
                            <div>🗑️ {categoria.porcentajeDesperdicios}%</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => abrirEdicion(categoria)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {categoria.mapeadaACostos ? 'Editar' : 'Configurar'}
                      </button>
                      {categoria.mapeadaACostos && (
                        <button
                          onClick={() => eliminarMapeo(categoria.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR MAPEO */}
      {modalEditar && categoriaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Configurar Mapeo: {categoriaEditando.nombre}
              </h2>
              <button
                onClick={() => setModalEditar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* ACTIVAR MAPEO */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={mapeadaACostos}
                  onChange={(e) => setMapeadaACostos(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-900">
                  Mapear esta categoría a costos estructurados
                </label>
              </div>

              {mapeadaACostos && (
                <>
                  {/* CATEGORÍA DESTINO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoría de Destino
                    </label>
                    <select
                      value={categoriaDestino}
                      onChange={(e) => {
                        setCategoriaDestino(e.target.value)
                        setSubcategoriaDestino('') // Reset subcategoría
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      {Object.entries(CATEGORIAS_COSTOS_ESTRUCTURADOS).map(([key, cat]) => (
                        <option key={key} value={key}>
                          {cat.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SUBCATEGORÍA DESTINO */}
                  {categoriaDestino && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subcategoría (Renglón)
                      </label>
                      <select
                        value={subcategoriaDestino}
                        onChange={(e) => setSubcategoriaDestino(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        {subcategoriasFiltradas.map((sub) => (
                          <option key={sub.subcategoria} value={sub.subcategoria}>
                            {sub.nombreSubcategoria}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* DISTRIBUCIÓN POR TIPO */}
                  <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      Distribución por Tipo de Animal
                    </h3>
                    <p className="text-sm text-gray-600">
                      Los porcentajes deben sumar exactamente 100%
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          🐄 Vacuno (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={porcentajeVacuno}
                          onChange={(e) => setPorcentajeVacuno(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          🐑 Ovino (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={porcentajeOvino}
                          onChange={(e) => setPorcentajeOvino(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          🐴 Equino (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={porcentajeEquino}
                          onChange={(e) => setPorcentajeEquino(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          🗑️ Desperdicios (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={porcentajeDesperdicios}
                          onChange={(e) => setPorcentajeDesperdicios(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-sm text-gray-600">Total: </span>
                      <span className={`text-lg font-bold ${
                        Math.abs((porcentajeVacuno + porcentajeOvino + porcentajeEquino + porcentajeDesperdicios) - 100) < 0.01
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {(porcentajeVacuno + porcentajeOvino + porcentajeEquino + porcentajeDesperdicios).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setModalEditar(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={guardarMapeo}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Guardar Mapeo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}