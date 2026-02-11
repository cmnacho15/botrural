//src/app/components/EvolucionUGDashboard.tsx

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
  const fechaExportacion = new Date().toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  const periodoTexto = periodo === 'mensual' ? 'Últimos 12 meses' : 'Ejercicio actual (1 Jul - 30 Jun)'

  if (loteSeleccionado) {
    const lote = datos.lotes.find(l => l.loteId === loteSeleccionado)
    if (!lote) return

    // ENCABEZADO para potrero específico
    csv = `EVOLUCIÓN DE CARGA ANIMAL - ${lote.nombre.toUpperCase()}\n`
    csv += `Período:;${periodoTexto}\n`
    csv += `Exportado:;${fechaExportacion}\n`
    csv += `Superficie del potrero:;${lote.hectareas.toFixed(2)} ha\n`
    csv += `\n`
    csv += `Fecha;UG Totales;UG/ha\n`

    nombreArchivo = `evolucion-${lote.nombre.replace(/\s+/g, '-')}-${periodo}`

    datos.dias.forEach((dia, index) => {
      const fecha = new Date(dia).toLocaleDateString('es-UY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const ug = lote.datos[index].toFixed(2)
      const ugHa = lote.cargaPorHectarea[index].toFixed(2)
      csv += `${fecha};${ug};${ugHa}\n`
    })
  } else {
    // ENCABEZADO para campo completo
    csv = `EVOLUCIÓN DE CARGA ANIMAL - CAMPO COMPLETO (SPG)\n`
    csv += `Período:;${periodoTexto}\n`
    csv += `Exportado:;${fechaExportacion}\n`
    csv += `SPG (Superficie de Pastoreo Ganadero):;${datos.global.hectareasTotales.toFixed(2)} ha\n`
    csv += `Hectáreas totales del predio:;${datos.global.hectareasTodasPredio?.toFixed(2) ?? '0.00'} ha\n`
    csv += `Cantidad de potreros:;${datos.lotes.length}\n`
    csv += `\n`
    csv += `Fecha;UG Totales;UG/ha\n`

    nombreArchivo = `evolucion-campo-completo-${periodo}`

    datos.dias.forEach((dia, index) => {
      const fecha = new Date(dia).toLocaleDateString('es-UY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const ugTotal = datos.global?.ug?.[index]?.toFixed(2) ?? '0.00'
      const ugPorHa = datos.global?.ugPorHectarea?.[index]?.toFixed(2) ?? '0.00'
      csv += `${fecha};${ugTotal};${ugPorHa}\n`
    })
  }

  // Generar archivo con BOM para que Excel reconozca UTF-8
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
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
      <div className="flex items-center justify-center h-96" style={{ colorScheme: 'light' }}>
        <div className="animate-spin rounded-full h-12 w-12" style={{ borderWidth: '2px', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }}></div>
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="rounded-lg p-4" style={{ backgroundColor: '#fefce8', border: '1px solid #fde047', colorScheme: 'light' }}>
        <p style={{ color: '#854d0e' }}>No se pudieron cargar los datos</p>
      </div>
    )
  }

  const ticksInteligentes = datos.dias.filter(dia => dia.endsWith('-01'))

  const temporadas = []
  if (mostrarTemporadas) {
    const añoInicio = new Date(datos.dias[0]).getFullYear()
    const añoFin = new Date(datos.dias[datos.dias.length - 1]).getFullYear()
    const primerDia = datos.dias[0]
    const ultimoDia = datos.dias[datos.dias.length - 1]
    
    for (let año = añoInicio - 1; año <= añoFin + 1; año++) {
      const inviernoInicio = `${año}-06-01`
      const inviernoFin = `${año}-08-10`
      
      // Verificar si hay solapamiento entre el invierno y los datos disponibles
      if (inviernoFin >= primerDia && inviernoInicio <= ultimoDia) {
        // Ajustar los límites para que solo cubran el rango de datos disponibles
        const inicioAjustado = inviernoInicio < primerDia ? primerDia : inviernoInicio
        const finAjustado = inviernoFin > ultimoDia ? ultimoDia : inviernoFin
        
        temporadas.push({ 
          inicio: inicioAjustado, 
          fin: finAjustado, 
          nombre: 'Invierno' 
        })
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
      <div className="p-2 sm:p-3 rounded-lg shadow-lg" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
        <p className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm" style={{ color: '#111827' }}>{mes}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between gap-3 sm:gap-4 text-xs sm:text-sm">
            <span style={{ color: entry.color }} className="font-medium">
              {entry.name}:
            </span>
            <span className="font-mono font-semibold" style={{ color: '#111827' }}>
              {entry.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6" style={{ colorScheme: 'light' }}>
      {/* CONTROLES */}
      <div className="rounded-xl shadow-md p-4 sm:p-6" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: '#111827' }}>
            Evolución de Carga Animal
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setVistaTabla(!vistaTabla)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
            >
              {vistaTabla ? 'Ver Gráfico' : 'Ver Tabla'}
            </button>
            <button
              onClick={exportarCSV}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#16a34a', color: 'white' }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Período */}
          <div>
            <label className="block text-sm font-medium mb-1.5 sm:mb-2" style={{ color: '#374151' }}>
              Período
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="w-full rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              style={{ border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827' }}
            >
              <option value="mensual">Últimos 12 meses</option>
              <option value="ejercicio">Ejercicio (Jul-Jun)</option>
            </select>
          </div>

          {/* Potrero */}
          <div>
            <label className="block text-sm font-medium mb-1.5 sm:mb-2" style={{ color: '#374151' }}>
              Potrero
            </label>
            <select
              value={loteSeleccionado || ''}
              onChange={(e) => {
                const valor = e.target.value
                setLoteSeleccionado(valor === '' ? null : valor)
              }}
              className="w-full rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              style={{ border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827' }}
            >
              <option value="">Campo completo (SPG)</option>
              {datos.lotes.map((lote) => (
                <option key={lote.loteId} value={lote.loteId}>
                  {lote.nombre} ({lote.hectareas.toFixed(2)} ha)
                </option>
              ))}
            </select>
          </div>

          {/* Vista */}
          <div>
            <label className="block text-sm font-medium mb-1.5 sm:mb-2" style={{ color: '#374151' }}>
              Métrica
            </label>
            <select
              value={vistaActiva}
              onChange={(e) => setVistaActiva(e.target.value as any)}
              className="w-full rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base"
              style={{ border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827' }}
            >
              <option value="ug">UG Totales</option>
              <option value="ug-ha">UG por Hectárea</option>
            </select>
          </div>
        </div>

        {/* Opciones de visualización */}
        <div className="flex gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarTemporadas}
              onChange={(e) => setMostrarTemporadas(e.target.checked)}
              className="rounded"
              style={{ borderColor: '#d1d5db' }}
            />
            <span style={{ color: '#374151' }}>Marcar temporadas</span>
          </label>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p className="text-xs sm:text-sm mb-1" style={{ color: '#1d4ed8' }}>Actual</p>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: '#1e3a8a' }}>
              {vistaActiva === 'ug' ? estadisticas.actual : estadisticas.cargaHaActual}
            </p>
            <p className="text-[10px] sm:text-xs mt-1" style={{ color: '#2563eb' }}>
              {vistaActiva === 'ug' ? 'UG totales' : 'UG/ha'}
            </p>
          </div>

          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-xs sm:text-sm mb-1" style={{ color: '#15803d' }}>Prom. 30d</p>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: '#14532d' }}>{estadisticas.promedioMes}</p>
            <p className="text-[10px] sm:text-xs mt-1" style={{ color: '#16a34a' }}>
              {vistaActiva === 'ug' ? 'UG' : 'UG/ha'}
            </p>
          </div>

          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
            <p className="text-xs sm:text-sm mb-1" style={{ color: '#7e22ce' }}>Prom. 90d</p>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: '#581c87' }}>{estadisticas.promedioTrimestre}</p>
            <p className="text-[10px] sm:text-xs mt-1" style={{ color: '#9333ea' }}>
              {vistaActiva === 'ug' ? 'UG' : 'UG/ha'}
            </p>
          </div>

          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
            <p className="text-xs sm:text-sm mb-1" style={{ color: '#c2410c' }}>SPG</p>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: '#7c2d12' }}>
              {loteSeleccionado
  ? datos.lotes.find(l => l.loteId === loteSeleccionado)?.hectareas.toFixed(2)
  : datos.global.hectareasTotales.toFixed(2)}
            </p>
            <p className="text-[10px] sm:text-xs mt-1" style={{ color: '#ea580c' }}>hectáreas</p>
          </div>
        </div>
      )}

      {/* VISTA DE TABLA */}
      {vistaTabla ? (
        <div className="rounded-xl shadow-md p-3 sm:p-6 overflow-x-auto" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th className="text-left py-2 px-2 sm:px-3 font-semibold" style={{ color: '#374151' }}>Fecha</th>

                {loteSeleccionado ? (
                  <>
                    <th className="text-right py-2 px-2 sm:px-3 font-semibold" style={{ color: '#374151' }}>
                      <span className="hidden sm:inline">{datos.lotes.find(l => l.loteId === loteSeleccionado)?.nombre}</span> UG
                    </th>
                    <th className="text-right py-2 px-2 sm:px-3 font-semibold" style={{ color: '#374151' }}>
                      UG/ha
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-2 sm:px-3 font-semibold" style={{ color: '#374151' }}>UG</th>
                    <th className="text-right py-2 px-2 sm:px-3 font-semibold" style={{ color: '#374151' }}>UG/ha</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {datos.dias.map((dia, index) => (
                <tr key={dia} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td className="py-2 px-2 sm:px-3" style={{ color: '#4b5563' }}>
                    {new Date(dia).toLocaleDateString('es-UY')}
                  </td>

                  {loteSeleccionado ? (
                    <>
                      <td className="text-right py-2 px-2 sm:px-3 font-mono" style={{ color: '#111827' }}>
                        {datos.lotes.find(l => l.loteId === loteSeleccionado)?.datos[index].toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 sm:px-3 font-mono" style={{ color: '#111827' }}>
                        {datos.lotes.find(l => l.loteId === loteSeleccionado)?.cargaPorHectarea[index].toFixed(2)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-right py-2 px-2 sm:px-3 font-mono" style={{ color: '#111827' }}>
                        {datos.global?.ug?.[index]?.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="text-right py-2 px-2 sm:px-3 font-mono" style={{ color: '#111827' }}>
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
        <div className="rounded-xl shadow-md p-3 sm:p-6" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
          {/* Altura responsive: 280px móvil, 450px desktop */}
          <div className="h-[280px] sm:h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      )}

      {/* RESUMEN GLOBAL */}
{!loteSeleccionado && (
  <div className="rounded-lg p-4 sm:p-6" style={{ background: 'linear-gradient(to right, #eff6ff, #ecfeff)', border: '1px solid #bfdbfe' }}>
    <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg" style={{ color: '#1e3a8a' }}>Resumen del Campo</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#2563eb' }}>{datos.lotes.length}</p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#1d4ed8' }}>Potreros</p>
      </div>

      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#2563eb' }}>
          {datos.global?.hectareasTodasPredio?.toFixed(0) ?? '0'}
        </p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#1d4ed8' }}>Ha totales</p>
      </div>

      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#2563eb' }}>
          {datos.global?.hectareasTotales?.toFixed(0) ?? '0'}
        </p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#1d4ed8' }}>SPG (ha)</p>
      </div>

      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#2563eb' }}>
          {datos.global?.ug?.[datos.global.ug.length - 1]?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#1d4ed8' }}>UG actuales</p>
      </div>

      <div className="text-center col-span-2 sm:col-span-1">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: '#2563eb' }}>
          {datos.global?.ugPorHectarea?.[datos.global.ugPorHectarea.length - 1]?.toFixed(2) ?? '0.00'}
        </p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#1d4ed8' }}>UG/ha actual</p>
      </div>
    </div>
  </div>
)}

      {/* LEYENDA */}
      <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <h4 className="font-semibold mb-2 text-sm" style={{ color: '#111827' }}>Guía de interpretación</h4>
        <ul className="text-xs space-y-1" style={{ color: '#4b5563' }}>
          <li>• <strong>Línea escalonada:</strong> Cambios por altas/bajas</li>
          <li>• <strong>Puntos marcados:</strong> Cambios &gt;5% o inicio de mes</li>
          <li>• <strong>Bandas azules:</strong> Invierno</li>
          <li>• <strong>Línea roja:</strong> Máx. recomendada (1.2 UG/ha)</li>
        </ul>
      </div>
    </div>
  )
}