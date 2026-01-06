'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSuperficie } from '@/app/contexts/SuperficieContext'
import { useTipoCampo } from '@/app/contexts/TipoCampoContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import { Loader2, AlertCircle, DollarSign, TrendingUp, Calendar } from 'lucide-react'

interface CostosData {
  distribucion: {
    ug: {
      vacunos: number
      ovinos: number
      equinos: number
      total: number
    }
    porcentajes: {
      vacunos: number
      ovinos: number
      equinos: number
    }
    hectareas: {
      vacunos: number
      ovinos: number
      equinos: number
      total: number
    }
  }
  costosVariables: {
    totalUSD: number
    porEspecie: {
      vacunos: number
      ovinos: number
      equinos: number
      sinAsignar: number
    }
    ganaderia: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
      sinAsignar: number
    }>
    agricultura: Array<{
      cultivo: string
      loteId: string
      loteNombre: string
      totalUSD: number
      hectareas: number
      usdPorHa: number
      gastos: number
      costosFijos: number
    }>
    mixtos: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
      sinAsignar: number
    }>
    automaticos: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
      sinAsignar: number
    }>
    detalle: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
      sinAsignar: number
    }>
  }
  costosFijos: {
    totalUSD: number
    porEspecie: {
      vacunos: number
      ovinos: number
      equinos: number
    }
    puros: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }>
    asignables: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }>
    detalle: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }>
  }
  costosFinancieros: {
    totalUSD: number
    porEspecie: {
      vacunos: number
      ovinos: number
      equinos: number
    }
    detalle: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }>
  }
  totales: {
    vacunos: number
    ovinos: number
    equinos: number
    general: number
  }
  usdPorHectarea: {
    vacunos: number
    ovinos: number
    equinos: number
    general: number
  }
  periodo: {
    desde: string
    hasta: string
  }
  advertencia?: string
  advertenciaSinEspecie?: string  // 🆕 AGREGA ESTA LÍNEA
  agriculturaInfo?: {
    hectareas: number
    pctDelTotal: number
    costosFijos: number
  }
}

// ✅ Función para calcular el ejercicio fiscal actual
function calcularEjercicioActual(): { inicio: number; fin: number } {
  const hoy = new Date()
  const mes = hoy.getMonth() // 0-11 (0 = enero, 6 = julio)
  const anio = hoy.getFullYear()

  // Si estamos entre enero y junio, el ejercicio empezó el año anterior
  // Si estamos entre julio y diciembre, el ejercicio empezó este año
  if (mes < 6) {
    // Enero a Junio → Ejercicio año anterior / año actual
    return { inicio: anio - 1, fin: anio }
  } else {
    // Julio a Diciembre → Ejercicio año actual / año siguiente
    return { inicio: anio, fin: anio + 1 }
  }
}

// ✅ Generar lista de últimos N ejercicios
function generarEjercicios(cantidad: number): Array<{ inicio: number; fin: number; label: string }> {
  const ejercicioActual = calcularEjercicioActual()
  const ejercicios = []

  for (let i = 0; i < cantidad; i++) {
    const inicio = ejercicioActual.inicio - i
    const fin = ejercicioActual.fin - i
    ejercicios.push({
      inicio,
      fin,
      label: `${inicio}/${fin}`,
    })
  }

  return ejercicios
}

// ✅ Convertir ejercicio a fechas
function ejercicioAFechas(inicio: number, fin: number): { desde: string; hasta: string } {
  return {
    desde: `${inicio}-07-01`, // 1 de julio del año inicio
    hasta: `${fin}-06-30`,    // 30 de junio del año fin
  }
}

export default function CostosPage() {
  const [loading, setLoading] = useState(true)
  const { esMixto } = useTipoCampo()
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CostosData | null>(null)

  // ✅ Ejercicios disponibles (últimos 5)
  const ejercicios = useMemo(() => generarEjercicios(5), [])

  // ✅ Ejercicio seleccionado (por defecto el actual)
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState(() => {
    const actual = calcularEjercicioActual()
    return `${actual.inicio}-${actual.fin}`
  })
 
  const { usarSPG } = useSuperficie()

  // 🔥 AGREGAR ESTA LÍNEA
console.log('🔍 COSTOS - usarSPG desde Context:', usarSPG)

  // ✅ Fechas derivadas del ejercicio seleccionado
  const fechas = useMemo(() => {
    const [inicio, fin] = ejercicioSeleccionado.split('-').map(Number)
    return ejercicioAFechas(inicio, fin)
  }, [ejercicioSeleccionado])

  useEffect(() => {
    fetchCostos()
  }, [fechas, usarSPG])

  async function fetchCostos() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        fechaDesde: fechas.desde,
        fechaHasta: fechas.hasta,
        usarSPG: usarSPG.toString(),
      })

      const res = await fetch(`/api/costos?${params}`)

      if (!res.ok) {
        throw new Error('Error al cargar costos')
      }

      const data = await res.json()
      setData(data)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al cargar costos')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return null
  }

  const formatUSD = (value: number) =>
    `$${value.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ✅ Obtener label del ejercicio actual para mostrar
  const ejercicioActual = calcularEjercicioActual()
  const [inicioSel, finSel] = ejercicioSeleccionado.split('-').map(Number)
  const esEjercicioActual = inicioSel === ejercicioActual.inicio

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Costos del Campo</h1>
          <p className="text-gray-500 mt-1">
            Distribución de costos por especie animal
          </p>
        </div>
      </div>

      {/* ✅ Selector de Ejercicio */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">
                Ejercicio Fiscal
              </label>
            </div>

            <select
              value={ejercicioSeleccionado}
              onChange={(e) => setEjercicioSeleccionado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
            >
              {ejercicios.map((ej) => (
                <option key={ej.label} value={`${ej.inicio}-${ej.fin}`}>
                  {ej.label}
                  {ej.inicio === ejercicioActual.inicio ? ' (actual)' : ''}
                </option>
              ))}
            </select>

            {/* Info del período */}
            <div className="text-sm text-gray-500 ml-auto">
              <span className="font-medium">Período:</span>{' '}
              1 Jul {inicioSel} → 30 Jun {finSel}
            </div>

            {esEjercicioActual && (
              <Badge className="bg-green-100 text-green-800">
                En curso
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advertencia si no hay animales */}
      {data.advertencia && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{data.advertencia}</AlertDescription>
        </Alert>
      )}

      {/* Resumen de Distribución */}
      <Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Distribución por Especie</CardTitle>
      {usarSPG && (
        <Badge className="bg-blue-100 text-blue-800">
          Usando SPG para cálculos por ha
        </Badge>
      )}
    </div>
  </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Vacunos</div>
              <div className="text-2xl font-bold text-blue-900">
                {data.distribucion.porcentajes.vacunos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.vacunos.toFixed(1)} UG •{' '}
                {data.distribucion.hectareas.vacunos.toFixed(0)} ha
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Ovinos</div>
              <div className="text-2xl font-bold text-green-900">
                {data.distribucion.porcentajes.ovinos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.ovinos.toFixed(1)} UG •{' '}
                {data.distribucion.hectareas.ovinos.toFixed(0)} ha
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Equinos</div>
              <div className="text-2xl font-bold text-amber-900">
                {data.distribucion.porcentajes.equinos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.equinos.toFixed(1)} UG •{' '}
                {data.distribucion.hectareas.equinos.toFixed(0)} ha
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Campo</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.distribucion.ug.total.toFixed(1)} UG
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.hectareas.total.toFixed(0)} ha
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totales por Especie */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vacunos</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatUSD(data.totales.vacunos)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatUSD(data.usdPorHectarea.vacunos)}/ha
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ovinos</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatUSD(data.totales.ovinos)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatUSD(data.usdPorHectarea.ovinos)}/ha
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Equinos</p>
                <p className="text-2xl font-bold text-amber-900">
                  {formatUSD(data.totales.equinos)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatUSD(data.usdPorHectarea.equinos)}/ha
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>

        {/* 🌾 TARJETAS DE AGRICULTURA */}
          {esMixto && data.agriculturaInfo && data.agriculturaInfo.hectareas > 0 && (
          <>
            {data.costosVariables.agricultura.map((cultivo) => (
              <Card 
                key={`${cultivo.cultivo}-${cultivo.loteId}`}
                className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <span>🌾</span>
                        {cultivo.cultivo}
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        📍 {cultivo.loteNombre}
                      </p>
                      <p className="text-2xl font-bold text-green-900">
                        {formatUSD(cultivo.totalUSD)}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-green-700">
                          <span className="font-medium">{cultivo.hectareas.toFixed(1)} ha</span>
                          {' • '}
                          <span className="font-semibold">{formatUSD(cultivo.usdPorHa)}/ha</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Variables: {formatUSD(cultivo.totalUSD - cultivo.costosFijos)}
                          {' • '}
                          Fijos: {formatUSD(cultivo.costosFijos)}
                        </p>
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total General</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatUSD(data.totales.general)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatUSD(data.usdPorHectarea.general)}/ha
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 💰 COSTOS DE PRODUCCIÓN (Variables Directos) */}
      <Card>
        <CardHeader>
          <CardTitle>💰 Costos de Producción (Variables Directos)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.advertenciaSinEspecie && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {data.advertenciaSinEspecie}
              </AlertDescription>
            </Alert>
          )}

          {/* 🐄 Ganadería */}
          {data.costosVariables.ganaderia.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                🐄 Ganadería
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vacunos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ovinos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equinos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosVariables.ganaderia.map((item) => (
                      <tr key={item.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatUSD(item.totalUSD)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{item.vacunos > 0 ? formatUSD(item.vacunos) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{item.ovinos > 0 ? formatUSD(item.ovinos) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{item.equinos > 0 ? formatUSD(item.equinos) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 🌾 Agricultura - Por Cultivo */}
          {esMixto && data.costosVariables.agricultura.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                🌾 Agricultura (Por Cultivo)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cultivo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variables</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fijos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hectáreas</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">USD/ha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosVariables.agricultura.map((item) => (
                      <tr key={`${item.cultivo}-${item.loteId}`} className="border-b border-gray-200 hover:bg-green-50">
                        <td className="p-3 font-medium text-sm text-gray-900">
                          <div>🌾 {item.cultivo}</div>
                          <div className="text-xs text-gray-500 mt-0.5">📍 {item.loteNombre}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          {formatUSD(item.totalUSD - item.costosFijos)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">
                          {formatUSD(item.costosFijos)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {formatUSD(item.totalUSD)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {item.hectareas.toFixed(1)} ha
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                          {formatUSD(item.usdPorHa)}/ha
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-green-100 font-semibold border-t-2 border-green-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">TOTAL AGRICULTURA</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">
                        {formatUSD(data.costosVariables.agricultura.reduce((sum, c) => sum + c.totalUSD - c.costosFijos, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-blue-700">
                        {formatUSD(data.agriculturaInfo?.costosFijos || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-800">
                        {formatUSD(data.costosVariables.agricultura.reduce((sum, c) => sum + c.totalUSD, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {data.agriculturaInfo?.hectareas.toFixed(1) || 0} ha
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">
                        {formatUSD(
                          data.agriculturaInfo && data.agriculturaInfo.hectareas > 0
                            ? data.costosVariables.agricultura.reduce((sum, c) => sum + c.totalUSD, 0) / data.agriculturaInfo.hectareas
                            : 0
                        )}/ha
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 🔀 Mixtos */}
          {data.costosVariables.mixtos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                🔀 Mixtos (Ganadería + Agricultura)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vacunos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ovinos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equinos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosVariables.mixtos.map((item) => (
                      <tr key={item.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatUSD(item.totalUSD)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{item.vacunos > 0 ? formatUSD(item.vacunos) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{item.ovinos > 0 ? formatUSD(item.ovinos) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{item.equinos > 0 ? formatUSD(item.equinos) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total Variables */}
          <div className="border-t-2 border-green-200 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-green-50 font-bold">
                    <td className="px-4 py-3 text-sm">TOTAL PRODUCCIÓN</td>
                    <td className="px-4 py-3 text-sm text-right">{formatUSD(data.costosVariables.totalUSD)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-700">{formatUSD(data.costosVariables.porEspecie.vacunos)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">{formatUSD(data.costosVariables.porEspecie.ovinos)}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700">{formatUSD(data.costosVariables.porEspecie.equinos)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🏗️ COSTOS DE ESTRUCTURA (Fijos) */}
      <Card>
        <CardHeader>
          <CardTitle>🏗️ Costos de Estructura (Fijos)</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Fijos Puros */}
          {data.costosFijos.puros.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                📋 Fijos Puros
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vacunos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ovinos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equinos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosFijos.puros.map((item) => (
                      <tr key={item.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatUSD(item.totalUSD)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{formatUSD(item.vacunos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{formatUSD(item.ovinos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{formatUSD(item.equinos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fijos Asignables */}
          {data.costosFijos.asignables.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                🔧 Fijos Asignables
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vacunos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ovinos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equinos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosFijos.asignables.map((item) => (
                      <tr key={item.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatUSD(item.totalUSD)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{formatUSD(item.vacunos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{formatUSD(item.ovinos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{formatUSD(item.equinos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total Fijos */}
          <div className="border-t-2 border-blue-200 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-4 py-3 text-sm">TOTAL ESTRUCTURA</td>
                    <td className="px-4 py-3 text-sm text-right">{formatUSD(data.costosFijos.totalUSD)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-700">{formatUSD(data.costosFijos.porEspecie.vacunos)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">{formatUSD(data.costosFijos.porEspecie.ovinos)}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700">{formatUSD(data.costosFijos.porEspecie.equinos)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🏦 COSTOS FINANCIEROS */}
      <Card>
        <CardHeader>
          <CardTitle>🏦 Costos de Capital Ajeno (Financieros)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.costosFinancieros.detalle.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total USD</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vacunos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ovinos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equinos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.costosFinancieros.detalle.map((item) => (
                      <tr key={item.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.categoria}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatUSD(item.totalUSD)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{formatUSD(item.vacunos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{formatUSD(item.ovinos)}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{formatUSD(item.equinos)}</td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50 font-bold border-t-2 border-purple-200">
                      <td className="px-4 py-3 text-sm">TOTAL FINANCIEROS</td>
                      <td className="px-4 py-3 text-sm text-right">{formatUSD(data.costosFinancieros.totalUSD)}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-700">{formatUSD(data.costosFinancieros.porEspecie.vacunos)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">{formatUSD(data.costosFinancieros.porEspecie.ovinos)}</td>
                      <td className="px-4 py-3 text-sm text-right text-amber-700">{formatUSD(data.costosFinancieros.porEspecie.equinos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No hay costos financieros en este período</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}