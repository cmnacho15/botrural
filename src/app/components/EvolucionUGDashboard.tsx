'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DatosEvolucion {
  dias: string[]
  lotes: Array<{
    loteId: string
    nombre: string
    hectareas: number
    datos: number[]
    cargaPorHectarea: number[]
  }>
  global: {
    ug: number[]
    ugPorHectarea: number[]
    hectareasTotales: number
  }
}

export default function EvolucionUGDashboard() {
  const [datos, setDatos] = useState<DatosEvolucion | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mensual' | 'ejercicio'>('mensual')
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null)
  const [vistaActiva, setVistaActiva] = useState<'ug' | 'ug-ha'>('ug')

  useEffect(() => {
    cargarDatos()
  }, [periodo, loteSeleccionado])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ periodo })
      if (loteSeleccionado) params.append('loteId', loteSeleccionado)

      const response = await fetch(`/api/ug-evolution?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDatos(data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No se pudieron cargar los datos</p>
      </div>
    )
  }

  // ================================
  // PREPARAR DATOS PARA EL GRÁFICO
  // ================================
  const datosGrafico = datos.dias.map((dia, index) => {
    const punto: any = { dia }

    if (loteSeleccionado) {
      const lote = datos.lotes.find((l) => l.loteId === loteSeleccionado)
      if (lote) {
        punto['UG'] = lote.datos[index]
        punto['UG/ha'] = lote.cargaPorHectarea[index]
      }
    } else {
      if (vistaActiva === 'ug') {
        datos.lotes.forEach((lote) => {
          punto[lote.nombre] = lote.datos[index]
        })
      } else {
        datos.lotes.forEach((lote) => {
          punto[lote.nombre] = lote.cargaPorHectarea[index]
        })
      }
    }

    return punto
  })

  const colores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  return (
    <div className="space-y-6">

      {/* Controles */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📊 Evolución de Carga Animal
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="mensual">Últimos 12 meses</option>
              <option value="ejercicio">Ejercicio actual (1 Jul - 30 Jun)</option>
            </select>
          </div>

          {/* Potrero */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Potrero
            </label>
            <select
              value={loteSeleccionado || ''}
              onChange={(e) => setLoteSeleccionado(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">📍 Todos los potreros</option>
              {datos.lotes.map((lote) => (
                <option key={lote.loteId} value={lote.loteId}>
                  {lote.nombre} ({lote.hectareas} ha)
                </option>
              ))}
            </select>
          </div>

          {/* Vista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Métrica
            </label>
            <select
              value={vistaActiva}
              onChange={(e) => setVistaActiva(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="ug">UG Totales</option>
              <option value="ug-ha">UG por Hectárea</option>
            </select>
          </div>

        </div>
      </div>

      {/* ============================== */}
      {/*         GRÁFICO PRINCIPAL       */}
      {/* ============================== */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={datosGrafico}>
            
            <CartesianGrid strokeDasharray="3 3" />

<XAxis
  dataKey="dia"
  interval={0} // forzamos todos los ticks pero los filtramos manualmente
  tickFormatter={(value: string) => {
    // Mostrar solo si el día es "01" → formato "YYYY-MM"
    return value.endsWith("-01") ? value.slice(0, 7) : "";
  }}
  tick={{ fontSize: 12 }}
  angle={-45}
  textAnchor="end"
  height={80}
/>

<YAxis tick={{ fontSize: 12 }} />

<Tooltip
  labelFormatter={(value) => {
    // Mostrar fecha formateada linda en tooltip
    const d = new Date(value);
    return d.toLocaleDateString("es-UY", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }}
  contentStyle={{
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  }}
/>
            <Legend />

            {loteSeleccionado ? (
              <>
                {/* UG Total */}
                {vistaActiva === 'ug' && (
                  <Line
                    type="stepAfter"
                    dataKey="UG"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { index, payload, dataKey } = props
                      const actual = payload[dataKey]
                      const anterior = index > 0 ? datosGrafico[index - 1][dataKey] : null
                      if (actual !== anterior) {
                        return <circle cx={props.cx} cy={props.cy} r={4} fill="#3b82f6" />
                      }
                      return null
                    }}
                  />
                )}

                {/* UG/ha */}
                {vistaActiva === 'ug-ha' && (
                  <Line
                    type="stepAfter"
                    dataKey="UG/ha"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { index, payload, dataKey } = props
                      const actual = payload[dataKey]
                      const anterior = index > 0 ? datosGrafico[index - 1][dataKey] : null
                      if (actual !== anterior) {
                        return <circle cx={props.cx} cy={props.cy} r={4} fill="#10b981" />
                      }
                      return null
                    }}
                  />
                )}

              </>
            ) : (
              <>
                {datos.lotes.map((lote, index) => (
                  <Line
                    key={lote.loteId}
                    type="stepAfter"
                    dataKey={lote.nombre}
                    stroke={colores[index % colores.length]}
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { index: idx, payload, dataKey } = props
                      const actual = payload[dataKey]
                      const anterior = idx > 0 ? datosGrafico[idx - 1][dataKey] : null
                      if (actual !== anterior) {
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={3}
                            fill={colores[index % colores.length]}
                          />
                        )
                      }
                      return null
                    }}
                  />
                ))}
              </>
            )}

          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ============================== */}
      {/*         RESUMEN GLOBAL         */}
      {/* ============================== */}
      {!loteSeleccionado && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            🌍 Carga Total del Campo
          </h3>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {datos.global.ug[datos.global.ug.length - 1]?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-blue-700">
                UG Totales (último día)
              </p>
            </div>

            <div>
              <p className="text-2xl font-bold text-blue-600">
                {datos.global.ugPorHectarea[datos.global.ugPorHectarea.length - 1]?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-blue-700">
                UG/ha Promedio (último día)
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}