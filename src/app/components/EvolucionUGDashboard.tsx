'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

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
    hectareasTodasPredio: number  // 👈 AGREGAR ESTA LÍNEA
  }
}

export default function EvolucionUGDashboard() {
  const [datos, setDatos] = useState<DatosEvolucion | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mensual' | 'ejercicio'>('mensual')
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null)
  const [vistaActiva, setVistaActiva] = useState<'ug' | 'ug-ha'>('ug-ha')
  const [mostrarTemporadas, setMostrarTemporadas] = useState(true)
  const [vistaTabla, setVistaTabla] = useState(false)

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

  const exportarCSV = () => {
    if (!datos) return

    let csv = ''
    let nombreArchivo = ''

    if (loteSeleccionado) {
      const lote = datos.lotes.find(l => l.loteId === loteSeleccionado)
      if (!lote) return

      csv = `Fecha,${lote.nombre} (UG),${lote.nombre} (UG/ha)\n`
      nombreArchivo = `evolucion-${lote.nombre.replace(/\s+/g, '-')}-${periodo}`

      datos.dias.forEach((dia, index) => {
        const fecha = new Date(dia).toLocaleDateString('es-UY')
        const ug = lote.datos[index].toFixed(2)
        const ugHa = lote.cargaPorHectarea[index].toFixed(2)
        csv += `${fecha},${ug},${ugHa}\n`
      })
    } else {
      csv = 'Fecha,Todo el Campo (UG),Todo el Campo (UG/ha)\n'
      nombreArchivo = `evolucion-campo-completo-${periodo}`

      datos.dias.forEach((dia, index) => {
        const fecha = new Date(dia).toLocaleDateString('es-UY')
        const ugTotal = datos.global?.ug?.[index]?.toFixed(2) ?? '0.00'
        const ugPorHa = datos.global?.ugPorHectarea?.[index]?.toFixed(2) ?? '0.00'
        csv += `${fecha},${ugTotal},${ugPorHa}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
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

  const ticksInteligentes = datos.dias.filter(dia => dia.endsWith('-01'))

  const temporadas = []
  if (mostrarTemporadas) {
    const añoInicio = new Date(datos.dias[0]).getFullYear()
    const añoFin = new Date(datos.dias[datos.dias.length - 1]).getFullYear()
    
    for (let año = añoInicio; año <= añoFin; año++) {
      const inviernoInicio = `${año}-06-01`
      const inviernoFin = `${año}-09-30`
      
      if (datos.dias.some(d => d >= inviernoInicio && d <= inviernoFin)) {
        temporadas.push({ inicio: inviernoInicio, fin: inviernoFin, nombre: 'Invierno' })
      }
    }
  }

  const datosGrafico = datos.dias.map((dia, index) => {
    const lote = loteSeleccionado
      ? datos.lotes.find(l => l.loteId === loteSeleccionado)
      : null

    const ug = lote ? lote.datos[index] : datos.global.ug[index]
    const ugHa = lote ? lote.cargaPorHectarea[index] : datos.global.ugPorHectarea[index]

    return {
      dia,
      'UG Totales': ug ?? 0,
      'UG/ha': ugHa ?? 0
    }
  })

  const calcularEstadisticas = () => {
    if (!datos) return null

    if (loteSeleccionado) {
      const lote = datos.lotes.find(l => l.loteId === loteSeleccionado)
      if (!lote) return null

      if (vistaActiva === 'ug-ha') {
        const ugHaUltimoMes = lote.cargaPorHectarea.slice(-30)
        const ugHaUltimoTrimestre = lote.cargaPorHectarea.slice(-90)

        return {
          promedioMes: (ugHaUltimoMes.reduce((a, b) => a + b, 0) / ugHaUltimoMes.length).toFixed(2),
          promedioTrimestre: (ugHaUltimoTrimestre.reduce((a, b) => a + b, 0) / ugHaUltimoTrimestre.length).toFixed(2),
          actual: lote.cargaPorHectarea[lote.cargaPorHectarea.length - 1].toFixed(2),
          cargaHaActual: lote.cargaPorHectarea[lote.cargaPorHectarea.length - 1].toFixed(2),
        }
      } else {
        const ugUltimoMes = lote.datos.slice(-30)
        const ugUltimoTrimestre = lote.datos.slice(-90)

        return {
          promedioMes: (ugUltimoMes.reduce((a, b) => a + b, 0) / ugUltimoMes.length).toFixed(2),
          promedioTrimestre: (ugUltimoTrimestre.reduce((a, b) => a + b, 0) / ugUltimoTrimestre.length).toFixed(2),
          actual: lote.datos[lote.datos.length - 1].toFixed(2),
          cargaHaActual: lote.cargaPorHectarea[lote.cargaPorHectarea.length - 1].toFixed(2),
        }
      }
    }

    if (vistaActiva === 'ug-ha') {
      const ugHaUltimoMes = datos.global.ugPorHectarea.slice(-30)
      const ugHaUltimoTrimestre = datos.global.ugPorHectarea.slice(-90)

      return {
        promedioMes: (ugHaUltimoMes.reduce((a, b) => a + b, 0) / ugHaUltimoMes.length).toFixed(2),
        promedioTrimestre: (ugHaUltimoTrimestre.reduce((a, b) => a + b, 0) / ugHaUltimoTrimestre.length).toFixed(2),
        actual: datos.global.ugPorHectarea[datos.global.ugPorHectarea.length - 1].toFixed(2),
        cargaHaActual: datos.global.ugPorHectarea[datos.global.ugPorHectarea.length - 1].toFixed(2),
      }
    } else {
      const ugUltimoMes = datos.global.ug.slice(-30)
      const ugUltimoTrimestre = datos.global.ug.slice(-90)

      return {
        promedioMes: (ugUltimoMes.reduce((a, b) => a + b, 0) / ugUltimoMes.length).toFixed(2),
        promedioTrimestre: (ugUltimoTrimestre.reduce((a, b) => a + b, 0) / ugUltimoTrimestre.length).toFixed(2),
        actual: datos.global.ug[datos.global.ug.length - 1].toFixed(2),
        cargaHaActual: datos.global.ugPorHectarea[datos.global.ugPorHectarea.length - 1].toFixed(2),
      }
    }
  }

  const estadisticas = calcularEstadisticas()

  const dotUG = (props: any) => {
    const { index, payload, cx, cy } = props
    const actual = payload['UG Totales']
    const anterior = index > 0 ? datosGrafico[index - 1]['UG Totales'] : null

    const cambioSignificativo = anterior && Math.abs((actual - anterior) / anterior) > 0.05
    const esPrimerDiaMes = payload.dia.endsWith('-01')

    return cambioSignificativo || esPrimerDiaMes ? (
      <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="white" strokeWidth={2} />
    ) : null
  }

  const dotUGha = (props: any) => {
    const { index, payload, cx, cy } = props
    const actual = payload['UG/ha']
    const anterior = index > 0 ? datosGrafico[index - 1]['UG/ha'] : null

    const cambioSignificativo = anterior && Math.abs((actual - anterior) / anterior) > 0.05
    const esPrimerDiaMes = payload.dia.endsWith('-01')

    return cambioSignificativo || esPrimerDiaMes ? (
      <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="white" strokeWidth={2} />
    ) : null
  }

  const dotUGcampo = (props: any) => {
    const { index, payload, cx, cy } = props
    const actual = payload['UG Totales']
    const anterior = index > 0 ? datosGrafico[index - 1]['UG Totales'] : null

    const cambioSignificativo = anterior && Math.abs((actual - anterior) / anterior) > 0.05
    const esPrimerDiaMes = payload.dia.endsWith('-01')

    return cambioSignificativo || esPrimerDiaMes ? (
      <circle cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={2} />
    ) : null
  }

  const dotUGhaCampo = (props: any) => {
    const { index, payload, cx, cy } = props
    const actual = payload['UG/ha']
    const anterior = index > 0 ? datosGrafico[index - 1]['UG/ha'] : null

    const cambioSignificativo = anterior && Math.abs((actual - anterior) / anterior) > 0.05
    const esPrimerDiaMes = payload.dia.endsWith('-01')

    return cambioSignificativo || esPrimerDiaMes ? (
      <circle cx={cx} cy={cy} r={5} fill="#10b981" stroke="white" strokeWidth={2} />
    ) : null
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null

    const fecha = new Date(label)
    const mes = fecha.toLocaleDateString('es-UY', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric' 
    })

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2 text-sm">{mes}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between gap-4 text-sm">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}:
            </span>
            <span className="font-mono font-semibold">
              {entry.value.toFixed(2)} {vistaActiva === 'ug' ? 'UG' : 'UG/ha'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CONTROLES */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Evolución de Carga Animal
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setVistaTabla(!vistaTabla)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              {vistaTabla ? 'Ver Gráfico' : 'Ver Tabla'}
            </button>
            <button
              onClick={exportarCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              onChange={(e) => {
                const valor = e.target.value
                setLoteSeleccionado(valor === '' ? null : valor)
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Campo completo (SPG)</option>
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
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ug">UG Totales</option>
              <option value="ug-ha">UG por Hectárea</option>
            </select>
          </div>
        </div>

        {/* Opciones de visualización */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarTemporadas}
              onChange={(e) => setMostrarTemporadas(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">Marcar temporadas</span>
          </label>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Actual</p>
            <p className="text-2xl font-bold text-blue-900">
              {vistaActiva === 'ug' ? estadisticas.actual : estadisticas.cargaHaActual}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {vistaActiva === 'ug' ? 'UG totales' : 'UG/ha'}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Promedio 30 días</p>
            <p className="text-2xl font-bold text-green-900">{estadisticas.promedioMes}</p>
            <p className="text-xs text-green-600 mt-1">
              {vistaActiva === 'ug' ? 'UG' : 'UG/ha'}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700 mb-1">Promedio 90 días</p>
            <p className="text-2xl font-bold text-purple-900">{estadisticas.promedioTrimestre}</p>
            <p className="text-xs text-purple-600 mt-1">
              {vistaActiva === 'ug' ? 'UG' : 'UG/ha'}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-700 mb-1">Superficie</p>
            <p className="text-2xl font-bold text-orange-900">
              {loteSeleccionado 
  ? datos.lotes.find(l => l.loteId === loteSeleccionado)?.hectareas.toFixed(2)
  : datos.global.hectareasTotales.toFixed(2)}
            </p>
            <p className="text-xs text-orange-600 mt-1">hectáreas</p>
          </div>
        </div>
      )}

      {/* VISTA DE TABLA */}
      {vistaTabla ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Fecha</th>

                {loteSeleccionado ? (
                  <>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      {datos.lotes.find(l => l.loteId === loteSeleccionado)?.nombre} (UG)
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">
                      {datos.lotes.find(l => l.loteId === loteSeleccionado)?.nombre} (UG/ha)
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Todo el Campo (UG)</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Todo el Campo (UG/ha)</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {datos.dias.map((dia, index) => (
                <tr key={dia} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-600">
                    {new Date(dia).toLocaleDateString('es-UY')}
                  </td>

                  {loteSeleccionado ? (
                    <>
                      <td className="text-right py-2 px-3 font-mono text-gray-900">
                        {datos.lotes.find(l => l.loteId === loteSeleccionado)?.datos[index].toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-gray-900">
                        {datos.lotes.find(l => l.loteId === loteSeleccionado)?.cargaPorHectarea[index].toFixed(2)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-right py-2 px-3 font-mono text-gray-900">
                        {datos.global?.ug?.[index]?.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-gray-900">
                        {datos.global?.ugPorHectarea?.[index]?.toFixed(2) ?? '0.00'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (

        /* GRÁFICO PRINCIPAL */
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <ResponsiveContainer width="100%" height={450}>
            <LineChart 
              data={datosGrafico}
              key={`${loteSeleccionado}-${vistaActiva}`}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              {/* Bandas de temporadas */}
              {temporadas.map((temp, idx) => (
                <ReferenceArea
                  key={idx}
                  x1={temp.inicio}
                  x2={temp.fin}
                  fill="#bfdbfe"
                  fillOpacity={0.15}
                  label={{
                    value: 'Invierno',
                    position: 'top',
                    fill: '#3b82f6',
                    fontSize: 11,
                  }}
                />
              ))}

              {/* Línea recomendada */}
              {vistaActiva === 'ug-ha' && (
                <ReferenceLine
                  y={1.2}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{
                    value: 'Carga máx. recomendada',
                    position: 'right',
                    fill: '#ef4444',
                    fontSize: 10,
                  }}
                />
              )}

              {/* Ejes */}
              <XAxis
                dataKey="dia"
                ticks={ticksInteligentes}
                tickFormatter={(value) => {
                  const [y, m] = value.split('-')
                  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                  return meses[parseInt(m) - 1]
                }}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                height={40}
              />

              <YAxis 
                domain={[0, 'auto']}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                label={{
                  value: vistaActiva === 'ug' ? 'UG Totales' : 'UG/ha',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#374151', fontSize: 12 }
                }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 20 }} iconType="line" />

              <Line
                type="stepAfter"
                dataKey={vistaActiva === 'ug' ? 'UG Totales' : 'UG/ha'}
                stroke={vistaActiva === 'ug' ? '#3b82f6' : '#10b981'}
                strokeWidth={loteSeleccionado ? 2 : 3}
                dot={
                  loteSeleccionado
                    ? vistaActiva === 'ug' ? dotUG : dotUGha
                    : vistaActiva === 'ug' ? dotUGcampo : dotUGhaCampo
                }
                name={
                  loteSeleccionado
                    ? undefined
                    : vistaActiva === 'ug'
                    ? 'UG Totales del Campo'
                    : 'UG/ha Promedio del Campo'
                }
                isAnimationActive={false}
              />

            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RESUMEN GLOBAL */}
{!loteSeleccionado && (
  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
    <h3 className="font-semibold text-blue-900 mb-4 text-lg">Resumen del Campo</h3>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-blue-600">{datos.lotes.length}</p>
        <p className="text-sm text-blue-700 mt-1">Potreros</p>
      </div>

      <div className="text-center">
        <p className="text-3xl font-bold text-blue-600">
          {datos.global?.hectareasTodasPredio?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-sm text-blue-700 mt-1">Hectáreas totales del predio</p>
      </div>

      <div className="text-center">
        <p className="text-3xl font-bold text-blue-600">
          {datos.global?.hectareasTotales?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-sm text-blue-700 mt-1">SPG (ha pastoreables)</p>
      </div>

      <div className="text-center">
        <p className="text-3xl font-bold text-blue-600">
          {datos.global?.ug?.[datos.global.ug.length - 1]?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-sm text-blue-700 mt-1">UG Totales hoy</p>
      </div>

      <div className="text-center">
        <p className="text-3xl font-bold text-blue-600">
          {datos.global?.ugPorHectarea?.[datos.global.ugPorHectarea.length - 1]?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-sm text-blue-700 mt-1">UG/ha promedio hoy</p>
      </div>
    </div>
  </div>
)}

      {/* LEYENDA */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Guía de interpretación</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>Línea escalonada:</strong> Cambios por altas/bajas</li>
          <li>• <strong>Puntos marcados:</strong> Cambios superiores al 5% o inicio de mes</li>
          <li>• <strong>Bandas azules:</strong> Invierno</li>
          <li>• <strong>Línea roja:</strong> Máxima recomendada (1.2 UG/ha)</li>
        </ul>
      </div>
    </div>
  )
}