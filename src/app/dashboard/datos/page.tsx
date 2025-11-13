'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ==================== TIPOS ====================
type DatoUnificado = {
  id: string
  fecha: Date
  createdAt?: Date
  tipo: string
  categoria: string
  descripcion: string
  icono: string
  usuario?: string | null
  lote?: string | null
  cantidad?: number | null
  monto?: number | null
  proveedor?: string | null
  comprador?: string | null
  metodoPago?: string | null
  iva?: number | null
  diasPlazo?: number | null
  pagado?: boolean | null
  insumo?: string | null
  unidad?: string | null
  notas?: string | null
}

type DatosContextType = {
  datos: DatoUnificado[]
  loading: boolean
  error: string | null
  filtros: {
    categoria: string
    tipoDato: string // ← NUEVO
    fechaDesde: Date | null
    fechaHasta: Date | null
    busqueda: string
  }
  setFiltros: (filtros: any) => void
  refetch: () => Promise<void>
}

const DatosContext = createContext<DatosContextType | undefined>(undefined)

// ==================== PROVIDER ====================
export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatoUnificado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState({
    categoria: 'todos',
    tipoDato: 'todos', // ← NUEVO
    fechaDesde: null as Date | null,
    fechaHasta: null as Date | null,
    busqueda: '',
  })

  const fetchDatos = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filtros.categoria !== 'todos') params.append('categoria', filtros.categoria)
      if (filtros.tipoDato !== 'todos') params.append('tipo', filtros.tipoDato) // ← NUEVO
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde.toISOString())
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta.toISOString())
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda)

      const response = await fetch(`/api/datos?${params}`)
      if (!response.ok) throw new Error('Error al cargar datos')

      const data = await response.json()
      setDatos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatos()
  }, [filtros])

  return (
    <DatosContext.Provider
      value={{
        datos,
        loading,
        error,
        filtros,
        setFiltros,
        refetch: fetchDatos,
      }}
    >
      {children}
    </DatosContext.Provider>
  )
}

export function useDatos() {
  const context = useContext(DatosContext)
  if (!context) throw new Error('useDatos debe usarse dentro de DatosProvider')
  return context
}

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

  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({})

  const tiposDeEvento = [
    {
      category: 'Animales',
      items: [
        { value: 'MOVIMIENTO', label: 'Cambio De Potrero', icon: '⊞' },
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
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Filtrar por Tipo de Dato</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Opción "Seleccionar Todo" */}
          <button
            onClick={() => handleSelect('todos')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border-2 transition ${
              selectedTipo === 'todos'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              selectedTipo === 'todos' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
            }`}>
              {selectedTipo === 'todos' && <span className="text-white text-xs">✓</span>}
            </div>
            <span className="font-medium text-gray-900">Seleccionar Todo</span>
          </button>

          {/* Categorías colapsables */}
          <div className="space-y-2">
            {tiposDeEvento.map((section, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setOpenCategories((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <span className="font-medium text-gray-900">{section.category}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      openCategories[idx] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {openCategories[idx] && (
                  <div className="p-2 space-y-1 bg-white">
                    {section.items.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => handleSelect(item.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                          selectedTipo === item.value
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedTipo === item.value
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedTipo === item.value && (
                            <span className="text-white text-xs">✓</span>
                          )}
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

        {/* Footer */}
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
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== FILTROS ====================
function FiltrosDatos() {
  const { filtros, setFiltros } = useDatos()
  const [showModalTipo, setShowModalTipo] = useState(false)

  const categorias = [
    { value: 'todos', label: 'Todos', icon: '📊' },
    { value: 'animales', label: 'Animales', icon: '🐄' },
    { value: 'agricultura', label: 'Agricultura', icon: '🌾' },
    { value: 'clima', label: 'Clima', icon: '⛅' },
    { value: 'insumos', label: 'Insumos', icon: '📦' },
    { value: 'finanzas', label: 'Finanzas', icon: '💰' },
  ]

  const obtenerNombreTipo = (tipo: string) => {
    const nombres: Record<string, string> = {
      todos: 'Todos los tipos',
      MOVIMIENTO: 'Cambio De Potrero',
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

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {categorias.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFiltros({ ...filtros, categoria: cat.value })}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filtros.categoria === cat.value
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* BOTÓN TIPO DE DATO */}
          <button
            onClick={() => setShowModalTipo(true)}
            className="px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
          >
            <span>🔽</span>
            <span className="text-sm">
              {obtenerNombreTipo(filtros.tipoDato)}
            </span>
          </button>

          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* MODAL */}
      <ModalFiltroTipoDato
        isOpen={showModalTipo}
        onClose={() => setShowModalTipo(false)}
        selectedTipo={filtros.tipoDato}
        onSelect={(tipo) => setFiltros({ ...filtros, tipoDato: tipo })}
      />
    </>
  )
}

// ==================== TARJETA ====================
function TarjetaDato({ dato }: { dato: DatoUnificado }) {
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
          className={`${
            esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          } px-3 py-1 rounded-full text-sm font-semibold`}
        >
          💵 {esIngreso ? '+' : '-'}${Number(dato.monto).toLocaleString('es-UY')}
        </span>
      )
    }

    if (dato.cantidad && !['INGRESO', 'GASTO'].includes(dato.tipo)) {
      const texto = dato.tipo === 'VENTA' 
        ? `${dato.cantidad} vendidos`
        : dato.tipo === 'COMPRA'
        ? `${dato.cantidad} comprados`
        : `${dato.cantidad} ${dato.unidad || ''}`

      detalles.push(
        <span
          key="cantidad"
          className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
        >
          📊 {texto}
        </span>
      )
    }

    if (dato.proveedor) {
      detalles.push(
        <span
          key="proveedor"
          className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
        >
          🏪 {dato.proveedor}
        </span>
      )
    }

    if (dato.comprador) {
      detalles.push(
        <span
          key="comprador"
          className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
        >
          🤝 {dato.comprador}
        </span>
      )
    }

    if (dato.metodoPago) {
      const esIngreso = dato.tipo === 'INGRESO' || dato.tipo === 'VENTA'
      detalles.push(
        <span
          key="metodo"
          className={`${
            esIngreso
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          } px-3 py-1 rounded-full text-sm`}
        >
          💳 {dato.metodoPago}
          {dato.diasPlazo && dato.diasPlazo > 0 && ` (${dato.diasPlazo} días)`}
        </span>
      )
    }

    if (dato.metodoPago && dato.pagado !== undefined) {
      detalles.push(
        <span
          key="pagado"
          className={`${
            dato.pagado
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          } px-3 py-1 rounded-full text-sm`}
        >
          {dato.pagado ? '✅ Pagado' : '⏳ Pendiente'}
        </span>
      )
    }

    if (dato.insumo) {
      detalles.push(
        <span
          key="insumo"
          className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
        >
          📦 {dato.insumo}
        </span>
      )
    }

    if (dato.iva && dato.iva !== 0) {
      detalles.push(
        <span
          key="iva"
          className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
        >
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
        <div
          className={`${
            colorClasses[obtenerColor(dato.tipo)] || 'bg-gray-500'
          } w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0`}
        >
          {obtenerIcono(dato.tipo)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {obtenerNombreTipo(dato.tipo)}
              </h3>
              <span className="text-xs text-gray-500">{formatFecha(dato.fecha)}</span>
            </div>
          </div>

          {dato.descripcion && (
            <p className="text-gray-700 text-sm mb-3">{dato.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-2">{renderDetalles()}</div>

          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {dato.usuario && (
              <span className="bg-gray-100 px-2 py-1 rounded">👤 {dato.usuario}</span>
            )}
            {dato.lote && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                📍 {dato.lote}
              </span>
            )}
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded capitalize">
              {dato.categoria}
            </span>
          </div>

          {dato.notas && (
            <p className="text-xs text-gray-500 mt-2 italic">📝 {dato.notas}</p>
          )}
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
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No hay datos registrados
        </h3>
        <p className="text-gray-500">
          Comienza agregando eventos, gastos o movimientos de insumos
        </p>
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
    <DatosProvider>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Datos del Campo</h1>
          <p className="text-gray-600">
            Visualiza todos los eventos, movimientos y registros de tu campo
          </p>
        </div>

        <FiltrosDatos />
        <ListaDatos />
      </div>
    </DatosProvider>
  )
}