'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import ModalEditarGasto from '@/components/ModalEditarGasto'
import ModalEditarIngreso from '@/components/ModalEditarIngreso'
import { FileText } from 'lucide-react'
import ModalFactura from '@/app/components/modales/ModalFactura'

type Gasto = {
  id: string
  tipo: 'GASTO' | 'INGRESO'
  fecha: string
  createdAt?: string
  monto: number
  categoria: string
  descripcion?: string
  metodoPago?: string
  diasPlazo?: number       // 👈 AGREGAR ESTA LÍNEA
  pagado?: boolean
  proveedor?: string
  comprador?: string
  imageUrl?: string
  imageName?: string

  // NUEVOS CAMPOS MONEDA / IVA
  moneda?: 'UYU' | 'USD'
  montoOriginal?: number
  tasaCambio?: number | null
  montoEnUYU?: number
  iva?: number | null
}

type Categoria = {
  nombre: string
  cantidad: number
  total: number
  color: string
}
// 🎨 Función para generar un color único (evita los 19 ya usados)
const generarColorUnico = (coloresUsados: string[]): string => {
  // Solo colores que NO están en las 19 categorías originales
  const coloresDisponibles = [
    '#8b5cf6', // violet
    '#14b8a6', // teal  
    '#f59e0b', // amber
    '#10b981', // emerald
    '#6366f1', // indigo
    '#fb7185', // rose
    '#0ea5e9', // sky
    '#14532d', // green-900
    '#1e3a8a', // blue-900
    '#7c2d12', // orange-900
    '#831843', // pink-900
    '#365314', // lime-900
    '#9333ea', // purple-600
    '#0891b2', // cyan-600
    '#ea580c', // orange-600
    '#be123c', // rose-700
  ]

  // Buscar primer color NO usado
  for (const color of coloresDisponibles) {
    if (!coloresUsados.includes(color)) {
      return color
    }
  }

  // Si todos están usados (más de 35 categorías), generar aleatorio
  return '#' + Math.floor(Math.random() * 16777215).toString(16)
}

export default function GastosPage() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)
  const [mostrarTodasCategorias, setMostrarTodasCategorias] = useState(false)
  const [moneda, setMoneda] = useState<'UYU' | 'USD'>('UYU')
  const [iva, setIva] = useState<'con' | 'sin'>('con')
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState('')

  // NUEVOS ESTADOS
  const [proveedoresCargados, setProveedoresCargados] = useState<string[]>([])
  const [mostrarMenuProveedor, setMostrarMenuProveedor] = useState(false)
  const [sectorHover, setSectorHover] = useState<string | null>(null)

  // Estados para Editar
  const [modalEditOpen, setModalEditOpen] = useState(false)
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null)

  // Estados para Eliminar
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false)
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  // Estados para filtro de fechas
  const [modalFechaOpen, setModalFechaOpen] = useState(false)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [rangoSeleccionado, setRangoSeleccionado] = useState('Último Año')

  // Datos reales
  const [gastosData, setGastosData] = useState<Gasto[]>([])
  const [modalFacturaOpen, setModalFacturaOpen] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [categorias, setCategorias] = useState<Categoria[]>([])

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

  // NUEVO useEffect: Cargar proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const res = await fetch('/api/proveedores')
        if (res.ok) {
          const data = await res.json()
          setProveedoresCargados(data.filter(Boolean))
        }
      } catch (err) {
        console.warn('Error al cargar proveedores')
      }
    }
    fetchProveedores()
  }, [])

  // NUEVO useEffect: Cargar categorías desde la base de datos
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await fetch('/api/categorias-gasto')
        if (res.ok) {
          const data = await res.json()
          setCategorias(data)
        }
      } catch (err) {
        console.warn('Error al cargar categorías', err)
      }
    }
    fetchCategorias()
  }, [])

  // Función para aplicar rangos de fecha predefinidos
  const aplicarRangoFecha = (tipo: string) => {
  const hoy = new Date()
  
  // Obtener fecha local en formato YYYY-MM-DD
  const formatearFechaLocal = (fecha: Date) => {
    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    return `${año}-${mes}-${dia}`
  }

  let inicio: string
  let fin: string

  switch (tipo) {
    case 'Hoy':
      inicio = formatearFechaLocal(hoy)
      fin = formatearFechaLocal(hoy)
      break
    case 'Últimos 7 Días':
      inicio = formatearFechaLocal(new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000))
      fin = formatearFechaLocal(hoy)
      break
    case 'Últimos 30 Días':
      inicio = formatearFechaLocal(new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000))
      fin = formatearFechaLocal(hoy)
      break
    case 'Últimos 90 Días':
      inicio = formatearFechaLocal(new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000))
      fin = formatearFechaLocal(hoy)
      break
    case 'Último Año':
      inicio = formatearFechaLocal(new Date(hoy.getTime() - 365 * 24 * 60 * 60 * 1000))
      fin = formatearFechaLocal(hoy)
      break
    case 'Todos los tiempos':
      setFechaInicio('')
      setFechaFin('')
      setRangoSeleccionado(tipo)
      return
    default:
      return
  }

  setFechaInicio(inicio)
  setFechaFin(fin)
  setRangoSeleccionado(tipo)
}

  // Función para limpiar filtros
  const limpiarFiltroFecha = () => {
    setFechaInicio('')
    setFechaFin('')
    setRangoSeleccionado('Todos los tiempos')
  }

  // 🎯 HELPERS PARA MONEDA E IVA

  const getMontoBaseUYU = (g: Gasto): number => {
    const montoUYU = (g.montoEnUYU ?? g.monto) || 0
    if (iva === 'sin' && g.iva && g.iva > 0) {
      const factor = 1 + g.iva / 100
      return montoUYU / factor
    }
    return montoUYU
  }

  const getMontoVista = (g: Gasto): number => {
  // monto base en UYU (montoEnUYU viene del backend)
  const montoUYU = g.montoEnUYU ?? g.monto ?? 0;

  // quitar IVA si corresponde
  const baseUYU = iva === 'sin' && g.iva && g.iva > 0
    ? montoUYU / (1 + g.iva / 100)
    : montoUYU;

  // Si estamos viendo en UYU → retornar base
  if (moneda === 'UYU') {
    return baseUYU;
  }

  // Si estamos viendo en USD:
  if (g.moneda === 'USD') {
    let baseUSD = g.montoOriginal ?? g.monto ?? 0;

    if (iva === 'sin' && g.iva && g.iva > 0) {
      baseUSD = baseUSD / (1 + g.iva / 100);
    }

    return baseUSD;
  }

  // Gasto creado en UYU → convertir a USD
  const tasa = g.tasaCambio && g.tasaCambio > 0 ? g.tasaCambio : 40;
  return baseUYU / tasa;
}

  const gastosFiltrados = gastosData.filter((g) => {
  const coincideCategoria = categoriaSeleccionada ? g.categoria === categoriaSeleccionada : true

  const coincideProveedor = proveedorFiltro
    ? g.proveedor?.trim().toLowerCase() === proveedorFiltro.trim().toLowerCase()
    : true

  let coincideFecha = true
  if (fechaInicio && fechaFin) {
    // Comparar solo las fechas (sin hora)
    const fechaGastoStr = g.fecha.split('T')[0] // "2024-11-21"
    coincideFecha = fechaGastoStr >= fechaInicio && fechaGastoStr <= fechaFin
  }

  return coincideCategoria && coincideProveedor && coincideFecha
})

// 👇 Calcular categorías SIN filtro de categoría seleccionada
const categoriasConDatos = categorias.map((cat) => {
  const gastosCategoria = gastosData.filter((g) => {
    const esGasto = g.tipo === 'GASTO'
    const esDeLaCategoria = g.categoria === cat.nombre
    
    const coincideProveedor = proveedorFiltro
      ? g.proveedor?.trim().toLowerCase() === proveedorFiltro.trim().toLowerCase()
      : true

    let coincideFecha = true
    if (fechaInicio && fechaFin) {
      // 👇 USAR LA MISMA LÓGICA que gastosFiltrados
      const fechaGastoStr = g.fecha.split('T')[0] // "2024-11-21"
      coincideFecha = fechaGastoStr >= fechaInicio && fechaGastoStr <= fechaFin
    }

    // NO incluir categoriaSeleccionada aquí - el gráfico siempre muestra todas las categorías
    return esGasto && esDeLaCategoria && coincideProveedor && coincideFecha
  })
  
  return {
    ...cat,
    cantidad: gastosCategoria.length,
    total: gastosCategoria.reduce((sum, g) => sum + getMontoVista(g), 0),
  }
})

const categoriasVisibles = mostrarTodasCategorias
  ? categoriasConDatos
  : categoriasConDatos.slice(0, 9)

// Total para el GRÁFICO (sin filtro de categoría)
const totalGastosGrafico = categoriasConDatos.reduce((sum, cat) => sum + cat.total, 0)

// Total para la TABLA (con TODOS los filtros incluyendo categoría)
const totalGastos = gastosFiltrados
  .filter((g) => g.tipo === 'GASTO')
  .reduce((sum, g) => sum + getMontoVista(g), 0)

const totalIngresos = gastosFiltrados
  .filter((g) => g.tipo === 'INGRESO')
  .reduce((sum, g) => sum + getMontoVista(g), 0)

// NUEVOS CÁLCULOS: Estado de pagos por proveedor
const estadoPagosPorProveedor = gastosData
  .filter((g) => g.tipo === 'GASTO' && g.metodoPago === 'Plazo' && g.proveedor)
  .reduce(
    (acc: Record<string, { total: number; pagado: number; pendiente: number }>, g) => {
      const prov = g.proveedor || 'Sin proveedor'
      if (!acc[prov]) {
        acc[prov] = { total: 0, pagado: 0, pendiente: 0 }
      }
      const monto = getMontoVista(g)
      acc[prov].total += monto
      if (g.pagado) {
        acc[prov].pagado += monto
      } else {
        acc[prov].pendiente += monto
      }
      return acc
    },
    {}
  )

const proveedoresConPendientes = Object.entries(estadoPagosPorProveedor)
  .filter(([_, data]) => data.pendiente > 0)
  .sort((a, b) => b[1].pendiente - a[1].pendiente)

const totalPendiente = proveedoresConPendientes.reduce((sum, [_, data]) => sum + data.pendiente, 0)

// Datos para el gráfico circular
const datosPieChart = categoriasConDatos
  .filter((c) => c.total > 0)
  .map((cat) => ({
    nombre: cat.nombre,
    total: cat.total,
    color: cat.color,
    porcentaje: totalGastosGrafico > 0 ? ((cat.total / totalGastosGrafico) * 100).toFixed(1) : '0.0',
    isSelected: categoriaSeleccionada === cat.nombre,
  }))

const datosBarChart = (() => {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const gastosPorMes: Record<string, { nombre: string; total: number }> = {}

  meses.forEach((mes) => {
    gastosPorMes[mes] = { nombre: mes, total: 0 }
  })

  const gastosAFiltrar = gastosFiltrados.filter((g) => g.tipo === 'GASTO')

  gastosAFiltrar.forEach((gasto) => {
    const fecha = new Date(gasto.fecha)
    const mesIndex = fecha.getMonth()
    const mesNombre = meses[mesIndex]
    gastosPorMes[mesNombre].total += getMontoVista(gasto)
  })

  return Object.values(gastosPorMes)
})()
// 🗓️ FUNCIÓN PARA CALCULAR VENCIMIENTO
const calcularVencimiento = (gasto: Gasto) => {
  if (!gasto.diasPlazo || gasto.metodoPago !== 'Plazo' || gasto.pagado) {
    return null
  }

  const fechaGasto = new Date(gasto.fecha)
  const fechaVencimiento = new Date(fechaGasto)
  fechaVencimiento.setDate(fechaVencimiento.getDate() + gasto.diasPlazo)

  // Calcular días restantes (considerando zona horaria de Uruguay)
  const hoy = new Date()
  const diffTime = fechaVencimiento.getTime() - hoy.getTime()
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return {
    diasRestantes,
    fechaVencimiento: fechaVencimiento.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }
}


const transacciones = gastosFiltrados
  .map((gasto) => {
    const categoria = categorias.find((c) => c.nombre === gasto.categoria)
    const esIngreso = gasto.tipo === 'INGRESO'

    // Formatear fecha correctamente sin problemas de zona horaria
    const fechaObj = new Date(gasto.fecha)
    const fechaFormateada = new Date(fechaObj.getTime() + fechaObj.getTimezoneOffset() * 60000)
      .toLocaleDateString('es-UY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })

    return {
      id: gasto.id,
      tipo: gasto.tipo,
      fecha: fechaFormateada,
      fechaOriginal: new Date(gasto.fecha).getTime(),
      monto: getMontoVista(gasto),
      item: gasto.descripcion?.split(' - ')[0] || 'Sin descripción',
      categoria: gasto.categoria,
      color: categoria?.color || '#6b7280',
      usuario: 'Nacho Rodriguez',
      esIngreso,
      gastoCompleto: gasto,
    }
  })
  .sort((a, b) => {
  // Primero ordenar por fecha del gasto (más reciente primero)
  const fechaDiff = b.fechaOriginal - a.fechaOriginal
  if (fechaDiff !== 0) return fechaDiff
  
  // Si la fecha es igual, ordenar por createdAt (más nuevo primero)
  if (a.gastoCompleto.createdAt && b.gastoCompleto.createdAt) {
    const createdA = new Date(a.gastoCompleto.createdAt).getTime()
    const createdB = new Date(b.gastoCompleto.createdAt).getTime()
    return createdB - createdA
  }
  
  return 0
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

      setGastosData((prev) => prev.filter((g) => g.id !== gastoAEliminar.id))

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

  // Tooltip personalizado del PieChart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-2xl border-2 border-blue-500">
          <p className="font-bold text-gray-900 mb-1">{data.nombre}</p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-blue-600">{data.total.toFixed(0)}</span> {moneda}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data.porcentaje}% del total</p>
        </div>
      )
    }
    return null
  }

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Cargando gastos...</p>
        </div>
      </div>
    )
  }

  return (
  <div className="min-h-screen bg-gray-50">
    {/* 👇 AGREGÁ ESTO AQUÍ */}
    <style jsx global>{`
      .recharts-sector:focus {
        outline: none !important;
      }
    `}</style>
    {/* 👆 HASTA AQUÍ */}

    {/* HEADER */}
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Gastos</h1>

          <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
            {/* Selector de moneda */}
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              {['UYU', 'USD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMoneda(m as 'UYU' | 'USD')}
                  className={`px-4 py-2 text-sm font-medium ${
                    moneda === m ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Selector IVA */}
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              {['con', 'sin'].map((v) => (
                <button
                  key={v}
                  onClick={() => setIva(v as 'con' | 'sin')}
                  className={`px-4 py-2 text-sm font-medium ${
                    iva === v ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {v === 'con' ? 'Con IVA' : 'Sin IVA'}
                </button>
              ))}
            </div>

            {/* Filtro fecha */}
            <button
              onClick={() => setModalFechaOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {rangoSeleccionado}
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE FILTROS Y ALERTAS */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Filtro de proveedor */}
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span className="text-sm font-semibold text-gray-700">Filtrar gastos:</span>
              </div>

              {/* Dropdown de proveedores */}
              <div className="relative flex-1 min-w-[250px] max-w-sm">
                <button
                  onClick={() => setMostrarMenuProveedor(!mostrarMenuProveedor)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-2 border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    {proveedorFiltro ? (
                      <>
                        <span className="text-lg">📦</span>
                        <span className="text-sm font-medium text-gray-900">{proveedorFiltro}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Seleccionar proveedor...</span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-transform ${
                      mostrarMenuProveedor ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {mostrarMenuProveedor && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMostrarMenuProveedor(false)} />
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-500 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                      {/* Opción "Todos" */}
                      <button
                        onClick={() => {
                          setProveedorFiltro('')
                          setMostrarMenuProveedor(false)
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b ${
                          !proveedorFiltro ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🌐</span>
                          <span className="text-sm">Todos los proveedores</span>
                        </div>
                      </button>

                      {proveedoresCargados.length > 0 ? (
                        proveedoresCargados.map((prov) => {
                          const tienePendientes = estadoPagosPorProveedor[prov]?.pendiente > 0
                          const gastosTotales = gastosData.filter(
                            (g) => g.proveedor?.trim().toLowerCase() === prov.trim().toLowerCase()
                          ).length

                          return (
                            <button
                              key={prov}
                              onClick={() => {
                                setProveedorFiltro(prov)
                                setMostrarMenuProveedor(false)
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0 ${
                                proveedorFiltro === prov ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">📦</span>
                                  <span
                                    className={`text-sm ${
                                      proveedorFiltro === prov ? 'font-semibold text-blue-700' : 'text-gray-700'
                                    }`}
                                  >
                                    {prov}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {tienePendientes && (
                                    <span
                                      className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"
                                      title="Tiene pagos pendientes"
                                    />
                                  )}
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                    {gastosTotales}
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })
                      ) : (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <p className="text-sm">No hay proveedores registrados</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Botón limpiar filtro */}
              {proveedorFiltro && (
                <button
                  onClick={() => setProveedorFiltro('')}
                  className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpiar
                </button>
              )}
            </div>

            
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {mostrarTodasCategorias ? (
          <>
            {/* Vista expandida de categorías + gráficos */}
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
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                      {gastosData.length}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {totalGastos.toFixed(0)} {moneda}
                  </span>
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
                    <span className="text-sm text-gray-900">{cat.total.toFixed(0)}</span>
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
              {/* PieChart */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada
                    ? `Distribución: ${categoriaSeleccionada}`
                    : 'Distribución de Gastos'}
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
                          innerRadius={80}
                          paddingAngle={2}
                          animationBegin={0}
                          animationDuration={800}
                          onMouseEnter={(_, index) => {
                            const categoria = datosPieChart[index].nombre
                            setSectorHover(categoria)
                          }}
                          onMouseLeave={() => setSectorHover(null)}
                        >
                          {datosPieChart.map((entry, index) => {
                            const isHovered = sectorHover === entry.nombre
                            const isSelected = entry.isSelected
                            const shouldHighlight = isHovered || isSelected

                            let opacity = 1
                            if (categoriaSeleccionada && !isSelected && !isHovered) {
                              opacity = 0.25
                            } else if (sectorHover && !shouldHighlight) {
                              opacity = 0.3
                            }

                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                opacity={opacity}
                                stroke={shouldHighlight ? '#ffffff' : 'none'}
                                strokeWidth={shouldHighlight ? 4 : 0}
                                style={{
                                  filter: shouldHighlight
                                    ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                                    : 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                }}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Sin datos para mostrar
                    </div>
                  )}
                </div>
              </div>

              {/* BarChart */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada
                    ? `Tendencias: ${categoriaSeleccionada}`
                    : 'Tendencias Mensuales'}
                </h2>
                <div style={{ height: '450px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosBarChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nombre" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(0)} ${moneda}`} />
                      <Bar
                        dataKey="total"
                        fill={
                          categoriaSeleccionada
                            ? categorias.find((c) => c.nombre === categoriaSeleccionada)?.color ||
                              '#3b82f6'
                            : '#3b82f6'
                        }
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Vista compacta (categorías a la izquierda)
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
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                        {gastosData.length}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">
                      {totalGastos.toFixed(0)}
                    </span>
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
                      <span className="text-xs text-gray-900">{cat.total.toFixed(0)}</span>
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
              {/* PieChart compacto */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada
                    ? `Distribución: ${categoriaSeleccionada}`
                    : 'Distribución de Gastos'}
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
                          innerRadius={65}
                          paddingAngle={2}
                          animationBegin={0}
                          animationDuration={800}
                          onMouseEnter={(_, index) => {
                            const categoria = datosPieChart[index].nombre
                            setSectorHover(categoria)
                          }}
                          onMouseLeave={() => setSectorHover(null)}
                        >
                          {datosPieChart.map((entry, index) => {
                            const isHovered = sectorHover === entry.nombre
                            const isSelected = entry.isSelected
                            const shouldHighlight = isHovered || isSelected

                            let opacity = 1
                            if (categoriaSeleccionada && !isSelected && !isHovered) {
                              opacity = 0.25
                            } else if (sectorHover && !shouldHighlight) {
                              opacity = 0.3
                            }

                            return (
                              <Cell
                                key={`cell-mini-${index}`}
                                fill={entry.color}
                                opacity={opacity}
                                stroke={shouldHighlight ? '#ffffff' : 'none'}
                                strokeWidth={shouldHighlight ? 3 : 0}
                                style={{
                                  filter: shouldHighlight
                                    ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                                    : 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                }}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Sin datos para mostrar
                    </div>
                  )}
                </div>
              </div>

              {/* BarChart compacto */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {categoriaSeleccionada
                    ? `Tendencias: ${categoriaSeleccionada}`
                    : 'Tendencias Mensuales'}
                </h2>
                <div style={{ height: '320px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosBarChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nombre" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(0)} ${moneda}`} />
                      <Bar
                        dataKey="total"
                        fill={
                          categoriaSeleccionada
                            ? categorias.find((c) => c.nombre === categoriaSeleccionada)?.color ||
                              '#3b82f6'
                            : '#3b82f6'
                        }
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
            {categoriaSeleccionada
              ? `Gastos en ${categoriaSeleccionada}`
              : 'Gastos e Ingresos Registrados'}
          </h2>

          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Fecha', 'Precio', 'Ítem', 'Categoría', 'Proveedor/Comprador', 'Usuario', 'Estado', 'Vencimiento', ''].map(
  (th, i) => (
    <th
      key={i}
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap ${
        th === 'Usuario' ? 'hidden lg:table-cell' : ''
      }`}
    >
                        {th}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transacciones.map((t) => {
                  const esGasto = t.tipo === 'GASTO'
                  const esIngreso = t.tipo === 'INGRESO'
                  const pagado = t.gastoCompleto?.pagado
                  const metodoPago = t.gastoCompleto?.metodoPago

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-50 transition ${
                        !pagado && metodoPago === 'Plazo'
                          ? esGasto
                            ? 'bg-yellow-50'
                            : 'bg-cyan-50'
                          : ''
                      }`}
                    >
                      {/* FECHA */}
                      <td className="px-3 py-3">{t.fecha}</td>

                      {/* MONTO */}
<td className="px-3 py-3">
  {(() => {
    const g = t.gastoCompleto;
    let montoMostrar = 0;

    if (moneda === "UYU") {
      // Mostrar siempre en UYU
      montoMostrar = g.montoEnUYU ?? g.monto ?? 0;
    } else {
      // Mostrar en USD
      if (g.moneda === "USD") {
        // Gasto creado en USD → usar montoOriginal
        montoMostrar = g.montoOriginal ?? g.monto ?? 0;
      } else {
        // Gasto creado en UYU → convertir a USD
        const tasa = g.tasaCambio && g.tasaCambio > 0 ? g.tasaCambio : 40;
        montoMostrar = (g.montoOriginal ?? g.monto ?? 0) / tasa;
      }
    }

    const esIngreso = g.tipo === "INGRESO";
    const esGasto = g.tipo === "GASTO";

    return (
      <>
        <div
          className={`font-semibold ${
            esIngreso
              ? "text-green-600"
              : esGasto
              ? "text-red-600"
              : "text-gray-600"
          }`}
        >
          {esIngreso ? "+" : "-"}
          {montoMostrar.toFixed(0)}
        </div>

        <div className="text-xs text-gray-500">
          {moneda}
        </div>
      </>
    );
  })()}
</td>

                      {/* ÍTEM */}
                      <td className="px-3 py-3">{t.item}</td>

                      {/* CATEGORÍA */}
                      <td className="px-3 py-3">
                        <span
                          className="inline-block px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: `${t.color}15`, color: t.color }}
                        >
                          {t.categoria}
                        </span>
                      </td>

                      {/* PROVEEDOR/COMPRADOR */}
<td className="px-3 py-3">
  <span className="text-sm text-gray-700">
    {t.esIngreso 
      ? (t.gastoCompleto?.comprador || '-')
      : (t.gastoCompleto?.proveedor || '-')
    }
  </span>
</td>

                      {/* USUARIO */}
                      <td className="hidden lg:table-cell px-3 py-3">{t.usuario}</td>

                      {/* ESTADO DE PAGO */}
                      <td className="px-4 sm:px-6 py-3 text-sm">
                        {pagado ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            {esIngreso ? 'Cobrado' : 'Pagado'}
                          </span>
                        ) : metodoPago === 'Plazo' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
                              esIngreso
                                ? 'text-cyan-700 bg-cyan-100 border border-cyan-300'
                                : 'text-yellow-700 bg-yellow-100 border border-yellow-300'
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3"
                              />
                            </svg>
                            {esIngreso ? 'Por cobrar' : 'Pendiente'}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>

                      {/* 🆕 VENCIMIENTO */}
                      <td className="px-3 py-3 text-sm">
                        {(() => {
                          const vencimiento = calcularVencimiento(t.gastoCompleto)
                          
                          if (!vencimiento) {
                            return <span className="text-gray-400 text-xs">—</span>
                          }

                          const esVencido = vencimiento.diasRestantes < 0
                          const esCercano = vencimiento.diasRestantes >= 0 && vencimiento.diasRestantes <= 3

                          return (
                            <div className="flex flex-col gap-0.5 min-w-[120px]">
                              <span
                                className={`text-[11px] font-semibold leading-tight ${
                                  esVencido
                                    ? 'text-red-600'
                                    : esCercano
                                    ? 'text-orange-600'
                                    : 'text-blue-600'
                                }`}
                              >
                                {esVencido
                                  ? `⚠️ Vencido hace ${Math.abs(vencimiento.diasRestantes)} días`
                                  : esCercano
                                  ? `⏰ Faltan ${vencimiento.diasRestantes} días`
                                  : `📅 Faltan ${vencimiento.diasRestantes} días`}
                              </span>
                              <span className="text-[10px] text-gray-500 leading-tight">
                                {esVencido ? 'Venció: ' : 'Vence: '}
                                {vencimiento.fechaVencimiento}
                              </span>
                            </div>
                          )
                        })()}
                      </td>

                      {/* ACCIONES */}
                      <td className="px-4 sm:px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {t.gastoCompleto?.imageUrl && (
                            <button
                              onClick={() => {
                                setFacturaSeleccionada({
                                  imageUrl: t.gastoCompleto.imageUrl!,
                                  proveedor: t.gastoCompleto.proveedor,
                                  fecha: t.gastoCompleto.fecha,
                                  monto: t.gastoCompleto.monto,
                                  descripcion: t.gastoCompleto.descripcion,
                                })
                                setModalFacturaOpen(true)
                              }}
                              className="text-purple-600 hover:text-purple-800 transition"
                              title="Ver factura"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                          )}

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
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* Totales */}
<div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
  {/* TOTAL GASTOS */}
  <div className="bg-red-50 rounded-lg p-4">
    <div className="text-sm text-red-700 font-medium mb-1">Total Gastos</div>
    <div className="text-2xl font-bold text-red-600">
      -{(() => {
        const total = gastosFiltrados
          .filter((g) => g.tipo === 'GASTO')
          .reduce((sum, g) => {
            let montoMostrar = 0;

            if (moneda === "UYU") {
              montoMostrar = g.montoEnUYU ?? g.monto ?? 0;
            } else {
              if (g.moneda === "USD") {
                montoMostrar = g.montoOriginal ?? g.monto ?? 0;
              } else {
                const tasa = g.tasaCambio && g.tasaCambio > 0 ? g.tasaCambio : 40;
                montoMostrar = (g.montoOriginal ?? g.monto ?? 0) / tasa;
              }
            }

            return sum + montoMostrar;
          }, 0);

        return total.toFixed(0);
      })()} {moneda}
    </div>
  </div>

  {/* TOTAL INGRESOS */}
  <div className="bg-green-50 rounded-lg p-4">
    <div className="text-sm text-green-700 font-medium mb-1">Total Ingresos</div>
    <div className="text-2xl font-bold text-green-600">
      +{(() => {
        const total = gastosFiltrados
          .filter((g) => g.tipo === 'INGRESO')
          .reduce((sum, g) => {
            let montoMostrar = 0;

            if (moneda === "UYU") {
              montoMostrar = g.montoEnUYU ?? g.monto ?? 0;
            } else {
              if (g.moneda === "USD") {
                montoMostrar = g.montoOriginal ?? g.monto ?? 0;
              } else {
                const tasa = g.tasaCambio && g.tasaCambio > 0 ? g.tasaCambio : 40;
                montoMostrar = (g.montoOriginal ?? g.monto ?? 0) / tasa;
              }
            }

            return sum + montoMostrar;
          }, 0);

        return total.toFixed(0);
      })()} {moneda}
    </div>
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
                <p className="text-xs text-gray-400 mt-1">{nuevaCategoriaNombre.length}/120</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={async () => {
                  if (nuevaCategoriaNombre.trim() === '') return
                  
                  try {
                    // 🎨 Generar color único (evita los 19 colores originales)
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
                      alert(error.error || 'Error al crear categoría')
                      return
                    }

                    const nuevaCategoria = await response.json()
                    
                    setCategorias((prev) => [...prev, nuevaCategoria])
                    
                    setNuevaCategoriaNombre('')
                    setModalCategoriaOpen(false)
                    alert('✅ Categoría creada exitosamente')
                  } catch (error) {
                    console.error('Error:', error)
                    alert('Error al crear la categoría')
                  }
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

      {/* MODAL ELIMINAR */}
      {modalDeleteOpen && gastoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
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
                ¿Estás seguro que querés eliminar este{' '}
                <span className="font-medium">
                  {gastoAEliminar.tipo === 'INGRESO' ? 'ingreso' : 'gasto'}
                </span>
                ?
              </p>
              <p className="font-semibold text-gray-900 mb-1">
                {gastoAEliminar.descripcion ||
                  `${gastoAEliminar.categoria} - ${gastoAEliminar.monto.toFixed(0)}`}
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

      {/* MODAL FILTRAR POR FECHA */}
      {modalFechaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Filtrar por Fecha</h2>
              <button
                onClick={() => setModalFechaOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Rango de Fechas</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comienzo
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => {
                        setFechaInicio(e.target.value)
                        setRangoSeleccionado('Personalizado')
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fin</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => {
                        setFechaFin(e.target.value)
                        setRangoSeleccionado('Personalizado')
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {[
                    'Hoy',
                    'Últimos 7 Días',
                    'Últimos 30 Días',
                    'Últimos 90 Días',
                    'Último Año',
                    'Todos los tiempos',
                  ].map((rango) => (
                    <button
                      key={rango}
                      onClick={() => aplicarRangoFecha(rango)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                        rangoSeleccionado === rango
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rango}
                    </button>
                  ))}
                </div>

                {fechaInicio && fechaFin && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Rango Seleccionado:</span>{' '}
                      {new Date(fechaInicio).toLocaleDateString('es-UY')} -{' '}
                      {new Date(fechaFin).toLocaleDateString('es-UY')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  limpiarFiltroFecha()
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Limpiar
              </button>
              <button
                onClick={() => {
                  setModalFechaOpen(false)
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition shadow-sm"
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FACTURA */}
      {modalFacturaOpen && facturaSeleccionada && (
        <ModalFactura
          isOpen={modalFacturaOpen}
          onClose={() => {
            setModalFacturaOpen(false)
            setFacturaSeleccionada(null)
          }}
          imageUrl={facturaSeleccionada.imageUrl || ''}
          gastoData={facturaSeleccionada}
        />
      )}
    </div>
  )
}