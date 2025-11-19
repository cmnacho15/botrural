'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type TipoCultivo = {
  id: string
  nombre: string
}

export default function PreferenciasPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'cultivos' | 'animales' | 'gastos'>('cultivos')
  const [cultivos, setCultivos] = useState<TipoCultivo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nuevoCultivo, setNuevoCultivo] = useState('')
  const [savingCultivo, setSavingCultivo] = useState(false)

  // Cargar cultivos al montar
  useEffect(() => {
    cargarCultivos()
  }, [])

  async function cargarCultivos() {
    try {
      const response = await fetch('/api/tipos-cultivo')
      if (response.ok) {
        const data = await response.json()
        setCultivos(data)
      }
    } catch (error) {
      console.error('Error cargando cultivos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAgregarCultivo() {
    if (!nuevoCultivo.trim()) {
      alert('Ingrese el nombre del cultivo')
      return
    }

    setSavingCultivo(true)

    try {
      const response = await fetch('/api/tipos-cultivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoCultivo.trim() }),
      })

      if (response.ok) {
        setNuevoCultivo('')
        setShowModal(false)
        cargarCultivos()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear cultivo')
      }
    } catch (error) {
      alert('Error al crear cultivo')
    } finally {
      setSavingCultivo(false)
    }
  }

  async function handleEliminarCultivo(id: string) {
    if (!confirm('¿Estás seguro de eliminar este cultivo?')) return

    try {
      const response = await fetch(`/api/tipos-cultivo/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        cargarCultivos()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar cultivo')
      }
    } catch (error) {
      alert('Error al eliminar cultivo')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">⚙️ Preferencias</h1>
          <p className="text-gray-600 text-sm">Configurá las opciones de tu campo</p>
        </div>

        {/* TABS */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-6">
              <button
                onClick={() => setActiveTab('cultivos')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'cultivos'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🌾 Cultivos
              </button>
              <button
                onClick={() => setActiveTab('animales')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'animales'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🐄 Animales
              </button>
              <button
                onClick={() => setActiveTab('gastos')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'gastos'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                💰 Gastos
              </button>
            </nav>
          </div>

          {/* CONTENIDO TAB CULTIVOS */}
          {activeTab === 'cultivos' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tipos de cultivos</h2>
                  <p className="text-sm text-gray-500">Gestiona los tipos de cultivos disponibles</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo Cultivo
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando cultivos...</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cultivo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cultivos.map((cultivo) => (
                        <tr key={cultivo.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">{cultivo.nombre}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">
                              {cultivo.id.startsWith('pred-') ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                  Predeterminado
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  Personalizado
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {!cultivo.id.startsWith('pred-') && (
                              <button
                                onClick={() => handleEliminarCultivo(cultivo.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO TAB ANIMALES */}
          {activeTab === 'animales' && (
            <div className="p-6">
              <p className="text-gray-500 text-center py-12">Próximamente...</p>
            </div>
          )}

          {/* CONTENIDO TAB GASTOS */}
          {activeTab === 'gastos' && (
            <div className="p-6">
              <p className="text-gray-500 text-center py-12">Próximamente...</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVO CULTIVO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo Cultivo</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ✕
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del cultivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nuevoCultivo}
                onChange={(e) => setNuevoCultivo(e.target.value)}
                placeholder="Ej: Quinoa"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarCultivo}
                disabled={savingCultivo || !nuevoCultivo.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {savingCultivo ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}