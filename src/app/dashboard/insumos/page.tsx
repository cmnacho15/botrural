'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useInsumos } from '@/app/contexts/InsumosContext'
import { useSearchParams } from 'next/navigation'
import ModalIngresoInsumos from '@/app/components/modales/ModalIngresoInsumos'
import ModalUsoInsumos from '@/app/components/modales/ModalUsoInsumos'

type Lote = {
  id: string
  nombre: string
}

function InsumosContent() {
  const { insumos, isLoading, refreshInsumos, addInsumo, registrarMovimiento, updateInsumosOrder } = useInsumos()
  const searchParams = useSearchParams()
  
  const [activeTab, setActiveTab] = useState<'consumo' | 'inventario'>('consumo')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalIngresoOpen, setModalIngresoOpen] = useState(false)
  const [modalUsoOpen, setModalUsoOpen] = useState(false)
  const [selectedInsumo, setSelectedInsumo] = useState<any>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [selectedUnit, setSelectedUnit] = useState('')
  const [showUnits, setShowUnits] = useState(false)
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showInsumoSelector, setShowInsumoSelector] = useState(false)

  // Estados para reordenamiento
  const [isReordering, setIsReordering] = useState(false)
  const [reorderedInsumos, setReorderedInsumos] = useState<any[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loteId, setLoteId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas] = useState('')

  const unidades = [
    'Mililitros', 'Frascos', 'Rollos', 'Cajas', 'Bolsas', 'Dosis',
    'Centímetros', 'Metros', 'Unidades', 'Litros', 'Toneladas', 'Gramos', 'Kilos',
  ]

  // Inicializar orden cuando cambian los insumos
  useEffect(() => {
    if (insumos.length > 0 && !isReordering) {
      setReorderedInsumos([...insumos])
    }
  }, [insumos, isReordering])

  // Detectar parámetros de URL para abrir modales
  useEffect(() => {
    const modal = searchParams.get('modal')
    if (modal === 'uso-insumos' && insumos.length > 0) {
      setShowInsumoSelector(true)
      setActiveTab('consumo')
    } else if (modal === 'ingreso-insumos' && insumos.length > 0) {
      setShowInsumoSelector(true)
      setActiveTab('inventario')
    }
  }, [searchParams, insumos])

  const handleAgregarInsumo = async () => {
    if (!nuevoInsumoNombre || !selectedUnit) return
    setLoading(true)
    const success = await addInsumo(nuevoInsumoNombre, selectedUnit)
    setLoading(false)
    if (success) {
      setModalOpen(false)
      setNuevoInsumoNombre('')
      setSelectedUnit('')
    }
  }

  const handleRegistrarMovimiento = async (tipo: 'INGRESO' | 'USO') => {
    if (!selectedInsumo || !cantidad) return
    setLoading(true)
    const success = await registrarMovimiento(
      selectedInsumo.id,
      tipo,
      cantidad,
      fecha,
      notas,
      loteId
    )
    setLoading(false)

    if (success) {
      setModalIngresoOpen(false)
      setModalUsoOpen(false)
      setShowInsumoSelector(false)
      setCantidad('')
      setNotas('')
      setLoteId('')
      setFecha(new Date().toISOString().split('T')[0])
      window.history.replaceState({}, '', '/dashboard/insumos')
    }
  }

  const handleOpenIngreso = (insumo: any) => {
    setSelectedInsumo(insumo)
    setShowInsumoSelector(false)
    setModalIngresoOpen(true)
  }

  const handleOpenUso = (insumo: any) => {
    setSelectedInsumo(insumo)
    setShowInsumoSelector(false)
    setModalUsoOpen(true)
  }

  // Funciones de reordenamiento
  const handleStartReorder = () => {
    setIsReordering(true)
    setReorderedInsumos([...insumos])
  }

  const handleCancelReorder = () => {
    setIsReordering(false)
    setReorderedInsumos([...insumos])
    setDraggedIndex(null)
  }

  const handleConfirmReorder = async () => {
    setLoading(true)
    try {
      const orderedIds = reorderedInsumos.map(i => i.id)
      const success = await updateInsumosOrder(orderedIds)
      
      if (success) {
        setIsReordering(false)
        setDraggedIndex(null)
      } else {
        alert('Error al guardar el orden. Por favor intentá de nuevo.')
      }
    } catch (error) {
      console.error('Error al guardar el orden:', error)
      alert('Error al guardar el orden. Por favor intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === index) return

    const newInsumos = [...reorderedInsumos]
    const draggedItem = newInsumos[draggedIndex]
    
    newInsumos.splice(draggedIndex, 1)
    newInsumos.splice(index, 0, draggedItem)
    
    setReorderedInsumos(newInsumos)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    // No resetear draggedIndex aquí para mantener el estado visual
  }

  const calcularConsumoTotal = (insumo: any) => {
    if (!insumo.movimientos || insumo.movimientos.length === 0) return 0
    return insumo.movimientos
      .filter((m: any) => m.tipo === 'USO')
      .reduce((sum: number, m: any) => sum + m.cantidad, 0)
  }

  const calcularConsumoUltimos30Dias = (insumo: any) => {
    if (!insumo.movimientos || insumo.movimientos.length === 0) return 0
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    return insumo.movimientos
      .filter((m: any) => m.tipo === 'USO' && new Date(m.fecha) >= hace30Dias)
      .reduce((sum: number, m: any) => sum + m.cantidad, 0)
  }

  const displayInsumos = isReordering ? reorderedInsumos : insumos

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs y acciones */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          
          {/* Tabs */}
          <div className="flex gap-4 justify-center sm:justify-start">
  <button
    onClick={() => setActiveTab('inventario')}
    disabled={isReordering}
    className={`flex items-center gap-1 pb-2 border-b-2 transition-colors ${
      activeTab === 'inventario'
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    } ${isReordering ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    🏪 <span className="text-sm font-medium">Inventario</span>
  </button>
  <button
    onClick={() => setActiveTab('consumo')}
    disabled={isReordering}
    className={`flex items-center gap-1 pb-2 border-b-2 transition-colors ${
      activeTab === 'consumo'
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    } ${isReordering ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    📋 <span className="text-sm font-medium">Consumo</span>
  </button>
</div>

          {/* Botones de acción */}
          <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            {isReordering ? (
              <>
                <button
                  onClick={handleCancelReorder}
                  disabled={loading}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-xs sm:text-sm disabled:opacity-50"
                >
                  ✕ <span>Cancelar</span>
                </button>
                <button
                  onClick={handleConfirmReorder}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 text-xs sm:text-sm disabled:opacity-50"
                >
                  {loading ? '⏳' : '✓'} <span>{loading ? 'Guardando...' : 'Confirmar Orden'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartReorder}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-xs sm:text-sm"
                >
                  ⊞ <span>Reordenar</span>
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-xs sm:text-sm"
                >
                  ➕ <span>Monitorear insumo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Instrucciones de reordenamiento */}
      {isReordering && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-3">
          <p className="text-sm text-blue-800 text-center">
            🔄 Arrastrá las tarjetas para cambiar su orden. Presioná "Confirmar Orden" para guardar.
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Cargando insumos...</p>
            </div>
          </div>
        ) : displayInsumos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay insumos todavía</h3>
            <p className="text-gray-500 mb-6">Creá tu primer insumo para empezar</p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <span>➕</span>
              <span>Crear Primer Insumo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayInsumos.map((insumo, idx) => (
              <div
                key={insumo.id}
                draggable={isReordering}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all relative group ${
                  isReordering 
                    ? 'cursor-move hover:shadow-lg hover:scale-105 border-2 border-blue-300' 
                    : 'hover:shadow-md cursor-pointer'
                } ${draggedIndex === idx ? 'opacity-50' : 'opacity-100'}`}
                onMouseEnter={() => !isReordering && setHoveredCard(idx)}
                onMouseLeave={() => !isReordering && setHoveredCard(null)}
              >
                {/* Número de orden en modo reordenamiento */}
                {isReordering && (
                  <div className="absolute top-2 left-2 z-20 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                    {idx + 1}
                  </div>
                )}

                {/* Cabecera visual */}
                <div className="relative h-32 sm:h-36 overflow-hidden">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br from-amber-100 via-green-50 to-blue-50 transition-all ${
                      hoveredCard === idx && !isReordering ? 'scale-110' : 'scale-100'
                    } ${
                      (!insumo.movimientos || insumo.movimientos.length === 0) && activeTab === 'inventario'
                        ? 'grayscale opacity-50'
                        : ''
                    }`}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl sm:text-5xl opacity-30">🌾</span>
                    </div>
                  </div>

                  {/* Botones por hover (escritorio) - ocultos en modo reordenamiento */}
                  {!isReordering && (
                    <div className={`absolute inset-0 hidden sm:flex flex-col transition-all ${hoveredCard === idx ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100`}>
                      <button
                        onClick={() => handleOpenIngreso(insumo)}
                        className="flex-1 bg-green-500/95 hover:bg-green-600 text-white font-medium text-xs flex items-center justify-center transition-colors"
                      >
                        Registrar Ingreso
                      </button>
                      {(activeTab === 'consumo' || insumo.stock > 0) && (
                        <button
                          onClick={() => handleOpenUso(insumo)}
                          className="flex-1 bg-blue-500/95 hover:bg-blue-600 text-white font-medium text-xs flex items-center justify-center transition-colors"
                        >
                          Registrar Uso
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="text-[11px] sm:text-xs font-medium text-gray-500 mb-1">{insumo.nombre}</h3>

                  {activeTab === 'consumo' ? (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                        {calcularConsumoTotal(insumo)} {insumo.unidad}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 mb-2 italic">
                        {calcularConsumoUltimos30Dias(insumo)} (últimos 30 días)
                      </p>
                    </>
                  ) : (
                    <>
                      {insumo.stock > 0 ? (
                        <>
                          <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                            {insumo.stock} {insumo.unidad}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-gray-400 mb-2 italic">Stock disponible</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 mb-2">
                          Ingresa los valores iniciales para mantener un registro.
                        </p>
                      )}
                    </>
                  )}

                  {/* Acciones visibles en móvil - ocultas en modo reordenamiento */}
                  {!isReordering && (
                    <div className="flex gap-2 sm:hidden mb-2">
                      <button
                        onClick={() => handleOpenIngreso(insumo)}
                        className="flex-1 px-2 py-1 text-[11px] rounded-md bg-green-100 text-green-700"
                      >
                        Ingreso
                      </button>
                      {(activeTab === 'consumo' || insumo.stock > 0) && (
                        <button
                          onClick={() => handleOpenUso(insumo)}
                          className="flex-1 px-2 py-1 text-[11px] rounded-md bg-blue-100 text-blue-700"
                        >
                          Uso
                        </button>
                      )}
                    </div>
                  )}

                  {!isReordering && (
                    <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">Ver Más</button>
                  )}
                </div>
              </div>
            ))}

            {/* Card para agregar - oculta en modo reordenamiento */}
            {!isReordering && (
              <button
                onClick={() => setModalOpen(true)}
                className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center p-4 sm:p-6 min-h-[180px] sm:min-h-[240px] group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition-colors">
                  <span className="text-xl sm:text-2xl text-gray-400 group-hover:text-blue-500">➕</span>
                </div>
                <p className="text-gray-700 text-xs sm:text-sm font-medium text-center">Monitorear otro insumo</p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modales - sin cambios */}
      {showInsumoSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Seleccioná un insumo</h2>
              <button
                onClick={() => {
                  setShowInsumoSelector(false)
                  window.history.replaceState({}, '', '/dashboard/insumos')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {insumos.map((insumo) => (
                <button
                  key={insumo.id}
                  onClick={() => {
                    const modal = searchParams.get('modal')
                    if (modal === 'uso-insumos') {
                      handleOpenUso(insumo)
                    } else if (modal === 'ingreso-insumos') {
                      handleOpenIngreso(insumo)
                    }
                  }}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-amber-100 via-green-50 to-blue-50 flex items-center justify-center">
                      <span className="text-xl sm:text-2xl">🌾</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{insumo.nombre}</p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {insumo.stock} {insumo.unidad}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Monitorear otro insumo</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Nombre</label>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={nuevoInsumoNombre}
                  onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-900 mb-2">Unidad</label>
                <button
                  type="button"
                  onClick={() => setShowUnits(!showUnits)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between"
                >
                  <span className={selectedUnit ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedUnit || 'Unidad'}
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>

                {showUnits && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                    {unidades.map((unidad) => (
                      <button
                        key={unidad}
                        onClick={() => {
                          setSelectedUnit(unidad)
                          setShowUnits(false)
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 text-gray-700 text-sm"
                      >
                        {unidad}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleAgregarInsumo}
                disabled={!nuevoInsumoNombre || !selectedUnit || loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalIngresoOpen && selectedInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <ModalIngresoInsumos
              onClose={() => {
                setModalIngresoOpen(false)
                window.history.replaceState({}, '', '/dashboard/insumos')
              }}
              onSuccess={() => {
                refreshInsumos()
                setModalIngresoOpen(false)
                window.history.replaceState({}, '', '/dashboard/insumos')
              }}
              insumoPreseleccionadoId={selectedInsumo.id}
            />
          </div>
        </div>
      )}

      {modalUsoOpen && selectedInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <ModalUsoInsumos
              onClose={() => {
                setModalUsoOpen(false)
                window.history.replaceState({}, '', '/dashboard/insumos')
              }}
              onSuccess={() => {
                refreshInsumos()
                setModalUsoOpen(false)
                window.history.replaceState({}, '', '/dashboard/insumos')
              }}
              insumoPreseleccionadoId={selectedInsumo.id}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function InsumosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando insumos...</p>
        </div>
      </div>
    }>
      <InsumosContent />
    </Suspense>
  )
}