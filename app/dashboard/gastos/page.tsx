'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGastos } from '@/app/contexts/GastosContext'

type Item = {
  id: string
  nombre: string
  categoria: string
  precio: number
  iva: number
  precioFinal: number
}

function GastosContent() {
  const searchParams = useSearchParams()
  const { gastos: gastosDB, isLoading: loadingGastos, addGasto } = useGastos()

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)
  const [mostrarTodasCategorias, setMostrarTodasCategorias] = useState(false)
  const [moneda, setMoneda] = useState('UYU')
  const [iva, setIva] = useState('con')
  const [periodo, setPeriodo] = useState('ultimo-ano')
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState('')
  const [monedaGasto, setMonedaGasto] = useState('UYU')
  const [items, setItems] = useState<Item[]>([
    { id: '1', nombre: '', categoria: '', precio: 0, iva: 0, precioFinal: 0 },
  ])
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  const [categorias, setCategorias] = useState([
    { nombre: 'Alimentación', cantidad: 0, total: 0, color: '#a855f7' },
    { nombre: 'Otros', cantidad: 0, total: 0, color: '#22c55e' },
    { nombre: 'Administración', cantidad: 0, total: 0, color: '#f97316' },
    { nombre: 'Alquiler', cantidad: 0, total: 0, color: '#06b6d4' },
    { nombre: 'Asesoramiento', cantidad: 0, total: 0, color: '#ec4899' },
    { nombre: 'Combustible', cantidad: 0, total: 0, color: '#84cc16' },
    { nombre: 'Compras de Hacienda', cantidad: 0, total: 0, color: '#3b82f6' },
    { nombre: 'Estructuras', cantidad: 0, total: 0, color: '#ef4444' },
    { nombre: 'Fertilizantes', cantidad: 0, total: 0, color: '#4ade80' },
    { nombre: 'Fitosanitarios', cantidad: 0, total: 0, color: '#60a5fa' },
    { nombre: 'Gastos Comerciales', cantidad: 0, total: 0, color: '#f87171' },
    { nombre: 'Impuestos', cantidad: 0, total: 0, color: '#16a34a' },
    { nombre: 'Insumos Agrícolas', cantidad: 0, total: 0, color: '#c084fc' },
    { nombre: 'Labores', cantidad: 0, total: 0, color: '#eab308' },
    { nombre: 'Maquinaria', cantidad: 0, total: 0, color: '#22d3ee' },
    { nombre: 'Sanidad', cantidad: 0, total: 0, color: '#f472b6' },
    { nombre: 'Seguros', cantidad: 0, total: 0, color: '#a3e635' },
    { nombre: 'Semillas', cantidad: 0, total: 0, color: '#2563eb' },
    { nombre: 'Sueldos', cantidad: 0, total: 0, color: '#dc2626' },
  ])

  const opcionesIVA = [
    { value: 0, label: '0%' },
    { value: 10, label: '10%' },
    { value: 22, label: '22%' },
  ]

  // Filtrar por categoría si hay una seleccionada
  const gastosFiltrados = categoriaSeleccionada
    ? gastosDB.filter(g => g.categoria === categoriaSeleccionada)
    : gastosDB

  const categoriasConDatos = categorias.map((cat) => {
    const gastosCategoria = gastosDB.filter((g) => g.tipo === 'GASTO' && g.categoria === cat.nombre)
    return {
      ...cat,
      cantidad: gastosCategoria.length,
      total: gastosCategoria.reduce((sum, g) => sum + g.monto, 0),
    }
  })

  const categoriasVisibles = mostrarTodasCategorias
    ? categoriasConDatos
    : categoriasConDatos.slice(0, 9)

  const totalGastos = gastosDB.filter(g => g.tipo === 'GASTO').reduce((sum, g) => sum + g.monto, 0)
  const totalIngresos = gastosDB.filter(g => g.tipo === 'INGRESO').reduce((sum, g) => sum + g.monto, 0)

  const transacciones = gastosFiltrados.map((gasto) => {
    const categoria = categorias.find((c) => c.nombre === gasto.categoria)
    const esIngreso = gasto.tipo === 'INGRESO'
    
    return {
      id: gasto.id,
      tipo: gasto.tipo,
      fecha: new Date(gasto.fecha).toLocaleDateString('es-UY'),
      monto: gasto.monto,
      item: gasto.descripcion?.split(' - ')[0] || 'Sin descripción',
      categoria: gasto.categoria,
      color: categoria?.color || '#6b7280',
      usuario: 'Nacho Rodriguez',
      esIngreso,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm px-6 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Gastos</h1>

        <div className="flex flex-wrap gap-3">
          {/* Moneda */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
            {['UYU', 'USD'].map((m) => (
              <button
                key={m}
                onClick={() => setMoneda(m)}
                className={`px-4 py-2 text-sm font-medium ${
                  moneda === m ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* IVA */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
            {['con', 'sin'].map((v) => (
              <button
                key={v}
                onClick={() => setIva(v)}
                className={`px-4 py-2 text-sm font-medium ${
                  iva === v ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {v === 'con' ? 'Con IVA' : 'Sin IVA'}
              </button>
            ))}
          </div>

          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm">
            📅 <span>Último Año</span>
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Categorías */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Categorías de Gastos</h2>
          </div>

          <div className="space-y-2">
            {/* Todas las categorías */}
            <button
              onClick={() => setCategoriaSeleccionada(null)}
              className={`w-full flex justify-between items-center px-3 py-3 rounded-lg transition ${
                categoriaSeleccionada === null ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Todos los gastos</span>
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                  {gastosDB.filter(g => g.tipo === 'GASTO').length}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{totalGastos} {moneda}</span>
            </button>

            {/* Categorías individuales */}
            {categoriasConDatos.map((cat) => (
              <button
                key={cat.nombre}
                onClick={() => setCategoriaSeleccionada(cat.nombre)}
                className={`w-full flex justify-between items-center px-3 py-3 rounded-lg transition ${
                  categoriaSeleccionada === cat.nombre ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-gray-700">{cat.nombre}</span>
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                    {cat.cantidad}
                  </span>
                </div>
                <span className="text-sm text-gray-900">{cat.total}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Distribución y Tendencias */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribución */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {categoriaSeleccionada ? `Gastos en ${categoriaSeleccionada}` : 'Distribución de Gastos'}
              </h2>
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-gray-500">Gráfico circular aquí</p>
                </div>
              </div>
            </div>

            {/* Tendencias */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tendencias Mensuales</h2>
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <p className="text-gray-500">Gráfico de barras aquí</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Gastos e Ingresos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Gastos e Ingresos</h2>
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                🔍 Buscar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{t.fecha}</td>
                      <td className="px-6 py-4">
                        <div className={`font-semibold ${t.esIngreso ? 'text-green-600' : 'text-red-600'}`}>
                          {t.esIngreso ? '+' : '-'}{t.monto}
                        </div>
                        <div className="text-xs text-gray-500">{moneda}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{t.item}</td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-block px-3 py-1 rounded-lg text-xs font-medium"
                          style={{
                            backgroundColor: `${t.color}15`,
                            color: t.color,
                          }}
                        >
                          {t.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{t.usuario}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button className="text-gray-400 hover:text-blue-600">✏️</button>
                          <button className="text-gray-400 hover:text-red-600">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen de totales */}
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-700 font-medium mb-1">Total Gastos</div>
                <div className="text-2xl font-bold text-red-600">-{totalGastos} {moneda}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-700 font-medium mb-1">Total Ingresos</div>
                <div className="text-2xl font-bold text-green-600">+{totalIngresos} {moneda}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}