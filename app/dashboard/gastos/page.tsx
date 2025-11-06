'use client'

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

  const categoriasConDatos = categorias.map((cat) => {
    const gastosCategoria = gastosDB.filter((g) => g.categoria === cat.nombre)
    return {
      ...cat,
      cantidad: gastosCategoria.length,
      total: gastosCategoria.reduce((sum, g) => sum + g.monto, 0),
    }
  })

  const categoriasVisibles = mostrarTodasCategorias
    ? categoriasConDatos
    : categoriasConDatos.slice(0, 9)

  const totalGastos = gastosDB.reduce((sum, g) => sum + g.monto, 0)

  const gastosTabla = gastosDB.map((gasto) => {
    const categoria = categorias.find((c) => c.nombre === gasto.categoria)
    return {
      id: gasto.id,
      fecha: new Date(gasto.fecha).toLocaleDateString('es-UY'),
      precio: -gasto.monto,
      item: gasto.descripcion?.split(' - ')[0] || 'Sin descripción',
      categoria: gasto.categoria,
      color: categoria?.color || '#6b7280',
      usuario: 'Nacho Rodriguez',
    }
  })

  useEffect(() => {
    const modal = searchParams.get('modal')
    if (modal === 'gasto') setModalGastoOpen(true)
  }, [searchParams])

  const handleAgregarItem = () => {
    const nuevoItem: Item = {
      id: Date.now().toString(),
      nombre: '',
      categoria: '',
      precio: 0,
      iva: 0,
      precioFinal: 0,
    }
    setItems([...items, nuevoItem])
  }

  const handleEliminarItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id))
  }

  const handleItemChange = (id: string, field: keyof Item, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === 'precio' || field === 'iva') {
            const precio = field === 'precio' ? parseFloat(value) || 0 : updated.precio
            const ivaVal = field === 'iva' ? parseFloat(value) || 0 : updated.iva
            updated.precioFinal = precio + (precio * ivaVal) / 100
          }
          return updated
        }
        return item
      })
    )
  }

  const calcularMontoTotal = () =>
    items.reduce((sum, i) => sum + i.precioFinal, 0)

  const handleConfirmarGasto = async () => {
    if (!proveedor) {
      alert('Por favor ingresá un proveedor')
      return
    }

    const itemsValidos = items.filter((i) => i.nombre && i.categoria && i.precio > 0)
    if (itemsValidos.length === 0) {
      alert('Agregá al menos un ítem válido')
      return
    }

    setLoading(true)
    try {
      for (const item of itemsValidos) {
        await addGasto({
          tipo: 'GASTO',
          monto: item.precioFinal,
          fecha,
          descripcion: `${item.nombre} - Proveedor: ${proveedor}${notas ? ` - ${notas}` : ''}`,
          categoria: item.categoria,
          metodoPago: 'efectivo',
        })
      }

      setModalGastoOpen(false)
      setProveedor('')
      setItems([{ id: '1', nombre: '', categoria: '', precio: 0, iva: 0, precioFinal: 0 }])
      setNotas('')
      alert('¡Gasto registrado exitosamente!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Gastos</h1>

        <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
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

          {/* Período */}
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm">
            📅 <span>Último Año</span>
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Categorías */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Categorías de Gastos</h2>
              <button
                onClick={() => setModalCategoriaOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600"
              >
                +
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-3 py-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Todos los gastos</span>
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">{gastosDB.length}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{totalGastos} {moneda}</span>
              </div>

              {categoriasVisibles.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center px-3 py-3 hover:bg-gray-50 rounded-lg cursor-pointer">
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
                </div>
              ))}

              <button
                onClick={() => setMostrarTodasCategorias(!mostrarTodasCategorias)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-3"
              >
                {mostrarTodasCategorias ? 'Colapsar' : 'Ver más categorías'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de gastos */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Gastos Registrados</h2>

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
                {gastosTabla.map((gasto, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3">{gasto.fecha}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="text-gray-900 font-medium">{gasto.precio}</div>
                      <div className="text-xs text-gray-500">{moneda}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-3">{gasto.item}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: `${gasto.color}15`, color: gasto.color }}>
                        {gasto.categoria}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3">{gasto.usuario}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-gray-400">✏️</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL NUEVA CATEGORÍA */}
      {modalCategoriaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Nueva categoría de gastos</h2>
              <button
                onClick={() => setModalCategoriaOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
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
                className={`px-6 py-3 rounded-lg text-white font-medium transition ${
                  nuevaCategoriaNombre.trim() === ''
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GastosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando gastos...</p>
        </div>
      </div>
    }>
      <GastosContent />
    </Suspense>
  )
}