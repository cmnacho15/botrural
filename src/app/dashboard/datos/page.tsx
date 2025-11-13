'use client'
export const dynamic = 'force-dynamic'

import { DatosProvider, useDatos } from '@/app/contexts/DatosContext'
import { useState } from 'react'

/* ==================== FUNCIONES AUXILIARES ==================== */
function obtenerIcono(tipo: string): string {
  const iconos: Record<string, string> = {
    LLUVIA: '🌧️',
    HELADA: '❄️',
    GASTO: '💸',
    INGRESO: '💰',
    VENTA: '🐄',
    USO_INSUMO: '🧪',
    INGRESO_INSUMO: '📦',
    SIEMBRA: '🌱',
    COSECHA: '🌾',
    NACIMIENTO: '🐮',
    MORTANDAD: '💀',
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
    USO_INSUMO: 'orange',
    INGRESO_INSUMO: 'purple',
    SIEMBRA: 'lime',
    COSECHA: 'yellow',
    NACIMIENTO: 'pink',
    MORTANDAD: 'gray',
  }
  return colores[tipo] || 'gray'
}

/* ==================== FILTROS ==================== */
function FiltrosDatos() {
  const { filtros, setFiltros } = useDatos()
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todos')

  const categorias = [
    { value: 'todos', label: 'Todos los datos', icon: '📊' },
    { value: 'animales', label: 'Animales', icon: '🐄' },
    { value: 'agricultura', label: 'Agricultura', icon: '🌾' },
    { value: 'clima', label: 'Clima', icon: '⛅' },
    { value: 'insumos', label: 'Insumos', icon: '📦' },
    { value: 'finanzas', label: 'Finanzas', icon: '💰' },
  ]

  const handleCategoriaChange = (categoria: string) => {
    setCategoriaSeleccionada(categoria)
    setFiltros({ ...filtros, categoria })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 flex-wrap">
          {categorias.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoriaChange(cat.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                categoriaSeleccionada === cat.value
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

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
  )
}

/* ==================== TARJETA DE DATO ==================== */
function TarjetaDato({ dato }: { dato: any }) {
  const formatFecha = (fecha: Date) => {
    const fechaDato = new Date(fecha)
    return fechaDato.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
    amber: 'bg-amber-500',
    brown: 'bg-orange-800',
  }

  const renderDetalles = () => {
    const detalles = []

    /* 💵 MONTO */
    if (dato.monto !== undefined && dato.monto !== null) {
      const esIngreso =
        dato.tipo === 'INGRESO' ||
        dato.tipo === 'VENTA' ||
        dato.tipo === 'COSECHA'

      detalles.push(
        <span
          key="monto"
          className={`${
            esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          } px-3 py-1 rounded-full text-sm font-semibold`}
        >
          💵 {esIngreso ? '+' : '-'}${dato.monto.toLocaleString('es-UY')}
        </span>
      )
    }

    /* 📊 CANTIDAD */
    if (dato.cantidad) {
      detalles.push(
        <span
          key="cantidad"
          className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
        >
          📊 {dato.cantidad} {dato.unidad || ''}
        </span>
      )
    }

    /* 🏪 Proveedor (solo para gastos) */
    if (dato.proveedor && dato.tipo === 'GASTO') {
      detalles.push(
        <span
          key="proveedor"
          className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm"
        >
          🏪 {dato.proveedor}
        </span>
      )
    }

    /* 🤝 Comprador (solo ingresos) */
    if (dato.comprador && dato.tipo === 'INGRESO') {
      detalles.push(
        <span
          key="comprador"
          className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
        >
          🤝 {dato.comprador}
        </span>
      )
    }

    /* 💳 Método de pago */
    if (dato.metodoPago) {
      detalles.push(
        <span
          key="metodo"
          className={`${
            dato.tipo === 'INGRESO'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          } px-3 py-1 rounded-full text-sm`}
        >
          💳 {dato.metodoPago}
        </span>
      )
    }

    /* 🧪 Insumo */
    if (dato.insumo) {
      detalles.push(
        <span
          key="insumo"
          className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
        >
          📦 {dato.insumo}
        </span>
      )
    }

    return detalles
  }

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100">
      <div className="flex items-start gap-4">

        {/* Ícono actual */}
        <div
          className={`${
            colorClasses[obtenerColor(dato.tipo)] || 'bg-gray-500'
          } w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0`}
        >
          {obtenerIcono(dato.tipo)}
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {dato.tipo.replace(/_/g, ' ')}
              </h3>
              <span className="text-xs text-gray-500">{formatFecha(dato.fecha)}</span>
            </div>
          </div>

          <p className="text-gray-700 text-sm mb-3">{dato.descripcion}</p>

          <div className="flex flex-wrap gap-2 mb-2">
            {renderDetalles()}
          </div>

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
        </div>
      </div>
    </div>
  )
}

/* ==================== LISTA ==================== */
function ListaDatos() {
  const { datos, loading, error } = useDatos()

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
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

/* ==================== PÁGINA ==================== */
export default function DatosPage() {
  return (
    <DatosProvider>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Datos</h1>
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