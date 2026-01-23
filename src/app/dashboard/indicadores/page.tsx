//src/app/dashboard/indicadores/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSuperficie } from '@/app/contexts/SuperficieContext'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import { Loader2, AlertCircle, Calendar, TrendingUp, Info, ChevronDown, ChevronRight } from 'lucide-react'

interface IndicadoresData {
  ejercicio: {
    anioInicio: number
    anioFin: number
    fechaDesde: string
    fechaHasta: string
  }
  superficie: {
    total: number
    spg: number
    util: number
    mejorada: number
    agricola?: number
    usandoSPG: boolean
  }
  agricultura?: {
    superficiePorCultivo: Record<string, number>
    ventasGranos: {
      totalUSD: number
      totalKg: number
      porHa: number
      porCultivo: Record<string, { kg: number; usd: number; hectareas: number; rendimiento: number }>
    }
    pbAgricola: number
    pbAgricolaPorHa: number
    porcentajePBTotal: number
  }
  eficienciaTecnica: {
    superficieTotal: { global: number; vacunos: number; ovinos: number; equinos: number }
    relacionLanarVacuno: number
  }
  ganaderia: {
    carga: { global: number; vacunos: number; ovinos: number; equinos: number }
    cargaKgPV: { global: number; vacunos: number; ovinos: number; equinos: number }
    mortandad: { global: number; vacunos: number; ovinos: number; equinos: number }
    tasaExtraccion: { global: number; vacunos: number; ovinos: number; equinos: number }
    lana: { totalKg: number; kgPorAnimal: number; usdTotal: number; usdPorKg: number }
    pesoPromedioVenta: { global: number; vacunos: number; ovinos: number; equinos: number }
    precioPromedioVenta: { global: number; vacunos: number; ovinos: number; equinos: number }
    produccionCarne: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
  }
  economicos: {
    productoBruto: {
      // Componentes del PB (detalle)
      ventas: { global: number; vacunos: number; ovinos: number; equinos: number }
      consumo: { global: number; vacunos: number; ovinos: number; equinos: number }
      compras: { global: number; vacunos: number; ovinos: number; equinos: number }
      difInventario: { global: number; vacunos: number; ovinos: number; equinos: number }
      lana: { global: number; ovinos: number }
      
      // PB consolidado
      ganaderia: number
      ganaderiaHa: number
      porcentajeGanaderia: number
      agricultura: number
      agriculturaHa: number
      porcentajeAgricultura: number
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    ingresoBruto: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    costosTotales: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    costosFijos: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    costosVariables: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    costosRenta: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    costos: {
      operativosAgricola: number
      operativosGanadero: number
      estructura: number
      renta: number
      total: number
      totalPorHa: number
    }
    ik: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    ikp: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    ingresoEfectivo: {
      total: { global: number; vacunos: number; ovinos: number; equinos: number }
      porHa: { global: number; vacunos: number; ovinos: number; equinos: number }
    }
    usdPorKgProducido: { global: number; vacunos: number; ovinos: number; equinos: number }
    costoPorKgProducido: { global: number; vacunos: number; ovinos: number; equinos: number }
    margenPorKg: { global: number; vacunos: number; ovinos: number; equinos: number }
    relacionInsumoProducto: { global: number; vacunos: number; ovinos: number; equinos: number }
  }
  _debug?: {
    ventas: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
    ventasPorTipo?: {
      BOVINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
      OVINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
      EQUINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
    }
    compras: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
    comprasPorTipo?: {
      BOVINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
      OVINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
      EQUINO?: { cantidad: number; pesoTotalKg: number; importeBrutoUSD: number }
    }
    consumos: { cantidad: number; pesoTotalKg: number; valorTotalUSD: number }
    consumosPorTipo?: {
      BOVINO?: { cantidad: number; pesoTotalKg: number; valorTotalUSD: number }
      OVINO?: { cantidad: number; pesoTotalKg: number; valorTotalUSD: number }
      EQUINO?: { cantidad: number; pesoTotalKg: number; valorTotalUSD: number }
    }
    difInventario: { difKg: number; difUSD: number }
    difInventarioPorTipo?: {
      BOVINO?: { difKg: number; difUSD: number }
      OVINO?: { difKg: number; difUSD: number }
      EQUINO?: { difKg: number; difUSD: number }
    }
    costosVariables: number
    costosFijos: number
    costosRenta: number
    lana?: {
      totalKgLana: number
      totalUSDLana: number
      lanaEquivCarne: number
    }
  }
}

function generarEjercicios(cantidad: number): Array<{ inicio: number; fin: number; label: string }> {
  const hoy = new Date()
  const mes = hoy.getMonth()
  const anio = hoy.getFullYear()
  const anioInicio = mes < 6 ? anio - 1 : anio

  const ejercicios = []
  for (let i = 0; i < cantidad; i++) {
    const inicio = anioInicio - i
    const fin = inicio + 1
    ejercicios.push({ inicio, fin, label: `${inicio}/${fin}` })
  }
  return ejercicios
}

export default function IndicadoresPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IndicadoresData | null>(null)

  // Estados para los acordeones (todos cerrados por defecto)
  const [eficienciaAbierto, setEficienciaAbierto] = useState(false)
  const [ganaderiaAbierto, setGanaderiaAbierto] = useState(false)
  const [agriculturaAbierto, setAgriculturaAbierto] = useState(false)
  const [economicosAbierto, setEconomicosAbierto] = useState(false)
  const [produccionCarneAbierto, setProduccionCarneAbierto] = useState(false)
  const [productoBrutoAbierto, setProductoBrutoAbierto] = useState(false)
  const [costosTotalesAbierto, setCostosTotalesAbierto] = useState(false)
  
  const { usarSPG, setUsarSPG } = useSuperficie()

  // 🔥 AGREGAR ESTA LÍNEA  
  console.log('🔍 INDICADORES - usarSPG desde Context:', usarSPG)

  const ejercicios = useMemo(() => generarEjercicios(5), [])

  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState(() => {
    const hoy = new Date()
    const mes = hoy.getMonth()
    const anio = hoy.getFullYear()
    const inicio = mes < 6 ? anio - 1 : anio
    return `${inicio}-${inicio + 1}`
  })

  useEffect(() => {
    fetchIndicadores()
  }, [ejercicioSeleccionado, usarSPG])

  async function fetchIndicadores() {
    try {
      setLoading(true)
      setError(null)

      const [anioInicio, anioFin] = ejercicioSeleccionado.split('-').map(Number)
      const params = new URLSearchParams({
        anioInicio: anioInicio.toString(),
        anioFin: anioFin.toString(),
        usarSPG: usarSPG.toString(),
      })

      const res = await fetch(`/api/indicadores?${params}`)
      if (!res.ok) throw new Error('Error al cargar indicadores')

      const result = await res.json()
      setData(result)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al cargar indicadores')
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

  if (!data) return null

  const [anioInicio, anioFin] = ejercicioSeleccionado.split('-').map(Number)
  const esEjercicioActual = ejercicios[0]?.inicio === anioInicio
  const esMixto = !!data.agricultura

  const fmt = (val: number) => val.toLocaleString('es-UY')
  const fmtDec = (val: number) => val.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtHa = (val: number) => val.toLocaleString('es-UY', { maximumFractionDigits: 2 })
  const fmtPct = (val: number) => `${val.toFixed(1)}%`

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-blue-600" />
            Indicadores del Campo
          </h1>
          <p className="text-gray-500 mt-1">Análisis productivo y económico del ejercicio</p>
        </div>
      </div>
      
      {/* 🆕 NUEVO: Checkbox SPG */}
      <Card>
        <CardContent className="pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usarSPG}
              onChange={(e) => setUsarSPG(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Usar SPG (Superficie de Pastoreo Ganadero) para los cálculos
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Selector de Ejercicio */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Ejercicio Fiscal</label>
            </div>
            <select
              value={ejercicioSeleccionado}
              onChange={(e) => setEjercicioSeleccionado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
            >
              {ejercicios.map((ej) => (
                <option key={ej.label} value={`${ej.inicio}-${ej.fin}`}>
                  {ej.label}{ej.inicio === ejercicios[0].inicio ? ' (actual)' : ''}
                </option>
              ))}
            </select>
            <div className="text-sm text-gray-500 sm:ml-auto">
              <span className="font-medium">Período:</span> 1 Jul {anioInicio} → 30 Jun {anioFin}
            </div>
            {esEjercicioActual && <Badge className="bg-green-100 text-green-800">En curso</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Indicadores */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left font-bold text-gray-700 border-b-2 border-gray-300 sticky left-0 bg-gray-100 z-10 min-w-[200px]"></th>
                <th colSpan={2} className="px-2 py-2 text-center font-bold text-white bg-gray-500 border border-gray-600">Global</th>
                <th colSpan={2} className="px-2 py-2 text-center font-bold text-white bg-green-600 border border-green-700">Vacuno</th>
                <th colSpan={2} className="px-2 py-2 text-center font-bold text-white bg-green-600 border border-green-700">Ovino</th>
                <th colSpan={2} className="px-2 py-2 text-center font-bold text-white bg-green-600 border border-green-700">Equino</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 sticky left-0 bg-gray-50 z-10"></th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-gray-100 min-w-[80px]">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-gray-100 min-w-[80px]">Por ha</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Por ha</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Por ha</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b border-gray-200 bg-green-50 min-w-[80px]">Por ha</th>
              </tr>
            </thead>
            
            <tbody>
              {/* EFICIENCIA TÉCNICA - ACORDEÓN */}
              <tr 
                className="bg-green-100 cursor-pointer hover:bg-green-200 transition-colors"
                onClick={() => setEficienciaAbierto(!eficienciaAbierto)}
              >
                <td colSpan={9} className="px-4 py-3 font-bold text-green-800 border-y border-green-300 sticky left-0 bg-green-100 z-10">
                  <div className="flex items-center gap-2">
                    {eficienciaAbierto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    Indicadores de eficiencia técnica
                  </div>
                </td>
              </tr>
              {eficienciaAbierto && (
                <>
                  {/* ✅ FILA 1: Superficie Total */}
                  <tr className={`${!usarSPG ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-gray-50'}`}>
                    <td className={`px-4 py-2 font-medium border-b border-gray-200 sticky left-0 z-10 ${!usarSPG ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-900'}`}>
                      Superficie Total (ha)
                      {!usarSPG && <span className="ml-2 text-xs text-blue-600">✔ Usada para cálculos</span>}
                    </td>
                    <td className={`px-3 py-2 text-center border-b border-gray-200 font-medium ${!usarSPG ? 'text-blue-900' : ''}`}>
                      {fmtHa(data.superficie.total)}
                    </td>
                    <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                  </tr>
                  
                  {/* ✅ FILA 2: SPG */}
                  <tr className={`${usarSPG ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-gray-50'}`}>
                    <td className={`px-4 py-2 font-medium border-b border-gray-200 sticky left-0 z-10 ${usarSPG ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-900'}`}>
                      SPG (Superficie de Pastoreo Ganadero)
                      {usarSPG && <span className="ml-2 text-xs text-blue-600">✔ Usada para cálculos</span>}
                    </td>
                    <td className={`px-3 py-2 text-center border-b border-gray-200 font-medium ${usarSPG ? 'text-blue-900' : ''}`}>
                      {fmtHa(data.superficie.spg)}
                    </td>
                    <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                  </tr>

                  {/* ✅ FILA 3: Superficie Mejorada */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-200 sticky left-0 bg-gray-50 z-10">
                      Superficie Mejorada (ha)
                      <span className="block text-xs text-gray-500 mt-1">Pastoreable con cultivos activos</span>
                    </td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">
                      {fmtHa(data.superficie.mejorada)}
                      {data.superficie.spg > 0 && (
                        <span className="block text-xs text-gray-500 mt-1">
                          ({((data.superficie.mejorada / data.superficie.spg) * 100).toFixed(1)}% de SPG)
                        </span>
                      )}
                    </td>
                    <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                  </tr>

                  {/* 🆕 FILA 3.5: Superficie Agrícola (solo si MIXTO) */}
                  {esMixto && (
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-200 sticky left-0 bg-gray-50 z-10">
                        Superficie Agrícola (ha)
                        <span className="block text-xs text-gray-500 mt-1">Hectáreas con cultivos del ejercicio</span>
                      </td>
                      <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">
                        {fmtHa(data.superficie.agricola!)}
                        {data.superficie.total > 0 && (
                          <span className="block text-xs text-gray-500 mt-1">
                            ({((data.superficie.agricola! / data.superficie.total) * 100).toFixed(1)}% del total)
                          </span>
                        )}
                      </td>
                      <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                    </tr>
                  )}

                  {/* 🆕 FILA 3.6: Superficie Útil (si MIXTO) */}
                  {esMixto && (
                    <tr className={`${true ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2 font-medium border-b border-gray-200 sticky left-0 bg-blue-50 text-blue-900 z-10">
                        Superficie Útil (ha)
                        <span className="block text-xs text-blue-600 mt-1">SPG + Agrícola (usada para cálculos económicos) ✔</span>
                      </td>
                      <td className="px-3 py-2 text-center border-b border-gray-200 font-medium text-blue-900">
                        {fmtHa(data.superficie.util)}
                        <span className="block text-xs text-gray-500 mt-1">
                          ({fmtHa(data.superficie.spg)} + {fmtHa(data.superficie.agricola!)})
                        </span>
                      </td>
                      <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                    </tr>
                  )}

                  {/* ✅ FILA 4: Relación lanar/vacuno */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Relación lanar/vacuno</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.eficienciaTecnica.relacionLanarVacuno)}</td>
                    <td colSpan={7} className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                </>
              )}

              {/* GANADERÍA - ACORDEÓN */}
              <tr 
                className="bg-yellow-100 cursor-pointer hover:bg-yellow-200 transition-colors"
                onClick={() => setGanaderiaAbierto(!ganaderiaAbierto)}
              >
                <td colSpan={9} className="px-4 py-3 font-bold text-yellow-800 border-y border-yellow-300 sticky left-0 bg-yellow-100 z-10">
                  <div className="flex items-center gap-2">
                    {ganaderiaAbierto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    Indicadores de la ganadería
                  </div>
                </td>
              </tr>
              {ganaderiaAbierto && (
                <>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Carga(UG/ha)</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.ganaderia.carga.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.ganaderia.carga.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.ganaderia.carga.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.ganaderia.carga.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>

                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Carga (kg PV/ha)</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.cargaKgPV.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.cargaKgPV.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.cargaKgPV.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.cargaKgPV.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-500 border-b border-gray-100 sticky left-0 bg-white z-10">Mortandad (%)</td>
                    <td colSpan={8} className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Tasa de extracción (%)</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{data.ganaderia.tasaExtraccion.global > 0 ? fmtPct(data.ganaderia.tasaExtraccion.global) : '-'}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{data.ganaderia.tasaExtraccion.vacunos > 0 ? fmtPct(data.ganaderia.tasaExtraccion.vacunos) : '-'}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{data.ganaderia.tasaExtraccion.ovinos > 0 ? fmtPct(data.ganaderia.tasaExtraccion.ovinos) : '-'}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{data.ganaderia.tasaExtraccion.equinos > 0 ? fmtPct(data.ganaderia.tasaExtraccion.equinos) : '-'}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Peso promedio venta</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.pesoPromedioVenta.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.pesoPromedioVenta.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.pesoPromedioVenta.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.pesoPromedioVenta.equinos)}</td>
                  </tr>
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Precio promedio venta</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.precioPromedioVenta.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.precioPromedioVenta.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.precioPromedioVenta.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.ganaderia.precioPromedioVenta.equinos)}</td>
                  </tr>
                  
                  {/* Producción de carne - CLICKEABLE */}
                  <tr 
                    className="hover:bg-yellow-100 bg-yellow-50 cursor-pointer"
                    onClick={() => setProduccionCarneAbierto(!produccionCarneAbierto)}
                  >
                    <td className="px-4 py-2 font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-yellow-50 z-10">
                      <div className="flex items-center gap-2">
                        {produccionCarneAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Producción de carne
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.ganaderia.produccionCarne.total.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.ganaderia.produccionCarne.porHa.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.ganaderia.produccionCarne.total.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.ganaderia.produccionCarne.porHa.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.ganaderia.produccionCarne.total.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.ganaderia.produccionCarne.porHa.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.ganaderia.produccionCarne.total.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.ganaderia.produccionCarne.porHa.equinos)}</td>
                  </tr>

                  {/* Desglose de Producción de carne */}
                  {produccionCarneAbierto && (
                    <>
                      <tr className="bg-yellow-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">Ventas (kg)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.ventas.pesoTotalKg)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data._debug.ventas.pesoTotalKg / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.ventasPorTipo?.BOVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.ventasPorTipo?.BOVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.ventasPorTipo?.OVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.ventasPorTipo?.OVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.ventasPorTipo?.EQUINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.ventasPorTipo?.EQUINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.equinos))}
                        </td>
                      </tr>
                      
                      <tr className="bg-yellow-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+ Consumo (kg)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.consumos.pesoTotalKg)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data._debug.consumos.pesoTotalKg / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.consumosPorTipo?.BOVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.consumosPorTipo?.BOVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.consumosPorTipo?.OVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.consumosPorTipo?.OVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.consumosPorTipo?.EQUINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.consumosPorTipo?.EQUINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.equinos))}
                        </td>
                      </tr>
                      
                      <tr className="bg-yellow-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">- Compras (kg)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.compras.pesoTotalKg)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data._debug.compras.pesoTotalKg / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.comprasPorTipo?.BOVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.comprasPorTipo?.BOVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.comprasPorTipo?.OVINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.comprasPorTipo?.OVINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.comprasPorTipo?.EQUINO?.pesoTotalKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.comprasPorTipo?.EQUINO?.pesoTotalKg || 0) / data.eficienciaTecnica.superficieTotal.equinos))}
                        </td>
                      </tr>
                      
                      <tr className="bg-yellow-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+/- Dif. Inventario (kg)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.difInventario.difKg)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data._debug.difInventario.difKg / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.difInventarioPorTipo?.BOVINO?.difKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.difInventarioPorTipo?.BOVINO?.difKg || 0) / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.difInventarioPorTipo?.OVINO?.difKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.difInventarioPorTipo?.OVINO?.difKg || 0) / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data._debug.difInventarioPorTipo?.EQUINO?.difKg || 0)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug.difInventarioPorTipo?.EQUINO?.difKg || 0) / data.eficienciaTecnica.superficieTotal.equinos))}
                        </td>
                      </tr>

                      <tr className="bg-yellow-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+ Lana (kg equiv.)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(data._debug?.lana?.lanaEquivCarne || 0)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug?.lana?.lanaEquivCarne || 0) / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(data._debug?.lana?.lanaEquivCarne || 0)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round((data._debug?.lana?.lanaEquivCarne || 0) / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                      </tr>
                    </>
                  )}
                </>
              )}

              {/* 🆕 AGRICULTURA - ACORDEÓN (solo si MIXTO) */}
              {esMixto && (
                <>
                  <tr 
                    className="bg-green-100 cursor-pointer hover:bg-green-200 transition-colors"
                    onClick={() => setAgriculturaAbierto(!agriculturaAbierto)}
                  >
                    <td colSpan={9} className="px-4 py-3 font-bold text-green-800 border-y border-green-300 sticky left-0 bg-green-100 z-10">
                      <div className="flex items-center gap-2">
                        {agriculturaAbierto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        Indicadores de agricultura
                      </div>
                    </td>
                  </tr>
                  {agriculturaAbierto && (
                    <>
                      {/* Header de tabla agrícola */}
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-300 sticky left-0 bg-gray-100 z-10">
                          Cultivo
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-300">
                          Ventas<br/><span className="font-normal text-xs">(USD)</span>
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-300">
                          Superficie<br/><span className="font-normal text-xs">(ha)</span>
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-300">
                          Rendimiento<br/><span className="font-normal text-xs">(ton/ha)</span>
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-300">
                          Producción<br/><span className="font-normal text-xs">(kg)</span>
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-300">
                          Ingreso/ha<br/><span className="font-normal text-xs">(USD/ha)</span>
                        </th>
                        <th colSpan={3} className="px-3 py-2 text-center border-b border-gray-300"></th>
                      </tr>

                      {/* Filas por cultivo */}
                      {Object.entries(data.agricultura!.ventasGranos.porCultivo).map(([cultivo, valores]) => (
                        <tr key={cultivo} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">
                            {cultivo}
                          </td>
                          <td className="px-3 py-2 text-center border-b border-gray-100">
                            {fmt(valores.usd)}
                          </td>
                          <td className="px-3 py-2 text-center border-b border-gray-100">
                            {fmtHa(valores.hectareas)}
                          </td>
                          <td className="px-3 py-2 text-center border-b border-gray-100">
                            {fmtDec(valores.rendimiento)}
                          </td>
                          <td className="px-3 py-2 text-center border-b border-gray-100">
                            {fmt(valores.kg)}
                          </td>
                          <td className="px-3 py-2 text-center border-b border-gray-100 font-medium">
                            {valores.hectareas > 0 ? fmt(Math.round(valores.usd / valores.hectareas)) : '-'}
                          </td>
                          <td colSpan={3} className="px-3 py-2 text-center border-b border-gray-100"></td>
                        </tr>
                      ))}

                      {/* Fila TOTAL */}
                      <tr className="bg-green-50 font-semibold">
                        <td className="px-4 py-2 text-gray-900 border-b border-gray-200 sticky left-0 bg-green-50 z-10">
                          TOTAL AGRÍCOLA
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200">
                          {fmt(data.agricultura!.ventasGranos.totalUSD)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200">
                          {fmtHa(data.superficie.agricola!)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">
                          -
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200">
                          {fmt(data.agricultura!.ventasGranos.totalKg)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200">
                          {fmt(Math.round(data.agricultura!.pbAgricolaPorHa))}
                        </td>
                        <td colSpan={3} className="px-3 py-2 text-center border-b border-gray-200"></td>
                      </tr>

                      {/* PB Agrícola */}
                      <tr className="bg-green-100">
                        <td colSpan={9} className="px-4 py-3 border-b border-gray-300 sticky left-0 bg-green-100 z-10">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">
                              Producto Bruto Agrícola: <span className="text-green-800">{fmt(data.agricultura!.pbAgricola)} USD</span>
                            </span>
                            <span className="text-sm text-gray-700">
                              ({data.agricultura!.porcentajePBTotal.toFixed(1)}% del PB total) • {fmt(Math.round(data.agricultura!.pbAgricolaPorHa))} USD/ha
                            </span>
                          </div>
                        </td>
                      </tr>
                    </>
                  )}
                </>
              )}

              {/* ECONÓMICOS - ACORDEÓN */}
              <tr 
                className="bg-blue-100 cursor-pointer hover:bg-blue-200 transition-colors"
                onClick={() => setEconomicosAbierto(!economicosAbierto)}
              >
                <td colSpan={9} className="px-4 py-3 font-bold text-blue-800 border-y border-blue-300 sticky left-0 bg-blue-100 z-10">
                  <div className="flex items-center gap-2">
                    {economicosAbierto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    Indicadores económicos
                  </div>
                </td>
              </tr>
              {economicosAbierto && (
                <>
                  {/* Producto Bruto - CLICKEABLE */}
                  <tr 
                    className="hover:bg-blue-100 bg-blue-50 cursor-pointer"
                    onClick={() => setProductoBrutoAbierto(!productoBrutoAbierto)}
                  >
                    <td className="px-4 py-2 font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-blue-50 z-10">
                      <div className="flex items-center gap-2">
                        {productoBrutoAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Producto Bruto
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.productoBruto.total.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.productoBruto.porHa.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.productoBruto.total.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.productoBruto.porHa.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.productoBruto.total.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.productoBruto.porHa.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.productoBruto.total.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.productoBruto.porHa.equinos)}</td>
                  </tr>

                  {/* Desglose de Producto Bruto */}
                  {productoBrutoAbierto && (
                    <>
                      {/* Ventas (U$S) */}
                      <tr className="bg-blue-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">Ventas (U$S)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.ventas.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.ventas.global / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.ventas.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.ventas.vacunos / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.ventas.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.ventas.ovinos / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.ventas.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {data.eficienciaTecnica.superficieTotal.equinos > 0 ? fmt(Math.round(data.economicos.productoBruto.ventas.equinos / data.eficienciaTecnica.superficieTotal.equinos)) : '-'}
                        </td>
                      </tr>

                      {/* + Consumo (U$S) */}
                      <tr className="bg-blue-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+ Consumo (U$S)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.consumo.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.consumo.global / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.consumo.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.consumo.vacunos / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.consumo.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.consumo.ovinos / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.consumo.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {data.eficienciaTecnica.superficieTotal.equinos > 0 ? fmt(Math.round(data.economicos.productoBruto.consumo.equinos / data.eficienciaTecnica.superficieTotal.equinos)) : '-'}
                        </td>
                      </tr>

                      {/* - Compras (U$S) */}
                      <tr className="bg-blue-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">- Compras (U$S)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.compras.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.compras.global / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.compras.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.compras.vacunos / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.compras.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.compras.ovinos / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.compras.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {data.eficienciaTecnica.superficieTotal.equinos > 0 ? fmt(Math.round(data.economicos.productoBruto.compras.equinos / data.eficienciaTecnica.superficieTotal.equinos)) : '-'}
                        </td>
                      </tr>

                      {/* +/- Dif. Inventario (U$S) */}
                      <tr className="bg-blue-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+/- Dif. Inventario (U$S)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.difInventario.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.difInventario.global / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.difInventario.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.difInventario.vacunos / data.eficienciaTecnica.superficieTotal.vacunos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.difInventario.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.difInventario.ovinos / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.productoBruto.difInventario.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {data.eficienciaTecnica.superficieTotal.equinos > 0 ? fmt(Math.round(data.economicos.productoBruto.difInventario.equinos / data.eficienciaTecnica.superficieTotal.equinos)) : '-'}
                        </td>
                      </tr>

                      {/* + Lana (U$S) */}
                      <tr className="bg-blue-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">+ Lana (U$S)</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(data.economicos.productoBruto.lana.global)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.lana.global / (data.superficie.usandoSPG ? data.superficie.spg : data.superficie.total)))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(data.economicos.productoBruto.lana.ovinos)}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">
                          {fmt(Math.round(data.economicos.productoBruto.lana.ovinos / data.eficienciaTecnica.superficieTotal.ovinos))}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm text-gray-400">-</td>
                      </tr>

                      {/* 🆕 Si es MIXTO, agregar filas consolidadas */}
                      {esMixto && (
                        <>
                          <tr className="bg-yellow-50 hover:bg-yellow-100">
                            <td className="px-4 py-2 pl-12 text-sm font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-yellow-50 z-10">
                              = PB Ganadería
                            </td>
                            <td className="px-3 py-2 text-center border-b border-gray-200 text-sm font-medium">
                              {fmt(data.economicos.productoBruto.ganaderia)}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-gray-200 text-sm">
                              {fmt(data.economicos.productoBruto.ganaderiaHa)}
                            </td>
                            <td colSpan={6} className="px-3 py-2 text-center border-b border-gray-200 text-sm text-gray-500">
                              {data.economicos.productoBruto.porcentajeGanaderia.toFixed(1)}% del PB total
                            </td>
                          </tr>
                          <tr className="bg-green-50 hover:bg-green-100">
                            <td className="px-4 py-2 pl-12 text-sm font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-green-50 z-10">
                              + PB Agricultura
                            </td>
                            <td className="px-3 py-2 text-center border-b border-gray-200 text-sm font-medium">
                              {fmt(data.economicos.productoBruto.agricultura)}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-gray-200 text-sm">
                              {fmt(data.economicos.productoBruto.agriculturaHa)}
                            </td>
                            <td colSpan={6} className="px-3 py-2 text-center border-b border-gray-200 text-sm text-gray-500">
                              {data.economicos.productoBruto.porcentajeAgricultura.toFixed(1)}% del PB total
                            </td>
                          </tr>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Costos Totales - CLICKEABLE */}
                  <tr 
                    className="hover:bg-gray-100 bg-gray-50 cursor-pointer"
                    onClick={() => setCostosTotalesAbierto(!costosTotalesAbierto)}
                  >
                    <td className="px-4 py-2 font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-gray-50 z-10">
                      <div className="flex items-center gap-2">
                        {costosTotalesAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Costos Totales
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.costosTotales.total.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.costosTotales.porHa.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.costosTotales.total.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.costosTotales.porHa.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.costosTotales.total.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.costosTotales.porHa.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-medium">{fmt(data.economicos.costosTotales.total.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200">{fmt(data.economicos.costosTotales.porHa.equinos)}</td>
                  </tr>

                  {/* Desglose de Costos Totales */}
                  {costosTotalesAbierto && (
                    <>
                      <tr className="bg-gray-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">Costos fijos</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.total.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.porHa.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.total.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.porHa.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.total.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.porHa.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.total.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosFijos.porHa.equinos)}</td>
                      </tr>
                      <tr className="bg-gray-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">Costos variables</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.total.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.porHa.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.total.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.porHa.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.total.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.porHa.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.total.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosVariables.porHa.equinos)}</td>
                      </tr>
                      <tr className="bg-gray-25 hover:bg-gray-50">
                        <td className="px-4 py-2 pl-12 text-sm text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10">Costos renta</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.total.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.porHa.global)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.total.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.porHa.vacunos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.total.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.porHa.ovinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.total.equinos)}</td>
                        <td className="px-3 py-2 text-center border-b border-gray-100 text-sm">{fmt(data.economicos.costosRenta.porHa.equinos)}</td>
                      </tr>
                    </>
                  )}
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Relación insumo producto</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.relacionInsumoProducto.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.relacionInsumoProducto.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.relacionInsumoProducto.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.relacionInsumoProducto.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">IK</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.total.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.porHa.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.total.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.porHa.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.total.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.porHa.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.total.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ik.porHa.equinos)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">IKP</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.total.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.porHa.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.total.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.porHa.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.total.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.porHa.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.total.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmt(data.economicos.ikp.porHa.equinos)}</td>
                  </tr>
                  
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">U$S por kg producido</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.usdPorKgProducido.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.usdPorKgProducido.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.usdPorKgProducido.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.usdPorKgProducido.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100 sticky left-0 bg-white z-10">Costo por kg producido</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.costoPorKgProducido.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.costoPorKgProducido.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.costoPorKgProducido.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100">{fmtDec(data.economicos.costoPorKgProducido.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-100 text-gray-400">-</td>
                  </tr>
                  <tr className="hover:bg-blue-50 bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-gray-900 border-b border-gray-200 sticky left-0 bg-blue-50 z-10">Margen x kg</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-bold">{fmtDec(data.economicos.margenPorKg.global)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-bold">{fmtDec(data.economicos.margenPorKg.vacunos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-bold">{fmtDec(data.economicos.margenPorKg.ovinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 font-bold">{fmtDec(data.economicos.margenPorKg.equinos)}</td>
                    <td className="px-3 py-2 text-center border-b border-gray-200 text-gray-400">-</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-2 mb-4">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <h3 className="font-semibold text-gray-900">Fórmulas utilizadas</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-1">
              <p><span className="font-medium">Producción de carne:</span> Ventas (kg) + Consumo (kg) - Compras (kg) +/- Dif. Inventario (kg)</p>
              <p><span className="font-medium">Producto Bruto:</span> Ventas (U$S) + Consumo (U$S) - Compras (U$S) +/- Dif. Inv (U$S)</p>
              
              <p><span className="font-medium">Costos Totales:</span> Costos Fijos + Costos Variables + Costos Renta</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-medium">IK:</span> Producto Bruto - Costos (sin contar renta)</p>
              <p><span className="font-medium">IKP:</span> Producto Bruto - Costos Totales (con renta)</p>
              <p><span className="font-medium">Relación Insumo Producto:</span> Costos (sin renta e intereses) / Producto Bruto</p>
              <p><span className="font-medium">Margen x kg:</span> U$S por kg producido - Costo por kg producido</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}