'use client'

import { useState, useEffect } from 'react'
import { useDatos } from '@/app/contexts/DatosContext'

// ==================== FUNCIONES AUXILIARES ====================
function obtenerIcono(tipo: string): string {
  const iconos: Record<string, string> = {
    LLUVIA: '🌧️',
    HELADA: '❄️',
    GASTO: '💸',
    INGRESO: '💰',
    VENTA: '🐄',
    COMPRA: '🛒',
    TRASLADO: '🚛',
    CAMBIO_POTRERO: '⊞', //
    NACIMIENTO: '🐣',
    MORTANDAD: '💀',
    CONSUMO: '🍖',
    ABORTO: '❌',
    DESTETE: '🔀',
    TACTO: '✋',
    RECATEGORIZACION: '🏷️',
    TRATAMIENTO: '💉',
    MOVIMIENTO: '🔄',
    USO_INSUMO: '🧪',
    INGRESO_INSUMO: '📦',
    SIEMBRA: '🌱',
    PULVERIZACION: '💦',
    REFERTILIZACION: '🌿',
    RIEGO: '💧',
    MONITOREO: '🔍',
    COSECHA: '🌾',
    OTROS_LABORES: '🔧',
  }
  return iconos[tipo] || '📊'
}

function obtenerColor(tipo: string): string {
  const colores: Record<string, string> = {
    LLUVIA: 'blue',
    HELADA: 'cyan',
    GASTO: 'red',
    INGRESO: 'green',
    VENTA: 'green',
    COMPRA: 'orange',
    TRASLADO: 'indigo',
    CAMBIO_POTRERO: 'amber',
    NACIMIENTO: 'pink',
    MORTANDAD: 'gray',
    CONSUMO: 'brown',
    USO_INSUMO: 'orange',
    INGRESO_INSUMO: 'purple',
    SIEMBRA: 'lime',
    COSECHA: 'yellow',
    TRATAMIENTO: 'pink',
    MOVIMIENTO: 'blue',
  }
  return colores[tipo] || 'gray'
}

// ==================== MODAL FILTRO TIPO DATO ====================
function ModalFiltroTipoDato({
  isOpen,
  onClose,
  selectedTipo,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  selectedTipo: string
  onSelect: (tipo: string) => void
}) {
  if (!isOpen) return null

  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({
    0: true,
  })

  const tiposDeEvento = [
    {
      category: 'Animales',
      items: [
        { value: 'CAMBIO_POTRERO', label: 'Cambio De Potrero', icon: '⊞' },
        { value: 'TRATAMIENTO', label: 'Tratamiento', icon: '💉' },
        { value: 'VENTA', label: 'Venta', icon: '💵' },
        { value: 'COMPRA', label: 'Compra', icon: '🛒' },
        { value: 'TRASLADO', label: 'Traslado', icon: '🚚' },
        { value: 'NACIMIENTO', label: 'Nacimiento', icon: '🐣' },
        { value: 'MORTANDAD', label: 'Mortandad', icon: '💀' },
        { value: 'CONSUMO', label: 'Consumo', icon: '🌾' },
        { value: 'ABORTO', label: 'Aborto', icon: '⊗' },
        { value: 'DESTETE', label: 'Destete', icon: '🥛' },
        { value: 'TACTO', label: 'Tacto', icon: '✋' },
        { value: 'RECATEGORIZACION', label: 'Recategorización', icon: '🏷️' },
      ],
    },
    {
      category: 'Agricultura',
      items: [
        { value: 'SIEMBRA', label: 'Siembra', icon: '🚜' },
        { value: 'PULVERIZACION', label: 'Pulverización', icon: '🧴' },
        { value: 'REFERTILIZACION', label: 'Refertilización', icon: '🌱' },
        { value: 'RIEGO', label: 'Riego', icon: '💧' },
        { value: 'MONITOREO', label: 'Monitoreo', icon: '🔍' },
        { value: 'COSECHA', label: 'Cosecha', icon: '🌾' },
        { value: 'OTROS_LABORES', label: 'Otros Labores', icon: '🔧' },
      ],
    },
    {
      category: 'Clima',
      items: [
        { value: 'LLUVIA', label: 'Lluvia', icon: '🌧️' },
        { value: 'HELADA', label: 'Helada', icon: '❄️' },
      ],
    },
    {
      category: 'Insumos',
      items: [
        { value: 'USO_INSUMO', label: 'Uso de Insumos', icon: '📦' },
        { value: 'INGRESO_INSUMO', label: 'Ingreso de Insumos', icon: '📥' },
      ],
    },
    {
      category: 'Finanzas',
      items: [
        { value: 'GASTO', label: 'Gasto', icon: '💰' },
        { value: 'INGRESO', label: 'Ingreso', icon: '👤' },
      ],
    },
  ]

  const handleSelect = (tipo: string) => {
    onSelect(tipo)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Filtrar por Tipo de Dato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => handleSelect('todos')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border-2 transition ${
              selectedTipo === 'todos' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              selectedTipo === 'todos' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
            }`}>
              {selectedTipo === 'todos' && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="font-medium text-gray-900">Seleccionar Todo</span>
          </button>

          <div className="space-y-2">
            {tiposDeEvento.map((section, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenCategories((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <span className="font-medium text-gray-900">{section.category}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${openCategories[idx] ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openCategories[idx] && (
                  <div className="p-2 space-y-1 bg-white">
                    {section.items.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => handleSelect(item.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                          selectedTipo === item.value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedTipo === item.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}>
                          {selectedTipo === item.value && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => {
              onSelect('todos')
              onClose()
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            Limpiar
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== MODAL FILTRO FECHA ====================
function ModalFiltroFecha({
  isOpen,
  onClose,
  fechaDesde,
  fechaHasta,
  onApply,
}: {
  isOpen: boolean
  onClose: () => void
  fechaDesde: Date | null
  fechaHasta: Date | null
  onApply: (desde: Date | null, hasta: Date | null) => void
}) {
  const [desde, setDesde] = useState<string>(
    fechaDesde ? new Date(fechaDesde.getTime() - fechaDesde.getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''
  )
  const [hasta, setHasta] = useState<string>(
    fechaHasta ? new Date(fechaHasta.getTime() - fechaHasta.getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''
  )

  if (!isOpen) return null

  const handleApply = () => {
    const desdeDate = desde ? new Date(desde + 'T00:00:00') : null
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null
    onApply(desdeDate, hastaDate)
    onClose()
  }

  const setRangoRapido = (dias: number) => {
    const hoy = new Date()
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - dias)
    
    setDesde(new Date(inicio.getTime() - inicio.getTimezoneOffset() * 60000).toISOString().split('T')[0])
    setHasta(new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0])
  }

  const setHoy = () => {
    const hoy = new Date()
    const hoyStr = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    setDesde(hoyStr)
    setHasta(hoyStr)
  }

  const setEstaSemana = () => {
    const hoy = new Date()
    const diaSemana = hoy.getDay()
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - diaSemana)
    
    setDesde(new Date(inicio.getTime() - inicio.getTimezoneOffset() * 60000).toISOString().split('T')[0])
    setHasta(new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0])
  }

  const setEsteMes = () => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    
    setDesde(new Date(inicio.getTime() - inicio.getTimezoneOffset() * 60000).toISOString().split('T')[0])
    setHasta(new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0])
  }

  const setEsteAno = () => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), 0, 1)
    
    setDesde(new Date(inicio.getTime() - inicio.getTimezoneOffset() * 60000).toISOString().split('T')[0])
    setHasta(new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0])
  }

  const setEjercicioActual = () => {
    const hoy = new Date()
    const anioActual = hoy.getFullYear()
    const mesActual = hoy.getMonth()
    
    const anioInicio = mesActual < 6 ? anioActual - 1 : anioActual
    const anioFin = anioInicio + 1
    
    const inicio = new Date(anioInicio, 6, 1)
    const fin = new Date(anioFin, 5, 30)
    
    setDesde(new Date(inicio.getTime() - inicio.getTimezoneOffset() * 60000).toISOString().split('T')[0])
    setHasta(new Date(fin.getTime() - fin.getTimezoneOffset() * 60000).toISOString().split('T')[0])
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Filtrar por Fecha</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Rangos rápidos</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={setHoy}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Hoy
              </button>
              <button
                onClick={setEstaSemana}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Esta Semana
              </button>
              <button
                onClick={setEsteMes}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Este Mes
              </button>
              <button
                onClick={() => setRangoRapido(7)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Últimos 7 Días
              </button>
              <button
                onClick={() => setRangoRapido(30)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Últimos 30 Días
              </button>
              <button
                onClick={() => setRangoRapido(90)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Últimos 90 Días
              </button>
              <button
                onClick={setEsteAno}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
              >
                Este Año
              </button>
              <button
                onClick={setEjercicioActual}
                className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 font-medium transition col-span-2"
              >
                📊 Ejercicio Actual
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => {
              setDesde('')
              setHasta('')
              onApply(null, null)
              onClose()
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            Limpiar
          </button>
          <button onClick={handleApply} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== MODAL FILTRO MÚLTIPLE ====================
function ModalFiltroMultiple({
  isOpen,
  onClose,
  title,
  icon,
  items,
  selectedItems,
  onApply,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  icon: string
  items: string[]
  selectedItems: string[]
  onApply: (items: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(selectedItems)

  if (!isOpen) return null

  const toggleItem = (item: string) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item))
    } else {
      setSelected([...selected, item])
    }
  }

  const handleApply = () => {
    onApply(selected)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span>{icon}</span> {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => setSelected(selected.length === items.length ? [] : [...items])}
            className="w-full flex items-center gap-3 px-4 py-3 mb-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                selected.length === items.length ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}
            >
              {selected.length === items.length && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="font-medium text-gray-900">Seleccionar Todo</span>
          </button>

          <div className="space-y-1">
            {items.map((item) => (
              <button
                key={item}
                onClick={() => toggleItem(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  selected.includes(item) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selected.includes(item) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}
                >
                  {selected.includes(item) && <span className="text-white text-xs">✓</span>}
                </div>
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => {
              setSelected([])
              onApply([])
              onClose()
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            Limpiar
          </button>
          <button onClick={handleApply} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Aplicar ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== CHIPS DE FILTROS ACTIVOS ====================
function FiltrosActivos() {
  const { filtros, setFiltros } = useDatos()

  const obtenerNombreTipo = (tipo: string) => {
    const nombres: Record<string, string> = {
      CAMBIO_POTRERO: 'Cambio De Potrero',
      TRATAMIENTO: 'Tratamiento',
      VENTA: 'Venta',
      COMPRA: 'Compra',
      TRASLADO: 'Traslado',
      NACIMIENTO: 'Nacimiento',
      MORTANDAD: 'Mortandad',
      CONSUMO: 'Consumo',
      ABORTO: 'Aborto',
      DESTETE: 'Destete',
      TACTO: 'Tacto',
      RECATEGORIZACION: 'Recategorización',
      SIEMBRA: 'Siembra',
      PULVERIZACION: 'Pulverización',
      REFERTILIZACION: 'Refertilización',
      RIEGO: 'Riego',
      MONITOREO: 'Monitoreo',
      COSECHA: 'Cosecha',
      OTROS_LABORES: 'Otros Labores',
      LLUVIA: 'Lluvia',
      HELADA: 'Helada',
      USO_INSUMO: 'Uso de Insumos',
      INGRESO_INSUMO: 'Ingreso de Insumos',
      GASTO: 'Gasto',
      INGRESO: 'Ingreso',
    }
    return nombres[tipo] || tipo
  }

  const filtrosActivos = []

  if (filtros.tipoDato !== 'todos') {
    filtrosActivos.push({
      key: 'tipoDato',
      label: obtenerNombreTipo(filtros.tipoDato),
      onRemove: () => setFiltros({ ...filtros, tipoDato: 'todos' }),
    })
  }

  if (filtros.fechaDesde || filtros.fechaHasta) {
    const desde = filtros.fechaDesde ? new Date(filtros.fechaDesde).toLocaleDateString('es-UY') : '...'
    const hasta = filtros.fechaHasta ? new Date(filtros.fechaHasta).toLocaleDateString('es-UY') : '...'
    filtrosActivos.push({
      key: 'fecha',
      label: `📅 ${desde} - ${hasta}`,
      onRemove: () => setFiltros({ ...filtros, fechaDesde: null, fechaHasta: null }),
    })
  }

  if (filtros.usuarios.length > 0) {
    filtrosActivos.push({
      key: 'usuarios',
      label: `👤 ${filtros.usuarios.length} usuario${filtros.usuarios.length > 1 ? 's' : ''}`,
      onRemove: () => setFiltros({ ...filtros, usuarios: [] }),
    })
  }

  if (filtros.potreros.length > 0) {
    filtrosActivos.push({
      key: 'potreros',
      label: `📍 ${filtros.potreros.length} potrero${filtros.potreros.length > 1 ? 's' : ''}`,
      onRemove: () => setFiltros({ ...filtros, potreros: [] }),
    })
  }

  if (filtrosActivos.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {filtrosActivos.map((filtro) => (
        <div key={filtro.key} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          <span>{filtro.label}</span>
          <button onClick={filtro.onRemove} className="hover:bg-blue-200 rounded-full p-0.5 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          setFiltros({
            categoria: 'todos',
            tipoDato: 'todos',
            fechaDesde: null,
            fechaHasta: null,
            busqueda: '',
            usuarios: [],
            potreros: [],
            animales: [],
            cultivos: [],
          })
        }
        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        Limpiar todos
      </button>
    </div>
  )
}

// ==================== FILTROS ====================
function FiltrosDatos() {
  const { filtros, setFiltros, datos } = useDatos()
  const [showMenuFiltros, setShowMenuFiltros] = useState(false)
  const [showModalTipo, setShowModalTipo] = useState(false)
  const [showModalFecha, setShowModalFecha] = useState(false)
  const [showModalUsuarios, setShowModalUsuarios] = useState(false)
  const [showModalPotreros, setShowModalPotreros] = useState(false)
  const [showBusqueda, setShowBusqueda] = useState(false)
  const [todosLosPotreros, setTodosLosPotreros] = useState<string[]>([])

  // Cargar potreros desde la API
  useEffect(() => {
    fetch('/api/lotes')
      .then(r => r.json())
      .then(lotes => setTodosLosPotreros(lotes.map((l: any) => l.nombre)))
      .catch(err => console.error('Error cargando potreros:', err))
  }, [])

  // Obtener datos únicos
  const usuariosDisponibles = Array.from(new Set(datos.map((d) => d.usuario).filter(Boolean))) as string[]
  const potrerosDisponibles = todosLosPotreros.length > 0 
    ? todosLosPotreros 
    : Array.from(new Set(datos.map((d) => d.lote).filter(Boolean))) as string[]

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <button
              onClick={() => setShowMenuFiltros(!showMenuFiltros)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filtros
            </button>

            {showMenuFiltros && (
              <>
                <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setShowMenuFiltros(false)} />
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 overflow-hidden">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowMenuFiltros(false)
                        setShowModalFecha(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">Fecha</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMenuFiltros(false)
                        setShowModalTipo(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                      </svg>
                      <span className="font-medium">Tipos de Datos</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMenuFiltros(false)
                        setShowModalUsuarios(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">Usuarios</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMenuFiltros(false)
                        setShowModalPotreros(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      <span className="font-medium">Potreros</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowBusqueda(!showBusqueda)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar Dato
          </button>

          {showBusqueda && (
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Buscar en descripción, proveedor, comprador..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filtros.busqueda}
                onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <FiltrosActivos />

      <ModalFiltroTipoDato
        isOpen={showModalTipo}
        onClose={() => setShowModalTipo(false)}
        selectedTipo={filtros.tipoDato}
        onSelect={(tipo) => setFiltros({ ...filtros, tipoDato: tipo })}
      />

      <ModalFiltroFecha
        isOpen={showModalFecha}
        onClose={() => setShowModalFecha(false)}
        fechaDesde={filtros.fechaDesde}
        fechaHasta={filtros.fechaHasta}
        onApply={(desde, hasta) => setFiltros({ ...filtros, fechaDesde: desde, fechaHasta: hasta })}
      />

      <ModalFiltroMultiple
        isOpen={showModalUsuarios}
        onClose={() => setShowModalUsuarios(false)}
        title="Usuarios"
        icon="👤"
        items={usuariosDisponibles}
        selectedItems={filtros.usuarios}
        onApply={(usuarios) => setFiltros({ ...filtros, usuarios })}
      />

      <ModalFiltroMultiple
        isOpen={showModalPotreros}
        onClose={() => setShowModalPotreros(false)}
        title="Potreros"
        icon="📍"
        items={potrerosDisponibles}
        selectedItems={filtros.potreros}
        onApply={(potreros) => setFiltros({ ...filtros, potreros })}
      />
    </>
  )
}

// ==================== TARJETA ====================
function TarjetaDato({ dato }: { dato: any }) {
  const formatFecha = (fecha: Date) => {
    return new Date(fecha).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const colorClasses: Record<string, string> = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    gray: 'bg-gray-500',
    cyan: 'bg-cyan-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    lime: 'bg-lime-500',
    brown: 'bg-orange-800',
  }

  const renderDetalles = () => {
    const detalles = []

    if (dato.monto !== undefined && dato.monto !== null && dato.monto !== 0) {
      const esIngreso = dato.tipo === 'INGRESO' || dato.tipo === 'VENTA'

      detalles.push(
        <span
          key="monto"
          className={`${esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-3 py-1 rounded-full text-sm font-semibold`}
        >
          💵 {esIngreso ? '+' : '-'}${Math.abs(Number(dato.monto)).toLocaleString('es-UY')}
        </span>
      )
    }

    if (dato.cantidad && !['INGRESO', 'GASTO'].includes(dato.tipo)) {
      const texto = dato.tipo === 'VENTA' ? `${dato.cantidad} vendidos` : dato.tipo === 'COMPRA' ? `${dato.cantidad} comprados` : `${dato.cantidad} ${dato.unidad || ''}`

      detalles.push(
        <span key="cantidad" className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
          📊 {texto}
        </span>
      )
    }

    if (dato.proveedor) {
      detalles.push(
        <span key="proveedor" className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
          🏪 {dato.proveedor}
        </span>
      )
    }

    if (dato.comprador) {
      detalles.push(
        <span key="comprador" className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
          🤝 {dato.comprador}
        </span>
      )
    }

    if (dato.metodoPago) {
      const esIngreso = dato.tipo === 'INGRESO' || dato.tipo === 'VENTA'
      detalles.push(
        <span key="metodo" className={`${esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-3 py-1 rounded-full text-sm`}>
          💳 {dato.metodoPago}
          {dato.diasPlazo && dato.diasPlazo > 0 && ` (${dato.diasPlazo} días)`}
        </span>
      )
    }

    if (dato.metodoPago && dato.pagado !== undefined) {
      detalles.push(
        <span key="pagado" className={`${dato.pagado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} px-3 py-1 rounded-full text-sm`}>
          {dato.pagado ? '✅ Pagado' : '⏳ Pendiente'}
        </span>
      )
    }

    if (dato.insumo) {
      detalles.push(
        <span key="insumo" className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
          📦 {dato.insumo}
        </span>
      )
    }

    if (dato.iva && dato.iva !== 0) {
      detalles.push(
        <span key="iva" className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
          💹 IVA: ${Number(dato.iva).toLocaleString('es-UY')}
        </span>
      )
    }

    return detalles
  }

  const obtenerNombreTipo = (tipo: string) => {
    const nombres: Record<string, string> = {
      INGRESO: 'Ingreso de Dinero',
      INGRESO_INSUMO: 'Ingreso de Insumo',
      USO_INSUMO: 'Uso de Insumo',
      GASTO: 'Gasto',
      VENTA: 'Venta',
      COMPRA: 'Compra',
      CAMBIO_POTRERO: 'Cambio De Potrero',
      TRASLADO: 'Traslado',
      NACIMIENTO: 'Nacimiento',
      MORTANDAD: 'Mortandad',
      CONSUMO: 'Consumo',
      ABORTO: 'Aborto',
      DESTETE: 'Destete',
      TACTO: 'Tacto',
      RECATEGORIZACION: 'Recategorización',
      TRATAMIENTO: 'Tratamiento',
      MOVIMIENTO: 'Movimiento',
      SIEMBRA: 'Siembra',
      PULVERIZACION: 'Pulverización',
      REFERTILIZACION: 'Refertilización',
      RIEGO: 'Riego',
      MONITOREO: 'Monitoreo',
      COSECHA: 'Cosecha',
      OTROS_LABORES: 'Otras Labores',
      LLUVIA: 'Lluvia',
      HELADA: 'Helada',
    }
    return nombres[tipo] || tipo.replace(/_/g, ' ')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100">
      <div className="flex items-start gap-4">
        <div className={`${colorClasses[obtenerColor(dato.tipo)] || 'bg-gray-500'} w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0`}>
          {obtenerIcono(dato.tipo)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">{obtenerNombreTipo(dato.tipo)}</h3>
              <span className="text-xs text-gray-500">{formatFecha(dato.fecha)}</span>
            </div>
          </div>

          {dato.descripcion && <p className="text-gray-700 text-sm mb-3">{dato.descripcion}</p>}

          <div className="flex flex-wrap gap-2 mb-2">{renderDetalles()}</div>

          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {dato.usuario && <span className="bg-gray-100 px-2 py-1 rounded">👤 {dato.usuario}</span>}
            {dato.lote && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">📍 {dato.lote}</span>}
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded capitalize">{dato.categoria}</span>
          </div>

          {dato.notas && <p className="text-xs text-gray-500 mt-2 italic">📝 {dato.notas}</p>}
        </div>
      </div>
    </div>
  )
}

// ==================== LISTA ====================
function ListaDatos() {
  const { datos, loading, error } = useDatos()

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4 mx-auto"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    )

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error al cargar los datos</p>
        <p className="text-sm">{error}</p>
      </div>
    )

  if (datos.length === 0)
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay datos que coincidan con los filtros</h3>
        <p className="text-gray-500">Intenta ajustar los filtros para ver más resultados</p>
      </div>
    )

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {datos.length} {datos.length === 1 ? 'registro' : 'registros'}
        </h2>
      </div>

      {datos.map((dato) => (
        <TarjetaDato key={dato.id} dato={dato} />
      ))}
    </div>
  )
}

// ==================== PÁGINA PRINCIPAL ====================
export default function PaginaDatos() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Datos del Campo</h1>
        <p className="text-gray-600">Visualiza todos los eventos, movimientos y registros de tu campo</p>
      </div>

      <FiltrosDatos />
      <ListaDatos />
    </div>
  )
}