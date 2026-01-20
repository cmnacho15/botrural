'use client'

import { useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function StockLanaPage() {
  const [modalEsquilaAbierto, setModalEsquilaAbierto] = useState(false)

  // Fetch esquilas
  const { data: esquilas, mutate, isLoading } = useSWR('/api/esquilas', fetcher)

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando stock de lana...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧶 Stock de Lana</h1>
          <p className="text-gray-600">Gestión de esquilas e inventario de lana</p>
        </div>
        <button
          onClick={() => setModalEsquilaAbierto(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg transition flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Registrar Esquila
        </button>
      </div>

      {/* RESUMEN ACTUAL */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md border border-blue-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Stock Actual</h2>
        
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

        {/* MENSAJE SI NO HAY STOCK */}
        {(!stockActual || stockActual.totalKg === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-yellow-800">
              No hay stock de lana registrado. Registrá tu primera esquila para comenzar.
            </p>
          </div>
        )}
      </div>

      {/* HISTORIAL DE ESQUILAS */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">📋 Historial de Esquilas</h2>
        </div>
        
        <div className="p-6">
          {!esquilas || esquilas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No hay esquilas registradas</p>
              <button
                onClick={() => setModalEsquilaAbierto(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Registrar primera esquila
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Animales</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total kg</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Disponible</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">% Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Precio Ref.</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Acciones</th>
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
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${estadoColor}`}>
                            {estadoTexto}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            Ver Detalle
                          </button>
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

      {/* MODAL REGISTRAR ESQUILA - Por ahora placeholder */}
      {modalEsquilaAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Registrar Nueva Esquila</h3>
            <p className="text-gray-600 mb-4">Modal en construcción...</p>
            <button
              onClick={() => setModalEsquilaAbierto(false)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}