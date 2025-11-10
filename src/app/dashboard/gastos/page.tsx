'use client' // HOLAAAAAAAAAA

import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import ModalEditarGasto from '@/components/ModalEditarGasto'
import ModalEditarIngreso from '@/components/ModalEditarIngreso'

type Gasto = {
  id: string
  tipo: 'GASTO' | 'INGRESO'
  fecha: string
  monto: number
  categoria: string
  descripcion?: string
  metodoPago?: string
}

type Categoria = {
  nombre: string
  cantidad: number
  total: number
  color: string
}

export default function GastosPage() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)
  const [mostrarTodasCategorias, setMostrarTodasCategorias] = useState(false)
  const [moneda, setMoneda] = useState('UYU')
  const [iva, setIva] = useState('con')
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')

  // Estados para Editar
  const [modalEditOpen, setModalEditOpen] = useState(false)
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null)

  // Estados para Eliminar
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false)
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  // Datos reales
  const [gastosData, setGastosData] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)

  const [categorias, setCategorias] = useState<Categoria[]>([
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

  // Fetch de gastos
  const fetchGastos = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gastos')
      if (!response.ok) throw new Error('Error al cargar gastos')
      const data = await response.json()
      setGastosData(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGastos()
  }, [])

  const gastosFiltrados = categoriaSeleccionada
    ? gastosData.filter(g => g.categoria === categoriaSeleccionada)
    : gastosData

  const categoriasConDatos = categorias.map((cat) => {
    const gastosCategoria = gastosData.filter((g) => g.tipo === 'GASTO' && g.categoria === cat.nombre)
    return {
      ...cat,
      cantidad: gastosCategoria.length,
      total: gastosCategoria.reduce((sum, g) => sum + g.monto, 0),
    }
  })

  const categoriasVisibles = mostrarTodasCategorias
    ? categoriasConDatos
    : categoriasConDatos.slice(0, 9)

  const totalGastos = gastosData.filter(g => g.tipo === 'GASTO').reduce((sum, g) => sum + g.monto, 0)
  const totalIngresos = gastosData.filter(g => g.tipo === 'INGRESO').reduce((sum, g) => sum + g.monto, 0)

  const datosPieChart = categoriaSeleccionada
    ? (() => {
        const totalCategoria = gastosData
          .filter(g => g.tipo === 'GASTO' && g.categoria === categoriaSeleccionada)
          .reduce((sum, g) => sum + g.monto, 0)

        const totalResto = gastosData
          .filter(g => g.tipo === 'GASTO' && g.categoria !== categoriaSeleccionada)
          .reduce((sum, g) => sum + g.monto, 0)

        return [
          {
            nombre: categoriaSeleccionada,
            total: totalCategoria,
            color: categorias.find(c => c.nombre === categoriaSeleccionada)?.color || '#3b82f6'
          },
          {
            nombre: 'Resto',
            total: totalResto,
            color: '#e5e7eb'
          }
        ]
      })()
    : categoriasConDatos.filter(c => c.total > 0)

  const datosBarChart = (() => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const gastosPorMes: Record<string, { nombre: string; total: number }> = {}
    
    meses.forEach(mes => {
      gastosPorMes[mes] = { nombre: mes, total: 0 }
    })

    const gastosAFiltrar = gastosFiltrados.filter(g => g.tipo === 'GASTO')

    gastosAFiltrar.forEach(gasto => {
      const fecha = new Date(gasto.fecha)
      const mesIndex = fecha.getMonth()
      const mesNombre = meses[mesIndex]
      gastosPorMes[mesNombre].total += gasto.monto
    })

    return Object.values(gastosPorMes)
  })()

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
      gastoCompleto: gasto,
    }
  })

  // EDITAR
  const handleEditarGasto = (gasto: Gasto) => {
    setGastoEditando(gasto)
    setModalEditOpen(true)
  }

  // ELIMINAR
  const handleEliminarGasto = async () => {
    if (!gastoAEliminar) return

    setLoadingDelete(true)
    try {
      const response = await fetch(`/api/gastos/${gastoAEliminar.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Error al eliminar')

      setGastosData(prev => prev.filter(g => g.id !== gastoAEliminar.id))

      setModalDeleteOpen(false)
      setGastoAEliminar(null)
      alert('¡Gasto eliminado exitosamente!')
    } catch (error) {
      console.error('Error al eliminar:', error)
      alert('Error al eliminar el gasto')
    } finally {
      setLoadingDelete(false)
    }
  }

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando gastos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Gastos</h1>

        <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
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
            Último Año
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {mostrarTodasCategorias ? (
          <>
            <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Categorías de Gastos</h2>
                <button
                  onClick={() => setModalCategoriaOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 font-bold"
                >
                  +
                </button>
              </div>

              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => setCategoriaSeleccionada(null)}
                  className={`flex justify-between items-center px-3 py-3 rounded-lg transition ${
                    categoriaSeleccionada === null ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">Todos los gastos</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">{gastosData.length}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{totalGastos} {moneda}</span>
                </button>

                {categoriasVisibles.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCategoriaSeleccionada(cat.nombre)}
                    className={`flex justify-between items-center px-3 py-3 rounded-lg cursor-pointer transition ${
                      categoriaSeleccionada === cat.nombre ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-gray-700">{cat.nombre}</span>
                      {cat.cantidad > 0 && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                          {cat.cantidad}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-900">{cat.total}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setMostrarTodasCategorias(false)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-3"
              >
                Colapsar
              </button>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada ? `Distribución: ${categoriaSeleccionada}` : 'Distribución de Gastos'}
                </h2>
                <div style={{ height: '450px' }}>
                  {datosPieChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={datosPieChart}
                          dataKey="total"
                          nameKey="nombre"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label={(entry) => `${entry.nombre}: ${entry.total}`}
                        >
                          {datosPieChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} ${moneda}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Sin datos para mostrar
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada ? `Tendencias: ${categoriaSeleccionada}` : 'Tendencias Mensuales'}
                </h2>
                <div style={{ height: '450px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosBarChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nombre" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value} ${moneda}`} />
                      <Bar 
                        dataKey="total" 
                        fill={categoriaSeleccionada ? categorias.find(c => c.nombre === categoriaSeleccionada)?.color : '#3b82f6'} 
                        radius={[8, 8, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 h-full">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Categorías</h2>
                  <button
                    onClick={() => setModalCategoriaOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setCategoriaSeleccionada(null)}
                    className={`w-full flex justify-between items-center px-3 py-3 rounded-lg transition ${
                      categoriaSeleccionada === null ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">Todos</span>
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">{gastosData.length}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{totalGastos}</span>
                  </button>

                  {categoriasVisibles.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCategoriaSeleccionada(cat.nombre)}
                      className={`w-full flex justify-between items-center px-3 py-2 rounded-lg cursor-pointer transition ${
                        categoriaSeleccionada === cat.nombre ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-gray-700 truncate">{cat.nombre}</span>
                        {cat.cantidad > 0 && (
                          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                            {cat.cantidad}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-900">{cat.total}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setMostrarTodasCategorias(true)}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-3 mt-2 border-t border-gray-100"
                >
                  Ver más
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 grid gap-6 grid-cols-1 md:grid-cols-2">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada ? `Distribución: ${categoriaSeleccionada}` : 'Distribución de Gastos'}
                </h2>
                <div style={{ height: '320px' }}>
                  {datosPieChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={datosPieChart}
                          dataKey="total"
                          nameKey="nombre"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.nombre}: ${entry.total}`}
                        >
                          {datosPieChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} ${moneda}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Sin datos para mostrar
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada ? `Tendencias: ${categoriaSeleccionada}` : 'Tendencias Mensuales'}
                </h2>
                <div style={{ height: '320px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosBarChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nombre" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value} ${moneda}`} />
                      <Bar 
                        dataKey="total" 
                        fill={categoriaSeleccionada ? categorias.find(c => c.nombre === categoriaSeleccionada)?.color : '#3b82f6'} 
                        radius={[8, 8, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">
            {categoriaSeleccionada ? `Gastos en ${categoriaSeleccionada}` : 'Gastos e Ingresos Registrados'}
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Fecha', 'Precio', 'Ítem', 'Categoría', 'Usuario', ''].map((th, i) => (
                    <th key={i} className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transacciones.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3">{t.fecha}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className={`font-semibold ${t.esIngreso ? 'text-green-600' : 'text-red-600'}`}>
                        {t.esIngreso ? '+' : '-'}{t.monto}
                      </div>
                      <div className="text-xs text-gray-500">{moneda}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-3">{t.item}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <span
                        className="inline-block px-3 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: `${t.color}15`, color: t.color }}
                      >
                        {t.categoria}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3">{t.usuario}</td>
                    <td className="px-4 sm:px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleEditarGasto(t.gastoCompleto)}
                          className="text-blue-600 hover:text-blue-800 transition text-sm font-medium"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setGastoAEliminar(t.gastoCompleto)
                            setModalDeleteOpen(true)
                          }}
                          className="text-red-600 hover:text-red-800 transition text-sm font-medium"
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

      {/* MODAL NUEVA CATEGORÍA */}
      {modalCategoriaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Nueva categoría de gastos</h2>
              <button
                onClick={() => setModalCategoriaOpen(false)}
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
                  placeholder="Nombre"
                  maxLength={120}
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {nuevaCategoriaNombre.length}/120
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  if (nuevaCategoriaNombre.trim() === '') return
                  const nuevaCat = {
                    nombre: nuevaCategoriaNombre.trim(),
                    cantidad: 0,
                    total: 0,
                    color: '#' + Math.floor(Math.random() * 16777215).toString(16),
                  }
                  setCategorias((prev) => [...prev, nuevaCat])
                  setNuevaCategoriaNombre('')
                  setModalCategoriaOpen(false)
                }}
                disabled={nuevaCategoriaNombre.trim() === ''}
                className={`px-6 py-3 rounded-xl text-white font-medium transition ${
                  nuevaCategoriaNombre.trim() === ''
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {modalEditOpen && gastoEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full">
            {gastoEditando.tipo === 'GASTO' ? (
              <ModalEditarGasto
                gasto={gastoEditando}
                onClose={() => {
                  setModalEditOpen(false)
                  setGastoEditando(null)
                }}
                onSuccess={() => {
                  fetchGastos()
                  setModalEditOpen(false)
                  setGastoEditando(null)
                }}
              />
            ) : (
              <ModalEditarIngreso
                gasto={gastoEditando}
                onClose={() => {
                  setModalEditOpen(false)
                  setGastoEditando(null)
                }}
                onSuccess={() => {
                  fetchGastos()
                  setModalEditOpen(false)
                  setGastoEditando(null)
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR - ESTILO PROFESIONAL */}
      {modalDeleteOpen && gastoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Eliminar {gastoAEliminar.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}
                </h2>
              </div>
              <button
                onClick={() => setModalDeleteOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-3">
                ¿Estás seguro que querés eliminar este <span className="font-medium">
                  {gastoAEliminar.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}
                </span>?
              </p>
              <p className="font-semibold text-gray-900 mb-1">
                {gastoAEliminar.descripcion || `${gastoAEliminar.categoria} - $${gastoAEliminar.monto}`}
              </p>
              <p className="text-sm text-red-600 font-medium">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalDeleteOpen(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarGasto}
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