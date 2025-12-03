'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import { Loader2, AlertCircle, DollarSign, TrendingUp } from 'lucide-react'

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
    }
    detalle: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
    }>
  }
  costosFijos: {
    totalUSD: number
    porEspecie: {
      vacunos: number
      ovinos: number
      equinos: number
      global: number
    }
    detalle: Array<{
      categoria: string
      totalUSD: number
      vacunos: number
      ovinos: number
      equinos: number
      global: number
    }>
  }
  totales: {
    vacunos: number
    ovinos: number
    equinos: number
    global: number
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
}

export default function CostosPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CostosData | null>(null)

  // Fechas por defecto: año actual
  const now = new Date()
  const [fechaDesde, setFechaDesde] = useState(
    new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  )
  const [fechaHasta, setFechaHasta] = useState(
    new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
  )

  useEffect(() => {
    fetchCostos()
  }, [fechaDesde, fechaHasta])

  async function fetchCostos() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        fechaDesde,
        fechaHasta,
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

  const formatUSD = (value: number) => `$${value.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

      {/* Selector de Fechas */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
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
          <CardTitle>Distribución por Especie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Vacunos</div>
              <div className="text-2xl font-bold text-blue-900">
                {data.distribucion.porcentajes.vacunos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.vacunos.toFixed(1)} UG • {data.distribucion.hectareas.vacunos.toFixed(0)} ha
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Ovinos</div>
              <div className="text-2xl font-bold text-green-900">
                {data.distribucion.porcentajes.ovinos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.ovinos.toFixed(1)} UG • {data.distribucion.hectareas.ovinos.toFixed(0)} ha
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Equinos</div>
              <div className="text-2xl font-bold text-amber-900">
                {data.distribucion.porcentajes.equinos.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.distribucion.ug.equinos.toFixed(1)} UG • {data.distribucion.hectareas.equinos.toFixed(0)} ha
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

      {/* Costos Variables */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Costos Variables</CardTitle>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Distribución automática según % UG
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total USD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Vacunos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ovinos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Equinos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.costosVariables.detalle.map((item) => (
                  <tr key={item.categoria} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.categoria}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatUSD(item.totalUSD)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">
                      {formatUSD(item.vacunos)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">
                      {formatUSD(item.ovinos)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-amber-600">
                      {formatUSD(item.equinos)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="px-4 py-3 text-sm">TOTAL VARIABLES</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatUSD(data.costosVariables.totalUSD)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-700">
                    {formatUSD(data.costosVariables.porEspecie.vacunos)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">
                    {formatUSD(data.costosVariables.porEspecie.ovinos)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-amber-700">
                    {formatUSD(data.costosVariables.porEspecie.equinos)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Costos Fijos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Costos Fijos</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Asignación manual por especie
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total USD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Vacunos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ovinos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Equinos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Global
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.costosFijos.detalle.map((item) => (
                  <tr key={item.categoria} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.categoria}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatUSD(item.totalUSD)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">
                      {item.vacunos > 0 ? formatUSD(item.vacunos) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">
                      {item.ovinos > 0 ? formatUSD(item.ovinos) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-amber-600">
                      {item.equinos > 0 ? formatUSD(item.equinos) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {item.global > 0 ? formatUSD(item.global) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-4 py-3 text-sm">TOTAL FIJOS</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatUSD(data.costosFijos.totalUSD)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-700">
                    {formatUSD(data.costosFijos.porEspecie.vacunos)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">
                    {formatUSD(data.costosFijos.porEspecie.ovinos)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-amber-700">
                    {formatUSD(data.costosFijos.porEspecie.equinos)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatUSD(data.costosFijos.porEspecie.global)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}