'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Edit2, Plus } from 'lucide-react'
import { toast } from '@/app/components/Toast'

type CategoriaGasto = {
  id: string
  nombre: string
  color: string
  orden: number
}

export default function GastosPreferencias() {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

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

  useEffect(() => {
    setMounted(true)
  }, [])

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
        toast.error(error.error || 'Error al crear categoría')
        return
      }

      const nuevaCategoria = await response.json()
      setCategorias(prev => [...prev, nuevaCategoria])
      setNuevaCategoriaNombre('')
      setModalNuevaOpen(false)
      toast.success('✅ Categoría creada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear la categoría')
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
        toast.error(error.error || 'Error al actualizar categoría')
        return
      }

      const categoriaActualizada = await response.json()
      setCategorias(prev =>
        prev.map(c => (c.id === categoriaActualizada.id ? categoriaActualizada : c))
      )
      setModalEditarOpen(false)
      setCategoriaEditando(null)
      setNombreEditado('')
      toast.success('✅ Categoría actualizada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al actualizar la categoría')
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
        toast.error(error.error || 'Error al eliminar categoría')
        return
      }

      setCategorias(prev => prev.filter(c => c.id !== categoriaEliminar.id))
      setModalEliminarOpen(false)
      setCategoriaEliminar(null)
      toast.success('✅ Categoría eliminada exitosamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar la categoría')
    } finally {
      setLoadingDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-500">Cargando categorías...</p>
      </div>
    )
  }

  // Estilos inline para el overlay del modal - garantiza posicionamiento correcto
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    colorScheme: 'light' as any,
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    width: '100%',
    maxWidth: '400px',
    color: '#111827',
    colorScheme: 'light' as any,
  }

  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-semibold text-gray-900">Tipo de gastos</h2>
            <p className="text-xs sm:text-sm text-gray-500">Gestiona las categorías de tus gastos</p>
          </div>
        </div>

        <button
          onClick={() => setModalNuevaOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Nueva categoría
        </button>
      </div>

      {/* Lista de categorías */}
      <div className="space-y-1">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-gray-500 border-b border-gray-200">
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
              className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: categoria.color }}
                />
                <span className="text-sm sm:text-base text-gray-900 font-medium truncate">{categoria.nombre}</span>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => {
                    setCategoriaEditando(categoria)
                    setNombreEditado(categoria.nombre)
                    setModalEditarOpen(true)
                  }}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar categoría"
                >
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={() => {
                    setCategoriaEliminar(categoria)
                    setModalEliminarOpen(true)
                  }}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar categoría"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

      {/* MODAL NUEVA CATEGORÍA */}
      {mounted && modalNuevaOpen && createPortal(
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) { setModalNuevaOpen(false); setNuevaCategoriaNombre('') } }}>
          <div style={cardStyle}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Nueva categoría de gastos</span>
              <button onClick={() => { setModalNuevaOpen(false); setNuevaCategoriaNombre('') }} style={{ color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <input
                type="text"
                placeholder="Ej: Veterinario, Herramientas, etc."
                maxLength={120}
                value={nuevaCategoriaNombre}
                onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nuevaCategoriaNombre.trim()) handleCrearCategoria() }}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', outline: 'none', backgroundColor: '#f9fafb', boxSizing: 'border-box' }}
                autoFocus
              />
            </div>
            <div style={{ padding: '8px 16px 14px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setModalNuevaOpen(false); setNuevaCategoriaNombre('') }}
                style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearCategoria}
                disabled={nuevaCategoriaNombre.trim() === ''}
                style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#fff', backgroundColor: nuevaCategoriaNombre.trim() === '' ? '#d1d5db' : '#2563eb', cursor: nuevaCategoriaNombre.trim() === '' ? 'not-allowed' : 'pointer' }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EDITAR CATEGORÍA */}
      {mounted && modalEditarOpen && categoriaEditando && createPortal(
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) { setModalEditarOpen(false); setCategoriaEditando(null); setNombreEditado('') } }}>
          <div style={cardStyle}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: categoriaEditando.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Editar categoría</span>
              </div>
              <button onClick={() => { setModalEditarOpen(false); setCategoriaEditando(null); setNombreEditado('') }} style={{ color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <input
                type="text"
                placeholder="Nombre de la categoría"
                maxLength={120}
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nombreEditado.trim()) handleEditarCategoria() }}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', outline: 'none', backgroundColor: '#f9fafb', boxSizing: 'border-box' }}
                autoFocus
              />
            </div>
            <div style={{ padding: '8px 16px 14px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setModalEditarOpen(false); setCategoriaEditando(null); setNombreEditado('') }}
                style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEditarCategoria}
                disabled={nombreEditado.trim() === '' || nombreEditado === categoriaEditando.nombre}
                style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#fff', backgroundColor: (nombreEditado.trim() === '' || nombreEditado === categoriaEditando.nombre) ? '#d1d5db' : '#2563eb', cursor: (nombreEditado.trim() === '' || nombreEditado === categoriaEditando.nombre) ? 'not-allowed' : 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL ELIMINAR CATEGORÍA */}
      {mounted && modalEliminarOpen && categoriaEliminar && createPortal(
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) { setModalEliminarOpen(false); setCategoriaEliminar(null) } }}>
          <div style={cardStyle}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Eliminar categoría</span>
              <button onClick={() => { setModalEliminarOpen(false); setCategoriaEliminar(null) }} style={{ color: '#9ca3af', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '8px' }}>
                ¿Eliminar <strong style={{ color: '#111827' }}>"{categoriaEliminar.nombre}"</strong>?
              </p>
              <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500, backgroundColor: '#fef2f2', padding: '8px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                ⚠️ No se puede deshacer.
              </p>
            </div>
            <div style={{ padding: '8px 16px 14px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setModalEliminarOpen(false); setCategoriaEliminar(null) }}
                style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarCategoria}
                disabled={loadingDelete}
                style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#fff', backgroundColor: '#dc2626', cursor: loadingDelete ? 'not-allowed' : 'pointer', opacity: loadingDelete ? 0.5 : 1 }}
              >
                {loadingDelete ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
