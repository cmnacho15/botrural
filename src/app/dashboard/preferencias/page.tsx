'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GastosPreferencias from '@/app/preferencias/components/GastosPreferencias'

type TipoCultivo = {
  id: string
  nombre: string
}

type CategoriaAnimal = {
  id: string
  nombreSingular: string
  nombrePlural: string
  tipoAnimal: string
  activo: boolean
  esPredeterminado: boolean
}

export default function PreferenciasPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'campo' | 'cultivos' | 'animales' | 'gastos' | 'rodeos'>('campo')
  // Estados de campo
const [nombreCampo, setNombreCampo] = useState('')
const [guardandoCampo, setGuardandoCampo] = useState(false)

  // Estados de cultivos
  const [cultivos, setCultivos] = useState<TipoCultivo[]>([])
  const [loadingCultivos, setLoadingCultivos] = useState(true)
  const [showModalCultivo, setShowModalCultivo] = useState(false)
  const [nuevoCultivo, setNuevoCultivo] = useState('')
  const [savingCultivo, setSavingCultivo] = useState(false)

  // Estados de animales
  const [categorias, setCategorias] = useState<CategoriaAnimal[]>([])
  const [loadingAnimales, setLoadingAnimales] = useState(true)
  const [showModalAnimal, setShowModalAnimal] = useState(false)
  const [nuevoAnimal, setNuevoAnimal] = useState({
    nombreSingular: '',
    nombrePlural: '',
    tipoAnimal: 'BOVINO'
  })
  const [savingAnimal, setSavingAnimal] = useState(false)
  const [categoriasEnUso, setCategoriasEnUso] = useState<Set<string>>(new Set())
  
  // Estados de rodeos
const [modoRodeo, setModoRodeo] = useState<'NO_INCLUIR' | 'OPCIONAL' | 'OBLIGATORIO'>('OPCIONAL')
const [guardandoRodeo, setGuardandoRodeo] = useState(false)

  // Cargar nombre del campo
useEffect(() => {
  fetch('/api/campos')
    .then(r => r.json())
    .then(data => {
      if (data.nombre) {
        setNombreCampo(data.nombre)
      }
    })
    .catch(err => console.error('Error cargando campo:', err))
}, [])
 // Cargar configuración de rodeos
useEffect(() => {
  fetch('/api/configuracion-rodeos')
    .then(r => r.json())
    .then(data => {
      if (data.modoRodeo) {
        setModoRodeo(data.modoRodeo)
      }
    })
    .catch(err => console.error('Error cargando configuración:', err))
}, [])

  // Cargar cultivos al montar
  useEffect(() => {
    if (activeTab === 'cultivos') {
      cargarCultivos()
    }
  }, [activeTab])

  // Cargar animales al montar
  useEffect(() => {
    if (activeTab === 'animales') {
      cargarAnimales()
    }
  }, [activeTab])

  // Cargar categorías en uso
  useEffect(() => {
    if (activeTab === 'animales') {
      // Cargar qué categorías están siendo usadas
      fetch('/api/lotes')
        .then(r => r.json())
        .then(lotes => {
          const enUso = new Set<string>()
          lotes.forEach((lote: any) => {
            lote.animalesLote?.forEach((animal: any) => {
              enUso.add(animal.categoria)
            })
          })
          setCategoriasEnUso(enUso)
        })
        .catch(err => console.error('Error cargando lotes:', err))
    }
  }, [activeTab])

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
      setLoadingCultivos(false)
    }
  }

  async function cargarAnimales() {
    try {
      const response = await fetch('/api/categorias-animal')
      if (response.ok) {
        const data = await response.json()
        setCategorias(data)
      }
    } catch (error) {
      console.error('Error cargando categorías:', error)
    } finally {
      setLoadingAnimales(false)
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
        setShowModalCultivo(false)
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

  async function handleToggleCategoria(id: string, nuevoEstado: boolean) {
    // Buscar la categoría para obtener su nombre
    const categoria = categorias.find(c => c.id === id)
    
    // ❌ Prevenir desmarcado si está en uso
    if (!nuevoEstado && categoria && categoriasEnUso.has(categoria.nombreSingular)) {
      alert('No se puede desactivar esta categoría porque hay animales registrados con ella. Primero transfiera o elimine esos animales.')
      return
    }

    // ✅ ACTUALIZACIÓN OPTIMISTA (instantánea en UI)
    setCategorias(prev => 
      prev.map(cat => cat.id === id ? { ...cat, activo: nuevoEstado } : cat)
    )

    try {
      const response = await fetch('/api/categorias-animal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: nuevoEstado }),
      })

      if (!response.ok) {
        // ❌ Si falla, revertir el cambio
        setCategorias(prev => 
          prev.map(cat => cat.id === id ? { ...cat, activo: !nuevoEstado } : cat)
        )
        const error = await response.json()
        alert(error.error || 'Error al actualizar categoría')
      }
    } catch (error) {
      // ❌ Si hay error de red, revertir
      setCategorias(prev => 
        prev.map(cat => cat.id === id ? { ...cat, activo: !nuevoEstado } : cat)
      )
      alert('Error al actualizar categoría')
    }
  }

  async function handleAgregarAnimal() {
    if (!nuevoAnimal.nombreSingular.trim() || !nuevoAnimal.nombrePlural.trim()) {
      alert('Complete todos los campos')
      return
    }

    setSavingAnimal(true)

    try {
      const response = await fetch('/api/categorias-animal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoAnimal),
      })

      if (response.ok) {
        setNuevoAnimal({ nombreSingular: '', nombrePlural: '', tipoAnimal: 'BOVINO' })
        setShowModalAnimal(false)
        cargarAnimales()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear categoría')
      }
    } catch (error) {
      alert('Error al crear categoría')
    } finally {
      setSavingAnimal(false)
    }
  }

  async function handleEliminarAnimal(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return

    try {
      const response = await fetch(`/api/categorias-animal/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        cargarAnimales()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar categoría')
      }
    } catch (error) {
      alert('Error al eliminar categoría')
    }
  }

  // Agrupar categorías por tipo
  const categoriasPorTipo = {
    BOVINO: categorias.filter(c => c.tipoAnimal === 'BOVINO'),
    OVINO: categorias.filter(c => c.tipoAnimal === 'OVINO'),
    EQUINO: categorias.filter(c => c.tipoAnimal === 'EQUINO'),
    OTRO: categorias.filter(c => c.tipoAnimal === 'OTRO'),
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
    onClick={() => setActiveTab('campo')}
    className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
      activeTab === 'campo'
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    🏡 Campo
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
  onClick={() => setActiveTab('rodeos')}
  className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
    activeTab === 'rodeos'
      ? 'border-blue-500 text-blue-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  🐮 Rodeos
</button>

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
          {/* CONTENIDO TAB CAMPO */}
{activeTab === 'campo' && (
  <div className="p-6">
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Configuración de Campo</h2>
        <p className="text-sm text-gray-500">Actualizá la información básica de tu campo</p>
      </div>
    </div>

    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del campo
          </label>
          <input
            type="text"
            value={nombreCampo}
            onChange={(e) => setNombreCampo(e.target.value)}
            placeholder="Ej: Estancia San Pedro"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <p className="text-xs text-gray-500 mt-1">
            Este nombre aparecerá en tus reportes y documentos
          </p>
        </div>

        <button
          onClick={async () => {
            if (!nombreCampo.trim()) {
              alert('El nombre del campo no puede estar vacío')
              return
            }

            setGuardandoCampo(true)
            try {
              const response = await fetch('/api/campos', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombreCampo.trim() })
              })

              if (response.ok) {
                alert('¡Nombre del campo actualizado!')
              } else {
                alert('Error al actualizar el nombre')
              }
            } catch (error) {
              alert('Error al actualizar el nombre')
            } finally {
              setGuardandoCampo(false)
            }
          }}
          disabled={guardandoCampo}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition shadow-sm"
        >
          {guardandoCampo ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  </div>
)}

          {/* CONTENIDO TAB CULTIVOS */}
          {activeTab === 'cultivos' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tipos de cultivos</h2>
                  <p className="text-sm text-gray-500">Gestiona los tipos de cultivos disponibles</p>
                </div>
                <button
                  onClick={() => setShowModalCultivo(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo Cultivo
                </button>
              </div>

              {loadingCultivos ? (
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
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tipo de animales</h2>
                  <p className="text-sm text-gray-500">Selecciona las categorías que usas en tu campo</p>
                </div>
                <button
                  onClick={() => setShowModalAnimal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva Categoría
                </button>
              </div>

              {loadingAnimales ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando categorías...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* BOVINOS */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Bovinos</h3>
                    <div className="space-y-3">
                      {categoriasPorTipo.BOVINO.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between">
                          <label className={`flex items-center gap-3 ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={cat.activo}
                              onChange={(e) => handleToggleCategoria(cat.id, e.target.checked)}
                              disabled={cat.esPredeterminado && cat.id.startsWith('pred-')}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className={`text-sm ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                              {cat.nombreSingular}
                              {categoriasEnUso.has(cat.nombreSingular) && cat.activo && (
                                <span className="ml-2 text-xs text-blue-600">● En uso</span>
                              )}
                            </span>
                          </label>
                          {!cat.esPredeterminado && (
                            <button
                              onClick={() => handleEliminarAnimal(cat.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OVINOS */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Ovinos</h3>
                    <div className="space-y-3">
                      {categoriasPorTipo.OVINO.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between">
                          <label className={`flex items-center gap-3 ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={cat.activo}
                              onChange={(e) => handleToggleCategoria(cat.id, e.target.checked)}
                              disabled={cat.esPredeterminado && cat.id.startsWith('pred-')}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className={`text-sm ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                              {cat.nombreSingular}
                              {categoriasEnUso.has(cat.nombreSingular) && cat.activo && (
                                <span className="ml-2 text-xs text-blue-600">● En uso</span>
                              )}
                            </span>
                          </label>
                          {!cat.esPredeterminado && (
                            <button
                              onClick={() => handleEliminarAnimal(cat.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* EQUINOS */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Equinos</h3>
                    <div className="space-y-3">
                      {categoriasPorTipo.EQUINO.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between">
                          <label className={`flex items-center gap-3 ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={cat.activo}
                              onChange={(e) => handleToggleCategoria(cat.id, e.target.checked)}
                              disabled={cat.esPredeterminado && cat.id.startsWith('pred-')}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className={`text-sm ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                              {cat.nombreSingular}
                              {categoriasEnUso.has(cat.nombreSingular) && cat.activo && (
                                <span className="ml-2 text-xs text-blue-600">● En uso</span>
                              )}
                            </span>
                          </label>
                          {!cat.esPredeterminado && (
                            <button
                              onClick={() => handleEliminarAnimal(cat.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OTROS (si hay categorías personalizadas tipo OTRO) */}
                  {categoriasPorTipo.OTRO.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Otros</h3>
                      <div className="space-y-3">
                        {categoriasPorTipo.OTRO.map((cat) => (
                          <div key={cat.id} className="flex items-center justify-between">
                            <label className={`flex items-center gap-3 ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={cat.activo}
                                onChange={(e) => handleToggleCategoria(cat.id, e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className={`text-sm ${categoriasEnUso.has(cat.nombreSingular) && cat.activo ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                {cat.nombreSingular}
                                {categoriasEnUso.has(cat.nombreSingular) && cat.activo && (
                                  <span className="ml-2 text-xs text-blue-600">● En uso</span>
                                )}
                              </span>
                            </label>
                            <button
                              onClick={() => handleEliminarAnimal(cat.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO TAB GASTOS */}
{activeTab === 'gastos' && (
  <div className="p-6">
    <GastosPreferencias />
  </div>
)}
 </div>
      </div>
      
{/* CONTENIDO TAB RODEOS */}
{activeTab === 'rodeos' && (
  <div className="p-6">
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Configuración de Rodeos</h2>
        <p className="text-sm text-gray-500">Define cómo se manejan los rodeos en tu campo</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* NO INCLUIR */}
      <button
        onClick={() => setModoRodeo('NO_INCLUIR')}
        className={`p-6 rounded-lg border-2 transition ${
          modoRodeo === 'NO_INCLUIR'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="text-3xl mb-3">⊗</div>
        <h3 className="font-semibold text-gray-900 mb-2">No Incluir</h3>
        <p className="text-sm text-gray-600">No quiero incluir datos de rodeos</p>
      </button>

      {/* OPCIONAL */}
      <button
        onClick={() => setModoRodeo('OPCIONAL')}
        className={`p-6 rounded-lg border-2 transition ${
          modoRodeo === 'OPCIONAL'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="text-3xl mb-3">?</div>
        <h3 className="font-semibold text-gray-900 mb-2">Opcional</h3>
        <p className="text-sm text-gray-600">Usuarios pueden ingresar el rodeo como dato opcional</p>
      </button>

      {/* OBLIGATORIO */}
      <button
        onClick={() => setModoRodeo('OBLIGATORIO')}
        className={`p-6 rounded-lg border-2 transition ${
          modoRodeo === 'OBLIGATORIO'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="text-3xl mb-3">✓</div>
        <h3 className="font-semibold text-blue-600 mb-2">Obligatorio</h3>
        <p className="text-sm text-gray-600">Usuarios tienen que ingresar el rodeo</p>
      </button>
    </div>

    <button
      onClick={async () => {
        setGuardandoRodeo(true)
        try {
          const response = await fetch('/api/configuracion-rodeos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modoRodeo })
          })

          if (response.ok) {
            alert('¡Configuración actualizada!')
          } else {
            alert('Error al actualizar')
          }
        } catch (error) {
          alert('Error al actualizar')
        } finally {
          setGuardandoRodeo(false)
        }
      }}
      disabled={guardandoRodeo}
      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition shadow-sm"
    >
      {guardandoRodeo ? 'Guardando...' : 'Guardar configuración'}
    </button>
  </div>
)}
        
      

      {/* MODAL NUEVO CULTIVO */}
      {showModalCultivo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo Cultivo</h2>
              <button onClick={() => setShowModalCultivo(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
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
                onClick={() => setShowModalCultivo(false)}
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

      {/* MODAL NUEVA CATEGORÍA ANIMAL */}
      {showModalAnimal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Nueva Categoría</h2>
              <button onClick={() => setShowModalAnimal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Singular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nuevoAnimal.nombreSingular}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, nombreSingular: e.target.value })}
                  placeholder="Ej: Torito"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Plural <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nuevoAnimal.nombrePlural}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, nombrePlural: e.target.value })}
                  placeholder="Ej: Toritos"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={nuevoAnimal.tipoAnimal}
                  onChange={(e) => setNuevoAnimal({ ...nuevoAnimal, tipoAnimal: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="BOVINO">Bovinos</option>
                  <option value="OVINO">Ovinos</option>
                  <option value="EQUINO">Equinos</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModalAnimal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarAnimal}
                disabled={savingAnimal || !nuevoAnimal.nombreSingular.trim() || !nuevoAnimal.nombrePlural.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {savingAnimal ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}