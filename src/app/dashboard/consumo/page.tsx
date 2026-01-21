'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import ModalConsumo from '@/app/components/modales/ModalConsumo'
import ModalEsquila from '@/app/components/modales/ModalEsquila'

// ============================================
// TIPOS - CONSUMO
// ============================================
type ConsumoRenglon = {
  id: string
  tipoAnimal: string
  categoria: string
  cantidad: number
  pesoPromedio: number | null
  precioKgUSD: number | null
  precioAnimalUSD: number | null
  pesoTotalKg: number | null
  valorTotalUSD: number | null
  consumo: {
    fecha: string
  }
  animalLote: {
    lote: {
      nombre: string
    }
  } | null
}

type Consumo = {
  id: string
  fecha: string
  descripcion: string | null
  renglones: ConsumoRenglon[]
}

type ConsumoAgrupado = {
  categoria: string
  totalAnimales: number
  totalKg: number
  totalUSD: number
  renglones: ConsumoRenglon[]
}

// ============================================
// FETCHER PARA SWR
// ============================================
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function ConsumoYLanaPage() {
  const { data: session } = useSession()
  
  // Estados de acordeones
  const [consumosAbierto, setConsumosAbierto] = useState(true)
  const [lanaAbierto, setLanaAbierto] = useState(false)
  
  // Estados de modales
  const [modalConsumo, setModalConsumo] = useState(false)
  const [modalEsquila, setModalEsquila] = useState(false)

  // ============================================
  // LÓGICA DE CONSUMOS
  // ============================================
  const [consumos, setConsumos] = useState<Consumo[]>([])
  const [loadingConsumos, setLoadingConsumos] = useState(true)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set())
  const [valoresLocales, setValoresLocales] = useState<{ [key: string]: { peso?: string, precio?: string } }>({})
  const timeoutRefs = useState<{ [key: string]: NodeJS.Timeout }>({})[0]

  useEffect(() => {
    cargarConsumos()
  }, [])

  const cargarConsumos = async () => {
    try {
      const res = await fetch('/api/consumos')
      const data: Consumo[] = await res.json()
      
      const consumosConFecha = data.map(consumo => ({
        ...consumo,
        renglones: consumo.renglones.map(renglon => ({
          ...renglon,
          consumo: { fecha: consumo.fecha }
        }))
      }))
      
      setConsumos(consumosConFecha)
    } catch (error) {
      console.error('Error al cargar consumos:', error)
      alert('Error al cargar los consumos')
    } finally {
      setLoadingConsumos(false)
    }
  }

  const handlePesoChange = (id: string, nuevoPeso: string) => {
    setValoresLocales(prev => ({
      ...prev,
      [id]: { ...prev[id], peso: nuevoPeso }
    }))

    if (timeoutRefs[id]) {
      clearTimeout(timeoutRefs[id])
    }

    timeoutRefs[id] = setTimeout(() => {
      const peso = parseFloat(nuevoPeso) || null
      actualizarRenglon(id, { pesoPromedio: peso })
    }, 800)
  }

  const handlePrecioKgChange = (id: string, nuevoPrecio: string) => {
    setValoresLocales(prev => ({
      ...prev,
      [id]: { ...prev[id], precio: nuevoPrecio }
    }))

    if (timeoutRefs[id + '-precio']) {
      clearTimeout(timeoutRefs[id + '-precio'])
    }

    timeoutRefs[id + '-precio'] = setTimeout(() => {
      const precio = parseFloat(nuevoPrecio) || null
      actualizarRenglon(id, { precioKgUSD: precio })
    }, 800)
  }

  const actualizarRenglon = async (id: string, datos: { pesoPromedio?: number | null, precioKgUSD?: number | null }) => {
    try {
      const res = await fetch(`/api/consumos/renglones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })

      if (!res.ok) throw new Error('Error al actualizar')

      await cargarConsumos()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el consumo')
    }
  }

  const eliminarRenglon = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este consumo?')) return

    try {
      const res = await fetch(`/api/consumos/renglones/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Error al eliminar')

      await cargarConsumos()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar el consumo')
    }
  }

  const eliminarCategoria = async (tipoAnimal: string, categoria: string, renglones: ConsumoRenglon[]) => {
    const cantidad = renglones.length
    const totalAnimales = renglones.reduce((sum, r) => sum + r.cantidad, 0)
    
    if (!confirm(`¿Estás seguro de eliminar TODOS los consumos de ${categoria}?\n\n` +
                 `Se eliminarán ${cantidad} registro(s) con un total de ${totalAnimales} animales.`)) {
      return
    }

    try {
      await Promise.all(
        renglones.map(renglon => 
          fetch(`/api/consumos/renglones/${renglon.id}`, { method: 'DELETE' })
        )
      )

      await cargarConsumos()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar la categoría')
    }
  }

  const agruparPorTipoYCategoria = () => {
    const agrupado: { [tipoAnimal: string]: ConsumoAgrupado[] } = {}

    consumos.forEach(consumo => {
      consumo.renglones.forEach(renglon => {
        const tipo = renglon.tipoAnimal || 'OTRO'
        
        if (!agrupado[tipo]) {
          agrupado[tipo] = []
        }

        let categoriaExistente = agrupado[tipo].find(c => c.categoria === renglon.categoria)
        
        if (!categoriaExistente) {
          categoriaExistente = {
            categoria: renglon.categoria,
            totalAnimales: 0,
            totalKg: 0,
            totalUSD: 0,
            renglones: []
          }
          agrupado[tipo].push(categoriaExistente)
        }

        categoriaExistente.totalAnimales += renglon.cantidad
        categoriaExistente.totalKg += renglon.pesoTotalKg || 0
        categoriaExistente.totalUSD += renglon.valorTotalUSD || 0
        categoriaExistente.renglones.push(renglon)
      })
    })

    return agrupado
  }

  const toggleDetalleCategoria = (tipoAnimal: string, categoria: string) => {
    const key = `${tipoAnimal}-${categoria}`
    setCategoriasExpandidas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(key)) {
        nuevo.delete(key)
      } else {
        nuevo.add(key)
      }
      return nuevo
    })
  }

  const getNombreTipo = (tipo: string) => {
    const nombres: { [key: string]: string } = {
      'BOVINO': 'Vacuno',
      'OVINO': 'Ovino',
      'EQUINO': 'Equino',
      'OTRO': 'Otros'
    }
    return nombres[tipo] || tipo
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const consumosAgrupados = agruparPorTipoYCategoria()

  // ============================================
  // LÓGICA DE STOCK LANA
  // ============================================
  const { data: esquilas, mutate: mutateEsquilas, isLoading: loadingLana } = useSWR('/api/esquilas', fetcher)

  // Calcular totales de stock actual
  const stockActual = esquilas?.reduce(
    (acc: any, esquila: any) => {
      esquila.categorias.forEach((cat: any) => {
        const disponible = Number(cat.pesoKg) - Number(cat.pesoVendido)
        
        if (!acc.categorias[cat.categoria]) {
          acc.categorias[cat.categoria] = 0
        }
        
        acc.categorias[cat.categoria] += disponible
        acc.totalKg += disponible
      })
      
      return acc
    },
    { totalKg: 0, categorias: {} }
  )

  // Precio de referencia promedio ponderado
  const precioRefPromedio = esquilas?.reduce((acc: number, esq: any) => {
    const pesoDisponible = esq.disponible || 0
    return acc + (Number(esq.precioRefUSD) * pesoDisponible)
  }, 0) / (stockActual?.totalKg || 1)

  const valorEstimado = (stockActual?.totalKg || 0) * (precioRefPromedio || 0)

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-blue-100 flex items-center justify-center text-2xl">
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consumo y Lana</h1>
            <p className="text-sm text-gray-600">Gestión de consumos y stock de lana</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setModalConsumo(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Nuevo Consumo
          </button>
          <button
            onClick={() => setModalEsquila(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Registrar Esquila
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* ACORDEÓN CONSUMOS */}
      {/* ============================================ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-6 overflow-hidden">
        <button
          onClick={() => setConsumosAbierto(!consumosAbierto)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥩</span>
            <h2 className="text-xl font-bold text-gray-900">CONSUMOS</h2>
          </div>
          <span className="text-gray-400 text-xl">
            {consumosAbierto ? '▼' : '▶'}
          </span>
        </button>
        
        {consumosAbierto && (
          <div className="border-t border-gray-200 p-6">
            {loadingConsumos ? (
              <div className="text-center py-8">
                <div className="text-gray-600">Cargando consumos...</div>
              </div>
            ) : Object.keys(consumosAgrupados).length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-gray-600">No hay consumos registrados aún</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.keys(consumosAgrupados).sort((a, b) => {
                  const orden = { 'OVINO': 1, 'BOVINO': 2, 'OTRO': 3 }
                  return (orden[a as keyof typeof orden] || 99) - (orden[b as keyof typeof orden] || 99)
                }).map(tipoAnimal => {
                  const nombreTipo = getNombreTipo(tipoAnimal)
                  const categorias = consumosAgrupados[tipoAnimal]
                  
                  const totalesGenerales = categorias.reduce((acc, cat) => ({
                    animales: acc.animales + cat.totalAnimales,
                    kg: acc.kg + cat.totalKg,
                    usd: acc.usd + cat.totalUSD
                  }), { animales: 0, kg: 0, usd: 0 })
                  
                  return (
                    <div key={tipoAnimal} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="bg-amber-500 px-6 py-3">
                        <h2 className="text-lg font-bold text-white">{nombreTipo}</h2>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-[25%]" />
                            <col className="w-[12%]" />
                            <col className="w-[15%]" />
                            <col className="w-[15%]" />
                            <col className="w-[16%]" />
                            <col className="w-[17%]" />
                          </colgroup>
                          <thead className="bg-yellow-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Categoría</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nº Animales</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">kg totales</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-yellow-200">U$S totales</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700" colSpan={2}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categorias.map((categoria) => {
                              const key = `${tipoAnimal}-${categoria.categoria}`
                              const estaExpandido = categoriasExpandidas.has(key)
                              
                              return (
                                <>
                                  <tr key={categoria.categoria} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{categoria.categoria}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{categoria.totalAnimales}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">{categoria.totalKg.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 bg-yellow-50">{categoria.totalUSD.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => toggleDetalleCategoria(tipoAnimal, categoria.categoria)}
                                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                                      >
                                        {estaExpandido ? '▲ Ocultar' : '▼ Ver detalle'}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => eliminarCategoria(tipoAnimal, categoria.categoria, categoria.renglones)}
                                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
                                        title="Eliminar todos los consumos de esta categoría"
                                      >
                                        🗑️ Eliminar todo
                                      </button>
                                    </td>
                                  </tr>

                                  {estaExpandido && categoria.renglones.map((renglon) => (
                                    <tr key={renglon.id} className="bg-blue-50 border-b border-blue-100">
                                      <td className="px-8 py-2 text-xs text-gray-600">
                                        📅 {formatearFecha(renglon.consumo.fecha)}
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-700">{renglon.cantidad}</td>
                                      <td className="px-4 py-2 text-xs bg-blue-100" colSpan={2}>
                                        <div className="flex gap-2 items-center">
                                          <input
                                            type="number"
                                            step="0.1"
                                            value={valoresLocales[renglon.id]?.peso !== undefined ? valoresLocales[renglon.id].peso : (renglon.pesoPromedio || '')}
                                            onChange={(e) => handlePesoChange(renglon.id, e.target.value)}
                                            placeholder="kg"
                                            className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                          <span className="text-gray-600">kg</span>
                                          <span className="mx-2">|</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={valoresLocales[renglon.id]?.precio !== undefined ? valoresLocales[renglon.id].precio : (renglon.precioKgUSD || '')}
                                            onChange={(e) => handlePrecioKgChange(renglon.id, e.target.value)}
                                            placeholder="U$S"
                                            className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                          <span className="text-gray-600">U$S/kg</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-600">
                                        {renglon.valorTotalUSD?.toFixed(2) || '0.00'} U$S | {renglon.pesoTotalKg?.toFixed(2) || '0.00'} kg
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                        <button
                                          onClick={() => eliminarRenglon(renglon.id)}
                                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                          title="Eliminar este consumo"
                                        >
                                          🗑️
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              )
                            })}

                            <tr className="bg-amber-100 font-bold">
                              <td className="px-4 py-3 text-sm">TOTAL</td>
                              <td className="px-4 py-3 text-sm">{totalesGenerales.animales}</td>
                              <td className="px-4 py-3 text-sm">{totalesGenerales.kg.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm">{totalesGenerales.usd.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm" colSpan={2}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* ACORDEÓN STOCK LANA */}
      {/* ============================================ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <button
          onClick={() => setLanaAbierto(!lanaAbierto)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐑</span>
            <h2 className="text-xl font-bold text-gray-900">STOCK DE LANA</h2>
          </div>
          <span className="text-gray-400 text-xl">
            {lanaAbierto ? '▼' : '▶'}
          </span>
        </button>
        
        {lanaAbierto && (
          <div className="border-t border-gray-200 p-6">
            {loadingLana ? (
              <div className="text-center py-8">
                <div className="text-gray-600">Cargando stock de lana...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* RESUMEN ACTUAL */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Stock Actual</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-gray-600 mb-1">Total en Stock</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {stockActual?.totalKg?.toLocaleString('es-UY', { maximumFractionDigits: 0 }) || 0} kg
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-gray-600 mb-1">Valor Estimado</p>
                      <p className="text-3xl font-bold text-green-600">
                        ${valorEstimado?.toLocaleString('es-UY', { maximumFractionDigits: 0 }) || 0}
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm text-gray-600 mb-1">Precio Ref. Promedio</p>
                      <p className="text-3xl font-bold text-gray-700">
                        ${precioRefPromedio?.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}/kg
                      </p>
                    </div>
                  </div>

                  {/* DESGLOSE POR CATEGORÍA */}
                  {stockActual && Object.keys(stockActual.categorias).length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Por Categoría:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(stockActual.categorias).map(([categoria, kg]: [string, any]) => (
                          <div key={categoria} className="flex items-center gap-2">
                            <span className="text-2xl">•</span>
                            <div>
                              <p className="text-sm font-medium text-gray-700">{categoria}</p>
                              <p className="text-lg font-bold text-gray-900">
                                {kg?.toLocaleString('es-UY', { maximumFractionDigits: 0 })} kg
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!stockActual || stockActual.totalKg === 0) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <p className="text-yellow-800">
                        No hay stock de lana registrado. Registrá tu primera esquila para comenzar.
                      </p>
                    </div>
                  )}
                </div>

                {/* HISTORIAL DE ESQUILAS */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Historial de Esquilas</h3>
                  
                  {!esquilas || esquilas.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No hay esquilas registradas</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full bg-white rounded-lg shadow">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Fecha</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Animales</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total kg</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Disponible</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">% Stock</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Precio Ref.</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {esquilas.map((esquila: any) => {
                            const porcentaje = esquila.porcentajeDisponible || 0
                            let estadoColor = 'bg-green-100 text-green-800'
                            let estadoTexto = '🟢 En Stock'
                            
                            if (porcentaje < 100 && porcentaje > 0) {
                              estadoColor = 'bg-yellow-100 text-yellow-800'
                              estadoTexto = '🟡 Parcial'
                            } else if (porcentaje === 0) {
                              estadoColor = 'bg-red-100 text-red-800'
                              estadoTexto = '🔴 Vendida'
                            }

                            return (
                              <tr key={esquila.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-700">
                                  {new Date(esquila.fecha).toLocaleDateString('es-UY')}
                                </td>
                                <td className="px-4 py-3 text-center font-medium text-gray-900">
                                  {esquila.nroAnimales.toLocaleString('es-UY')}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {esquila.totalKg?.toLocaleString('es-UY', { maximumFractionDigits: 0 })} kg
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                  {esquila.disponible?.toLocaleString('es-UY', { maximumFractionDigits: 0 })} kg
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {porcentaje.toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  ${Number(esquila.precioRefUSD).toFixed(2)}/kg
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${estadoColor}`}>
                                    {estadoTexto}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MODALES */}
      {/* ============================================ */}
      {modalConsumo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <ModalConsumo
              onClose={() => setModalConsumo(false)}
              onSuccess={() => {
                cargarConsumos()
                setModalConsumo(false)
              }}
            />
          </div>
        </div>
      )}
      
      {modalEsquila && (
        <ModalEsquila
          isOpen={modalEsquila}
          onClose={() => setModalEsquila(false)}
          onSuccess={() => {
            mutateEsquilas()
            setModalEsquila(false)
          }}
        />
      )}
    </div>
  )
}