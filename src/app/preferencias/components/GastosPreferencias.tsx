'use client'

import { useState, useEffect } from 'react'
import { Trash2, Edit2, Plus } from 'lucide-react'

type CategoriaGasto = {
  id: string
  nombre: string
  color: string
  orden: number
}

export default function GastosPreferencias() {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estados para modal nueva categoría
  const [modalNuevaOpen, setModalNuevaOpen] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  
  // Estados para modal editar
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaGasto | null>(null)
  const [nombreEditado, setNombreEditado] = useState('')
  
  // Estados para modal eliminar
  const [modalEliminarOpen, setModalEliminarOpen] = useState(false)
  const [categoriaEliminar, setCategoriaEliminar] = useState<CategoriaGasto | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  // Fetch categorías
  useEffect(() => {
    fetchCategorias()
  }, [])

  const fetchCategorias = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/categorias-gasto')
      if (res.ok) {
        const data = await res.json()
        setCategorias(data)
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error)
    } finally {
      setLoading(false)
    }
  }

  // Función para generar color único
  const generarColorUnico = (coloresUsados: string[]): string => {
    const coloresDisponibles = [
      '#8b5cf6', '#14b8a6', '#f59e0b', '#10b981', '#6366f1', '#fb7185',
      '#0ea5e9', '#14532d', '#1e3a8a', '#7c2d12', '#831843', '#365314',
      '#9333ea', '#0891b2', '#ea580c', '#be123c'
    ]

    for (const color of coloresDisponibles) {
      if (!coloresUsados.includes(color)) {
        return color
      }
    }

    return '#' + Math.floor(Math.random() * 16777215).toString(16)
  }

  // Crear nueva categoría
  const handleCrearCategoria = async () => {
    if (nuevaCategoriaNombre.trim() === '') return

    try {
      const coloresUsados = categorias.map(c => c.color)
      const nuevoColor = generarColorUnico(coloresUsados)

      const response = await fetch('/api/categorias-gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevaCategoriaNombre.trim(),
          color: nuevoColor,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Error al crear categoría')
        return
      }

      const nuevaCategoria = await response.json()
      setCategorias(prev => [...prev, nuevaCategoria])
      setNuevaCategoriaNombre('')
      setModalNuevaOpen(false)
      alert('✅ Categoría creada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear la categoría')
    }
  }

  // Editar categoría
  const handleEditarCategoria = async () => {
    if (!categoriaEditando || nombreEditado.trim() === '') return

    try {
      const response = await fetch(`/api/categorias-gasto/${categoriaEditando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreEditado.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Error al actualizar categoría')
        return
      }

      const categoriaActualizada = await response.json()
      setCategorias(prev =>
        prev.map(c => (c.id === categoriaActualizada.id ? categoriaActualizada : c))
      )
      setModalEditarOpen(false)
      setCategoriaEditando(null)
      setNombreEditado('')
      alert('✅ Categoría actualizada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar la categoría')
    }
  }

  // Eliminar categoría
  const handleEliminarCategoria = async () => {
    if (!categoriaEliminar) return

    setLoadingDelete(true)
    try {
      const response = await fetch(`/api/categorias-gasto/${categoriaEliminar.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Error al eliminar categoría')
        return
      }

      setCategorias(prev => prev.filter(c => c.id !== categoriaEliminar.id))
      setModalEliminarOpen(false)
      setCategoriaEliminar(null)
      alert('✅ Categoría eliminada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar la categoría')
    } finally {
      setLoadingDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Cargando categorías...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tipo de gastos</h2>
            <p className="text-sm text-gray-500">Gestiona las categorías de tus gastos</p>
          </div>
        </div>
        
        <button
          onClick={() => setModalNuevaOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Nueva categoría
        </button>
      </div>

      {/* Lista de categorías */}
      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-8">Categoría</div>
          <div className="col-span-4 text-right">Acciones</div>
        </div>

        {categorias.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-gray-500">No hay categorías registradas</p>
            <button
              onClick={() => setModalNuevaOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Crear primera categoría
            </button>
          </div>
        ) : (
          categorias.map((categoria) => (
            <div
              key={categoria.id}
              className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-b-0"
            >
              {/* Categoría con color */}
              <div className="col-span-8 flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: categoria.color }}
                />
                <span className="text-gray-900 font-medium">{categoria.nombre}</span>
              </div>

              {/* Acciones */}
              <div className="col-span-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setCategoriaEditando(categoria)
                    setNombreEditado(categoria.nombre)
                    setModalEditarOpen(true)
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar categoría"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => {
                    setCategoriaEliminar(categoria)
                    setModalEliminarOpen(true)
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar categoría"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL NUEVA CATEGORÍA */}
      {modalNuevaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Nueva categoría de gastos</h2>
              <button
                onClick={() => {
                  setModalNuevaOpen(false)
                  setNuevaCategoriaNombre('')
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre de la categoría
                </label>
                <input
                  type="text"
                  placeholder="Ej: Veterinario, Herramientas, etc."
                  maxLength={120}
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && nuevaCategoriaNombre.trim()) {
                      handleCrearCategoria()
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">{nuevaCategoriaNombre.length}/120</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setModalNuevaOpen(false)
                  setNuevaCategoriaNombre('')
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearCategoria}
                disabled={nuevaCategoriaNombre.trim() === ''}
                className={`flex-1 px-6 py-3 rounded-xl text-white font-medium transition ${
                  nuevaCategoriaNombre.trim() === ''
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                }`}
              >
                Crear categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CATEGORÍA */}
      {modalEditarOpen && categoriaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Editar categoría</h2>
              <button
                onClick={() => {
                  setModalEditarOpen(false)
                  setCategoriaEditando(null)
                  setNombreEditado('')
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre de la categoría
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    style={{ backgroundColor: categoriaEditando.color }}
                  />
                  <span className="text-sm text-gray-500">Color asignado</span>
                </div>
                <input
                  type="text"
                  placeholder="Nombre"
                  maxLength={120}
                  value={nombreEditado}
                  onChange={(e) => setNombreEditado(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && nombreEditado.trim()) {
                      handleEditarCategoria()
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">{nombreEditado.length}/120</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setModalEditarOpen(false)
                  setCategoriaEditando(null)
                  setNombreEditado('')
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditarCategoria}
                disabled={nombreEditado.trim() === '' || nombreEditado === categoriaEditando.nombre}
                className={`flex-1 px-6 py-3 rounded-xl text-white font-medium transition ${
                  nombreEditado.trim() === '' || nombreEditado === categoriaEditando.nombre
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                }`}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CATEGORÍA */}
      {modalEliminarOpen && categoriaEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Eliminar categoría</h2>
              </div>
              <button
                onClick={() => {
                  setModalEliminarOpen(false)
                  setCategoriaEliminar(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                ¿Estás seguro que querés eliminar la categoría{' '}
                <span className="font-semibold text-gray-900">"{categoriaEliminar.nombre}"</span>?
              </p>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: categoriaEliminar.color }}
                />
                <span className="text-sm text-gray-500">Color: {categoriaEliminar.color}</span>
              </div>
              <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-200">
                ⚠️ Esta acción no se puede deshacer. Los gastos asociados a esta categoría permanecerán sin cambios.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalEliminarOpen(false)
                  setCategoriaEliminar(null)
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarCategoria}
                disabled={loadingDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition shadow-sm"
              >
                {loadingDelete ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}