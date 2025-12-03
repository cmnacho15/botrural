'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type CostoMensual = {
  id: string
  mes: number
  anio: number
  hectareasVacuno: number      // ✅ Debe estar
  hectareasOvino: number        // ✅ Debe estar
  hectareasEquino: number       // ✅ Debe estar
  hectareasDesperdicios: number // ✅ Debe estar
  hectareasTotal: number
  bloqueado: boolean
  notas?: string
  renglones: CostoRenglon[]
}

type CostoRenglon = {
  id: string
  categoria: string
  subcategoria: string
  orden: number
  montoTotalUSD: number
  montoVacunoUSD: number
  montoOvinoUSD: number
  montoEquinoUSD: number
  montoDesperdiciosUSD: number
  esTotal: boolean
  editable: boolean
  ultimaImportacion?: string
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const CATEGORIAS_LABELS: Record<string, string> = {
  COSTOS_FIJOS: 'Costos Fijos',
  ADMINISTRACION: 'Administración',
  INVER_MEJ_MANT: 'Inver-Mej-Mant',
  SUELDOS_INCENTIVOS: 'Sueldos e incentivos',
  PATENTES_SEGUROS: 'Patentes/Seguros',
  TEL_ANTEL_OSE: 'TEL/ANTEL/OSE',
  COMESTIBLES: 'Comestibles',
  COMBUSTIBLES: 'Combustibles',
  MECANICA_MAQUINARIA: 'Mecanica / Maquinaria',
  GASTOS_VERDEOS: 'Gastos Verdeos y Praderas',
  IMPUESTOS: 'Impuestos',
  GASTOS_EQUINOS: 'Gastos Equinos',
  GASTOS_FAMILIA: 'Gastos Familia',
  GASTOS_ABUSC_CECLE: 'Gastos ABU-SC y CECLE',
  COSTOS_VARIABLES: 'Costos variables y directos',
}

const CATEGORIA_COLORES: Record<string, string> = {
  COSTOS_FIJOS: '#FFC107',
  ADMINISTRACION: '#FF9800',
  INVER_MEJ_MANT: '#F44336',
  SUELDOS_INCENTIVOS: '#9C27B0',
  PATENTES_SEGUROS: '#3F51B5',
  TEL_ANTEL_OSE: '#2196F3',
  COMESTIBLES: '#00BCD4',
  COMBUSTIBLES: '#009688',
  MECANICA_MAQUINARIA: '#4CAF50',
  GASTOS_VERDEOS: '#8BC34A',
  IMPUESTOS: '#CDDC39',
  GASTOS_EQUINOS: '#795548',
  GASTOS_FAMILIA: '#607D8B',
  GASTOS_ABUSC_CECLE: '#9E9E9E',
  COSTOS_VARIABLES: '#FF5722',
}

export default function CostosEstructuradosPage() {
  const router = useRouter()
  
  const [costosMensuales, setCostosMensuales] = useState<CostoMensual[]>([])
  const [costoActual, setCostoActual] = useState<CostoMensual | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingImportar, setLoadingImportar] = useState(false)
  
  // Modales
  const [modalNuevoMes, setModalNuevoMes] = useState(false)
  const [modalEditarHectareas, setModalEditarHectareas] = useState(false)
  
  // Formulario nuevo mes
  const [nuevoMes, setNuevoMes] = useState(new Date().getMonth() + 1)
  const [nuevoAnio, setNuevoAnio] = useState(new Date().getFullYear())
  const [hectareasVacuno, setHectareasVacuno] = useState(0)
  const [hectareasOvino, setHectareasOvino] = useState(0)
  const [hectareasEquino, setHectareasEquino] = useState(0)
  const [hectareasDesperdicios, setHectareasDesperdicios] = useState(0)

  // Edición inline
  const [celdasEditando, setCeldasEditando] = useState<Record<string, number>>({})

  // 🆕 NUEVOS ESTADOS PARA DISTRIBUCIÓN AUTOMÁTICA
  const [distribucionAutomatica, setDistribucionAutomatica] = useState<any>(null)
  const [usarDistribucionAuto, setUsarDistribucionAuto] = useState(true)

  useEffect(() => {
    cargarCostos()
  }, [])

  // 🆕 CARGAR DISTRIBUCIÓN AUTOMÁTICA AL INICIAR
  useEffect(() => {
    cargarDistribucionAutomatica()
  }, [])

  const cargarDistribucionAutomatica = async () => {
    try {
      const res = await fetch('/api/costos-estructurados/calcular-distribucion')
      if (res.ok) {
        const data = await res.json()
        setDistribucionAutomatica(data)
      }
    } catch (error) {
      console.error('Error cargando distribución:', error)
    }
  }

  const cargarCostos = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/costos-estructurados')
      if (res.ok) {
        const data = await res.json()
        setCostosMensuales(data)
        
        // Seleccionar el más reciente por defecto
        if (data.length > 0 && !costoActual) {
          setCostoActual(data[0])
        }
      }
    } catch (error) {
      console.error('Error cargando costos:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🔧 FUNCIÓN MODIFICADA: crearNuevoMes con distribución automática
  const crearNuevoMes = async () => {
    try {
      // Si está activado "usar distribución automática", usar esos valores
      let hectareasFinales = {
        hectareasVacuno,
        hectareasOvino,
        hectareasEquino,
        hectareasDesperdicios,
      }

      if (usarDistribucionAuto && distribucionAutomatica) {
        hectareasFinales = {
          hectareasVacuno: distribucionAutomatica.hectareasVacuno,
          hectareasOvino: distribucionAutomatica.hectareasOvino,
          hectareasEquino: distribucionAutomatica.hectareasEquino,
          hectareasDesperdicios: distribucionAutomatica.hectareasDesperdicios,
        }
      }

      const res = await fetch('/api/costos-estructurados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes: nuevoMes,
          anio: nuevoAnio,
          ...hectareasFinales,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al crear mes')
        return
      }

      const nuevoCosto = await res.json()
      setCostosMensuales([nuevoCosto, ...costosMensuales])
      setCostoActual(nuevoCosto)
      setModalNuevoMes(false)
      alert('Mes creado exitosamente')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear mes')
    }
  }

  const importarGastos = async () => {
    if (!costoActual) return

    if (!confirm('¿Importar gastos del mes desde la página de Gastos? Esto sobrescribirá los valores importados anteriormente.')) {
      return
    }

    try {
      setLoadingImportar(true)
      const res = await fetch(`/api/costos-estructurados/${costoActual.id}/importar`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al importar')
        return
      }

      const resultado = await res.json()
      alert(`Importados ${resultado.gastosImportados} gastos en ${resultado.categoriasActualizadas} categorías`)
      
      await cargarCostos()
      
      const resActual = await fetch(`/api/costos-estructurados/${costoActual.id}`)
      if (resActual.ok) {
        const dataActual = await resActual.json()
        setCostoActual(dataActual)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al importar gastos')
    } finally {
      setLoadingImportar(false)
    }
  }

  const editarCelda = async (renglonId: string, campo: string, valor: number) => {
    if (!costoActual) return

    try {
      const res = await fetch(
        `/api/costos-estructurados/${costoActual.id}/renglones/${renglonId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [campo]: valor }),
        }
      )

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al actualizar')
        return
      }

      const resActual = await fetch(`/api/costos-estructurados/${costoActual.id}`)
      if (resActual.ok) {
        const dataActual = await resActual.json()
        setCostoActual(dataActual)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar celda')
    }
  }

  const guardarHectareas = async () => {
    if (!costoActual) return

    try {
      const res = await fetch(`/api/costos-estructurados/${costoActual.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hectareasVacuno,
          hectareasOvino,
          hectareasEquino,
          hectareasDesperdicios,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Error al actualizar')
        return
      }

      const actualizado = await res.json()
      setCostoActual(actualizado)
      
      setCostosMensuales(costosMensuales.map(c => 
        c.id === actualizado.id ? actualizado : c
      ))
      
      setModalEditarHectareas(false)
      alert('Hectáreas actualizadas')
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar hectáreas')
    }
  }

  // Agrupar renglones por categoría
  const renglonesPorCategoria = costoActual?.renglones.reduce((acc, r) => {
    if (!acc[r.categoria]) acc[r.categoria] = []
    acc[r.categoria].push(r)
    return acc
  }, {} as Record<string, CostoRenglon[]>) || {}

  // Calcular totales generales
  const totalesGenerales = costoActual?.renglones
    .filter(r => r.esTotal)
    .reduce(
      (acc, r) => ({
        total: acc.total + r.montoTotalUSD,
        vacuno: acc.vacuno + r.montoVacunoUSD,
        ovino: acc.ovino + r.montoOvinoUSD,
        equino: acc.equino + r.montoEquinoUSD,
        desperdicios: acc.desperdicios + r.montoDesperdiciosUSD,
      }),
      { total: 0, vacuno: 0, ovino: 0, equino: 0, desperdicios: 0 }
    ) || { total: 0, vacuno: 0, ovino: 0, equino: 0, desperdicios: 0 }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Cargando costos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xl">Money</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Costos Estructurados
            </h1>
          </div>

          <div className="flex gap-2">
            <Link
              href="/costos-estructurados/mapeo"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Configurar Mapeo
            </Link>
            <button
              onClick={() => setModalNuevoMes(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Nuevo Mes
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {costosMensuales.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">Chart</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay meses registrados
            </h2>
            <p className="text-gray-600 mb-6">
              Creá tu primer mes para comenzar a registrar costos estructurados
            </p>
            <button
              onClick={() => setModalNuevoMes(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              + Crear Primer Mes
            </button>
          </div>
        ) : (
          <>
            {/* SELECTOR DE MES */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Ver mes:</label>
                  <select
                    value={costoActual?.id || ''}
                    onChange={(e) => {
                      const seleccionado = costosMensuales.find(c => c.id === e.target.value)
                      setCostoActual(seleccionado || null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {costosMensuales.map((c) => (
                      <option key={c.id} value={c.id}>
                        {MESES[c.mes - 1]} {c.anio}
                      </option>
                    ))}
                  </select>
                </div>

                {costoActual && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setHectareasVacuno(costoActual.hectareasVacuno)
                        setHectareasOvino(costoActual.hectareasOvino)
                        setHectareasEquino(costoActual.hectareasEquino)
                        setHectareasDesperdicios(costoActual.hectareasDesperdicios)
                        setModalEditarHectareas(true)
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      Editar Hectáreas
                    </button>
                    <button
                      onClick={importarGastos}
                      disabled={loadingImportar || costoActual.bloqueado}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {loadingImportar ? 'Importando...' : 'Importar Gastos'}
                    </button>
                  </div>
                )}
              </div>

              {/* DISTRIBUCIÓN DE HECTÁREAS */}
              {costoActual && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Vacuno:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {costoActual.hectareasVacuno} ha ({((costoActual.hectareasVacuno / costoActual.hectareasTotal) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Ovino:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {costoActual.hectareasOvino} ha ({((costoActual.hectareasOvino / costoActual.hectareasTotal) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Equino:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {costoActual.hectareasEquino} ha ({((costoActual.hectareasEquino / costoActual.hectareasTotal) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Desperdicios:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {costoActual.hectareasDesperdicios} ha
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <span className="ml-2 font-bold text-blue-600">
                        {costoActual.hectareasTotal} ha
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TABLA DE COSTOS */}
            {costoActual && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$ Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$/ha
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$ Vacuno
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$/ha
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$ Ovino
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$/ha
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$ Equino
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          US$/ha
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(renglonesPorCategoria).map(([catKey, renglones]) => (
                        <tbody key={catKey}>
                          {/* HEADER DE CATEGORÍA */}
                          <tr
                            className="font-bold"
                            style={{
                              backgroundColor: `${CATEGORIA_COLORES[catKey]}20`,
                              borderLeft: `4px solid ${CATEGORIA_COLORES[catKey]}`,
                            }}
                          >
                            <td
                              className="px-4 py-3 text-sm sticky left-0 z-10"
                              style={{ backgroundColor: `${CATEGORIA_COLORES[catKey]}20` }}
                            >
                              {CATEGORIAS_LABELS[catKey] || catKey}
                            </td>
                            <td colSpan={8} />
                          </tr>

                          {/* RENGLONES DE LA CATEGORÍA */}
                          {renglones.map((renglon) => {
                            const esTotal = renglon.subcategoria === 'TOTAL'
                            const usdPorHaTotal = costoActual.hectareasTotal > 0 ? renglon.montoTotalUSD / costoActual.hectareasTotal : 0
                            const usdPorHaVacuno = costoActual.hectareasVacuno > 0 ? renglon.montoVacunoUSD / costoActual.hectareasVacuno : 0
                            const usdPorHaOvino = costoActual.hectareasOvino > 0 ? renglon.montoOvinoUSD / costoActual.hectareasOvino : 0
                            const usdPorHaEquino = costoActual.hectareasEquino > 0 ? renglon.montoEquinoUSD / costoActual.hectareasEquino : 0

                            return (
                              <tr
                                key={renglon.id}
                                className={`hover:bg-gray-50 ${esTotal ? 'bg-gray-100 font-semibold' : ''}`}
                              >
                                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">
                                  <span className="pl-4">{renglon.subcategoria}</span>
                                </td>
                                
                                {/* TOTAL USD */}
                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                  {renglon.editable && !esTotal ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={celdasEditando[`${renglon.id}-total`] ?? renglon.montoTotalUSD}
                                      onChange={(e) => {
                                        setCeldasEditando({
                                          ...celdasEditando,
                                          [`${renglon.id}-total`]: parseFloat(e.target.value) || 0,
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const valor = parseFloat(e.target.value) || 0
                                        if (valor !== renglon.montoTotalUSD) {
                                          editarCelda(renglon.id, 'montoTotalUSD', valor)
                                        }
                                      }}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                                    />
                                  ) : (
                                    renglon.montoTotalUSD.toFixed(0)
                                  )}
                                </td>
                                
                                {/* USD/HA TOTAL */}
                                <td className="px-4 py-2 text-sm text-right text-gray-600">
                                  {usdPorHaTotal.toFixed(1)}
                                </td>

                                {/* VACUNO USD */}
                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                  {renglon.editable && !esTotal ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={celdasEditando[`${renglon.id}-vacuno`] ?? renglon.montoVacunoUSD}
                                      onChange={(e) => {
                                        setCeldasEditando({
                                          ...celdasEditando,
                                          [`${renglon.id}-vacuno`]: parseFloat(e.target.value) || 0,
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const valor = parseFloat(e.target.value) || 0
                                        if (valor !== renglon.montoVacunoUSD) {
                                          editarCelda(renglon.id, 'montoVacunoUSD', valor)
                                        }
                                      }}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                                    />
                                  ) : (
                                    renglon.montoVacunoUSD.toFixed(0)
                                  )}
                                </td>
                                
                                {/* USD/HA VACUNO */}
                                <td className="px-4 py-2 text-sm text-right text-gray-600">
                                  {usdPorHaVacuno.toFixed(1)}
                                </td>

                                {/* OVINO USD */}
                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                  {renglon.editable && !esTotal ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={celdasEditando[`${renglon.id}-ovino`] ?? renglon.montoOvinoUSD}
                                      onChange={(e) => {
                                        setCeldasEditando({
                                          ...celdasEditando,
                                          [`${renglon.id}-ovino`]: parseFloat(e.target.value) || 0,
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const valor = parseFloat(e.target.value) || 0
                                        if (valor !== renglon.montoOvinoUSD) {
                                          editarCelda(renglon.id, 'montoOvinoUSD', valor)
                                        }
                                      }}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                                    />
                                  ) : (
                                    renglon.montoOvinoUSD.toFixed(0)
                                  )}
                                </td>
                                
                                {/* USD/HA OVINO */}
                                <td className="px-4 py-2 text-sm text-right text-gray-600">
                                  {usdPorHaOvino.toFixed(1)}
                                </td>

                                {/* EQUINO USD */}
                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                  {renglon.editable && !esTotal ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={celdasEditando[`${renglon.id}-equino`] ?? renglon.montoEquinoUSD}
                                      onChange={(e) => {
                                        setCeldasEditando({
                                          ...celdasEditando,
                                          [`${renglon.id}-equino`]: parseFloat(e.target.value) || 0,
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const valor = parseFloat(e.target.value) || 0
                                        if (valor !== renglon.montoEquinoUSD) {
                                          editarCelda(renglon.id, 'montoEquinoUSD', valor)
                                        }
                                      }}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                                    />
                                  ) : (
                                    renglon.montoEquinoUSD.toFixed(0)
                                  )}
                                </td>
                                
                                {/* USD/HA EQUINO */}
                                <td className="px-4 py-2 text-sm text-right text-gray-600">
                                  {usdPorHaEquino.toFixed(1)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      ))}

                      {/* TOTALES GENERALES */}
                      <tr className="bg-blue-50 border-t-4 border-blue-600 font-bold text-lg">
                        <td className="px-4 py-4 text-sm sticky left-0 bg-blue-50">
                          COSTO TOTAL
                        </td>
                        <td className="px-4 py-4 text-right text-blue-900">
                          {totalesGenerales.total.toFixed(0)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-700">
                          {(totalesGenerales.total / costoActual.hectareasTotal).toFixed(0)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-900">
                          {totalesGenerales.vacuno.toFixed(0)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-700">
                          {costoActual.hectareasVacuno > 0
  ? (totalesGenerales.vacuno / costoActual.hectareasVacuno).toFixed(0)
  : '0'}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-900">
                          {totalesGenerales.ovino.toFixed(0)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-700">
                          {costoActual.hectareasOvino > 0
                            ? (totalesGenerales.ovino / costoActual.hectareasOvino).toFixed(0)
                            : '0'}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-900">
                          {totalesGenerales.equino.toFixed(0)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-700">
                          {costoActual.hectareasEquino > 0
                            ? (totalesGenerales.equino / costoActual.hectareasEquino).toFixed(0)
                            : '0'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL NUEVO MES - VERSIÓN MEJORADA CON DISTRIBUCIÓN AUTOMÁTICA */}
      {modalNuevoMes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Mes</h2>
              <button
                onClick={() => setModalNuevoMes(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Mes y Año */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
                  <select
                    value={nuevoMes}
                    onChange={(e) => setNuevoMes(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {MESES.map((mes, idx) => (
                      <option key={idx} value={idx + 1}>
                        {mes}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                  <input
                    type="number"
                    value={nuevoAnio}
                    onChange={(e) => setNuevoAnio(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* CHECKBOX PARA USAR DISTRIBUCIÓN AUTOMÁTICA */}
              {distribucionAutomatica && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={usarDistribucionAuto}
                      onChange={(e) => setUsarDistribucionAuto(e.target.checked)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <label className="text-sm font-medium text-blue-900 cursor-pointer">
                        Usar distribución automática desde potreros
                      </label>
                      <p className="text-xs text-blue-700 mt-1">
                        Calcula las hectáreas según las UG actuales de tus animales
                      </p>
                      
                      {usarDistribucionAuto && (
                        <div className="mt-3 p-3 bg-white rounded border border-blue-200 text-sm">
                          <div className="font-semibold text-blue-900 mb-2">Distribución calculada:</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600">Vacuno:</span>
                              <span className="ml-2 font-medium">{distribucionAutomatica.hectareasVacuno} ha ({distribucionAutomatica.porcentajes.vacuno.toFixed(0)}%)</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Ovino:</span>
                              <span className="ml-2 font-medium">{distribucionAutomatica.hectareasOvino} ha ({distribucionAutomatica.porcentajes.ovino.toFixed(0)}%)</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Equino:</span>
                              <span className="ml-2 font-medium">{distribucionAutomatica.hectareasEquino} ha ({distribucionAutomatica.porcentajes.equino.toFixed(0)}%)</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Total:</span>
                              <span className="ml-2 font-bold text-blue-600">{distribucionAutomatica.totalHectareas} ha</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-blue-100 text-xs text-blue-700">
                            Carga global: <strong>{distribucionAutomatica.cargaGlobal.toFixed(2)} UG/ha</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* HECTÁREAS MANUALES (solo si NO usa automática) */}
              {!usarDistribucionAuto && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h3 className="font-semibold text-gray-900">Distribución Manual de Hectáreas</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Vacuno</label>
                      <input
                        type="number"
                        step="0.01"
                        value={hectareasVacuno}
                        onChange={(e) => setHectareasVacuno(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Ovino</label>
                      <input
                        type="number"
                        step="0.01"
                        value={hectareasOvino}
                        onChange={(e) => setHectareasOvino(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Equino</label>
                      <input
                        type="number"
                        step="0.01"
                        value={hectareasEquino}
                        onChange={(e) => setHectareasEquino(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Desperdicios</label>
                      <input
                        type="number"
                        step="0.01"
                        value={hectareasDesperdicios}
                        onChange={(e) => setHectareasDesperdicios(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Total: </span>
                    <span className="text-lg font-bold text-blue-600">
                      {(hectareasVacuno + hectareasOvino + hectareasEquino + hectareasDesperdicios).toFixed(2)} ha
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setModalNuevoMes(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={crearNuevoMes}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Crear Mes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR HECTÁREAS (sin cambios) */}
      {modalEditarHectareas && costoActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Editar Hectáreas - {MESES[costoActual.mes - 1]} {costoActual.anio}
              </h2>
              <button
                onClick={() => setModalEditarHectareas(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Vacuno</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hectareasVacuno}
                    onChange={(e) => setHectareasVacuno(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Ovino</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hectareasOvino}
                    onChange={(e) => setHectareasOvino(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Equino</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hectareasEquino}
                    onChange={(e) => setHectareasEquino(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Desperdicios</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hectareasDesperdicios}
                    onChange={(e) => setHectareasDesperdicios(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Total: </span>
                <span className="text-lg font-bold text-blue-600">
                  {(hectareasVacuno + hectareasOvino + hectareasEquino + hectareasDesperdicios).toFixed(2)} ha
                </span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setModalEditarHectareas(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={guardarHectareas}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}