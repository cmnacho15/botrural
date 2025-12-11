'use client'

import { useState, useEffect } from 'react'

type ModuloPastoreo = {
  id: string
  nombre: string
  descripcion: string | null
  _count: {
    lotes: number
  }
}

type Potrero = {
  id: string
  nombre: string
  hectareas: number
}

export default function ModulosPreferencias() {
  const [modulos, setModulos] = useState<ModuloPastoreo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showModalEliminar, setShowModalEliminar] = useState(false)
  const [showModalPotreros, setShowModalPotreros] = useState(false)
  const [moduloAEliminar, setModuloAEliminar] = useState<ModuloPastoreo | null>(null)
  const [moduloPotreros, setModuloPotreros] = useState<ModuloPastoreo | null>(null)
  const [potreros, setPotreros] = useState<Potrero[]>([])
  const [loadingPotreros, setLoadingPotreros] = useState(false)
  const [nuevoModulo, setNuevoModulo] = useState({
    nombre: '',
    descripcion: ''
  })
  const [editandoModulo, setEditandoModulo] = useState<ModuloPastoreo | null>(null)
  const [saving, setSaving] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargarModulos()
  }, [])

  async function cargarModulos() {
    try {
      const response = await fetch('/api/modulos-pastoreo')
      if (response.ok) {
        const data = await response.json()
        setModulos(data)
      }
    } catch (error) {
      console.error('Error cargando módulos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarPotrerosDelModulo(moduloId: string) {
    setLoadingPotreros(true)
    try {
      const response = await fetch(`/api/modulos-pastoreo/${moduloId}/potreros`)
      if (response.ok) {
        const data = await response.json()
        setPotreros(data)
      }
    } catch (error) {
      console.error('Error cargando potreros:', error)
    } finally {
      setLoadingPotreros(false)
    }
  }

  async function handleDesvincularPotrero(potreroId: string) {
    if (!moduloPotreros) return

    try {
      const response = await fetch(`/api/modulos-pastoreo/${moduloPotreros.id}/potreros/${potreroId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Recargar potreros del módulo
        cargarPotrerosDelModulo(moduloPotreros.id)
        // Recargar módulos para actualizar el contador
        cargarModulos()
        alert('Potrero desvinculado. Ahora está en "Resto del campo".')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al desvincular potrero')
      }
    } catch (error) {
      alert('Error al desvincular potrero')
    }
  }

  async function handleGuardarModulo() {
    if (!nuevoModulo.nombre.trim()) {
      alert('Ingrese el nombre del módulo')
      return
    }

    setSaving(true)

    try {
      const url = editandoModulo 
        ? `/api/modulos-pastoreo/${editandoModulo.id}`
        : '/api/modulos-pastoreo'
      
      const method = editandoModulo ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoModulo),
      })

      if (response.ok) {
        setNuevoModulo({ nombre: '', descripcion: '' })
        setShowModal(false)
        setEditandoModulo(null)
        cargarModulos()
        alert(editandoModulo ? '¡Módulo actualizado!' : '¡Módulo creado!')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al guardar módulo')
      }
    } catch (error) {
      alert('Error al guardar módulo')
    } finally {
      setSaving(false)
    }
  }

  function abrirModalEliminar(modulo: ModuloPastoreo) {
    setModuloAEliminar(modulo)
    setShowModalEliminar(true)
  }

  function abrirModalPotreros(modulo: ModuloPastoreo) {
    setModuloPotreros(modulo)
    setShowModalPotreros(true)
    cargarPotrerosDelModulo(modulo.id)
  }

  async function handleEliminarModulo() {
    if (!moduloAEliminar) return

    setEliminando(true)

    try {
      const response = await fetch(`/api/modulos-pastoreo/${moduloAEliminar.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        cargarModulos()
        setShowModalEliminar(false)
        setModuloAEliminar(null)
        alert('Módulo eliminado. Los potreros fueron movidos a "Resto del campo".')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar módulo')
      }
    } catch (error) {
      alert('Error al eliminar módulo')
    } finally {
      setEliminando(false)
    }
  }

  function abrirModalEditar(modulo: ModuloPastoreo) {
    setEditandoModulo(modulo)
    setNuevoModulo({
      nombre: modulo.nombre,
      descripcion: modulo.descripcion || ''
    })
    setShowModal(true)
  }

  function cerrarModal() {
    setShowModal(false)
    setEditandoModulo(null)
    setNuevoModulo({ nombre: '', descripcion: '' })
  }

  function cerrarModalPotreros() {
    setShowModalPotreros(false)
    setModuloPotreros(null)
    setPotreros([])
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando módulos...</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Módulos de Pastoreo</h2>
            <p className="text-sm text-gray-500">Agrupa tus potreros en módulos para mejor organización</p>
          </div>
          <button
            onClick={() => {
              setEditandoModulo(null)
              setNuevoModulo({ nombre: '', descripcion: '' })
              setShowModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Módulo
          </button>
        </div>

        {modulos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500 mb-2">No hay módulos de pastoreo creados</p>
            <p className="text-sm text-gray-400">Crea tu primer módulo para organizar tus potreros</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Módulo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Potreros
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modulos.map((modulo) => (
                  <tr key={modulo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{modulo.nombre}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {modulo.descripcion || <span className="italic text-gray-400">Sin descripción</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        modulo._count.lotes > 0 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {modulo._count.lotes}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {modulo._count.lotes > 0 && (
                        <button
                          onClick={() => abrirModalPotreros(modulo)}
                          className="text-green-600 hover:text-green-900"
                          title="Ver potreros"
                        >
                          📍
                        </button>
                      )}
                      <button
                        onClick={() => abrirModalEditar(modulo)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => abrirModalEliminar(modulo)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR/EDITAR MÓDULO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {editandoModulo ? 'Editar Módulo' : 'Nuevo Módulo de Pastoreo'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del módulo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nuevoModulo.nombre}
                  onChange={(e) => setNuevoModulo({ ...nuevoModulo, nombre: e.target.value })}
                  placeholder="Ej: Módulo Norte, Pastoreo Rotativo 1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={nuevoModulo.descripcion}
                  onChange={(e) => setNuevoModulo({ ...nuevoModulo, descripcion: e.target.value })}
                  placeholder="Ej: Sistema de pastoreo rotativo intensivo con 15 días de descanso"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={cerrarModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarModulo}
                disabled={saving || !nuevoModulo.nombre.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Guardando...' : editandoModulo ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER POTREROS DEL MÓDULO */}
      {showModalPotreros && moduloPotreros && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Potreros de "{moduloPotreros.nombre}"
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Gestiona qué potreros pertenecen a este módulo
                </p>
              </div>
              <button onClick={cerrarModalPotreros} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ✕
              </button>
            </div>

            <div className="p-6">
              {loadingPotreros ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Cargando potreros...</p>
                </div>
              ) : potreros.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">Este módulo no tiene potreros asignados</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {potreros.map((potrero) => (
                    <div
                      key={potrero.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{potrero.nombre}</h3>
                        <p className="text-sm text-gray-500">{potrero.hectareas} ha</p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`¿Desvincular "${potrero.nombre}" de este módulo?\n\nEl potrero pasará a "Resto del campo".`)) {
                            handleDesvincularPotrero(potrero.id)
                          }
                        }}
                        className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
                      >
                        Desvincular
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={cerrarModalPotreros}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {showModalEliminar && moduloAEliminar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Confirmar Eliminación</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de eliminar el módulo <strong>"{moduloAEliminar.nombre}"</strong>?
              </p>

              {moduloAEliminar._count.lotes > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    ⚠️ Atención
                  </h3>
                  <p className="text-sm text-amber-700">
                    Este módulo tiene <strong>{moduloAEliminar._count.lotes} potrero{moduloAEliminar._count.lotes !== 1 ? 's' : ''}</strong> asignado{moduloAEliminar._count.lotes !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-sm text-amber-700 mt-2">
                    {moduloAEliminar._count.lotes === 1 
                      ? 'Este potrero pasará a "Resto del campo".' 
                      : 'Estos potreros pasarán a "Resto del campo".'}
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 text-sm">
                    ✅ Este módulo no tiene potreros asignados y puede ser eliminado sin afectar la organización.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowModalEliminar(false)
                  setModuloAEliminar(null)
                }}
                disabled={eliminando}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarModulo}
                disabled={eliminando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {eliminando ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}