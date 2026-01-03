'use client'

import { useState } from 'react'

type ModalExportExcelProps = {
  isOpen: boolean
  onClose: () => void
}

type GrupoHojas = {
  nombre: string
  key: string
  hojas: { key: string; label: string }[]
}

const GRUPOS_HOJAS: GrupoHojas[] = [
  {
    nombre: 'Ganaderos',
    key: 'ganaderos',
    hojas: [
      { key: 'tratamientos', label: 'Tratamientos' },
      { key: 'movimientosGanaderos', label: 'Movimientos Ganaderos' },
      { key: 'cambiosPotrero', label: 'Cambios de Potrero' },
      { key: 'tactos', label: 'Tactos' },
      { key: 'recategorizaciones', label: 'Recategorizaciones' },
    ],
  },
  {
    nombre: 'Agricultura',
    key: 'agricultura',
    hojas: [
      { key: 'siembras', label: 'Siembras' },
      { key: 'pulverizaciones', label: 'Pulverizaciones' },
      { key: 'fertilizaciones', label: 'Fertilizaciones' },
      { key: 'cosechas', label: 'Cosechas' },
      { key: 'riegos', label: 'Riegos' },
      { key: 'monitoreos', label: 'Monitoreos' },
      { key: 'otrasLabores', label: 'Otras Labores' },
    ],
  },
  {
    nombre: 'Otros',
    key: 'otros',
    hojas: [
      { key: 'lluvia', label: 'Lluvia' },
      { key: 'heladas', label: 'Heladas' },
      { key: 'insumos', label: 'Insumos' },
      { key: 'gastosIngresos', label: 'Gastos e Ingresos' },
      { key: 'traslados', label: 'Traslados' },
    ],
  },
]

export default function ModalExportExcel({ isOpen, onClose }: ModalExportExcelProps) {
  const [hojasSeleccionadas, setHojasSeleccionadas] = useState<Record<string, boolean>>({})
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({
    ganaderos: true,
    agricultura: false,
    otros: false,
  })
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [descargando, setDescargando] = useState(false)

  if (!isOpen) return null

  // Verificar si un grupo está completamente seleccionado
  const grupoCompleto = (grupo: GrupoHojas) => {
    return grupo.hojas.every((h) => hojasSeleccionadas[h.key])
  }

  // Verificar si un grupo tiene alguna selección
  const grupoPartial = (grupo: GrupoHojas) => {
    const seleccionadas = grupo.hojas.filter((h) => hojasSeleccionadas[h.key]).length
    return seleccionadas > 0 && seleccionadas < grupo.hojas.length
  }

  // Toggle grupo completo
  const toggleGrupo = (grupo: GrupoHojas) => {
    const nuevoEstado = !grupoCompleto(grupo)
    const nuevasHojas = { ...hojasSeleccionadas }
    grupo.hojas.forEach((h) => {
      nuevasHojas[h.key] = nuevoEstado
    })
    setHojasSeleccionadas(nuevasHojas)
  }

  // Toggle hoja individual
  const toggleHoja = (key: string) => {
    setHojasSeleccionadas((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Toggle grupo abierto/cerrado
  const toggleGrupoAbierto = (key: string) => {
    setGruposAbiertos((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Contar hojas seleccionadas
  const cantidadSeleccionadas = Object.values(hojasSeleccionadas).filter(Boolean).length

  // Descargar Excel
  const handleDescargar = async () => {
    if (cantidadSeleccionadas === 0) {
      alert('Seleccioná al menos una hoja para exportar')
      return
    }

    setDescargando(true)
    try {
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hojas: hojasSeleccionadas,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al generar Excel')
      }

      // Descargar archivo
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Obtener nombre del archivo del header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'export.xlsx'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = decodeURIComponent(match[1])
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      onClose()
    } catch (error: any) {
      alert(error.message || 'Error al descargar')
    } finally {
      setDescargando(false)
    }
  }

  // Seleccionar todo
  const seleccionarTodo = () => {
    const nuevasHojas: Record<string, boolean> = {}
    GRUPOS_HOJAS.forEach((grupo) => {
      grupo.hojas.forEach((h) => {
        nuevasHojas[h.key] = true
      })
    })
    setHojasSeleccionadas(nuevasHojas)
  }

  // Limpiar selección
  const limpiarSeleccion = () => {
    setHojasSeleccionadas({})
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Descargar a Excel</h2>
              <p className="text-sm text-gray-500">Exportar datos del campo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Rango de fechas */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Rango de Fechas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Seleccionar datos */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Seleccionar Datos</h3>
              <div className="flex gap-2">
                <button
                  onClick={seleccionarTodo}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Seleccionar todo
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={limpiarSeleccion}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {GRUPOS_HOJAS.map((grupo) => (
                <div key={grupo.key} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header del grupo */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => toggleGrupoAbierto(grupo.key)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleGrupo(grupo)
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        grupoCompleto(grupo)
                          ? 'border-blue-500 bg-blue-500'
                          : grupoPartial(grupo)
                          ? 'border-blue-500 bg-blue-200'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {grupoCompleto(grupo) && <span className="text-white text-xs">✓</span>}
                      {grupoPartial(grupo) && <span className="text-blue-600 text-xs">—</span>}
                    </button>
                    <span className="font-medium text-gray-900 flex-1">{grupo.nombre}</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${gruposAbiertos[grupo.key] ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Hojas del grupo */}
                  {gruposAbiertos[grupo.key] && (
                    <div className="p-2 space-y-1 bg-white">
                      {grupo.hojas.map((hoja) => (
                        <button
                          key={hoja.key}
                          onClick={() => toggleHoja(hoja.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                            hojasSeleccionadas[hoja.key]
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              hojasSeleccionadas[hoja.key] ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}
                          >
                            {hojasSeleccionadas[hoja.key] && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="text-sm">{hoja.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDescargar}
            disabled={descargando || cantidadSeleccionadas === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {descargando ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar {cantidadSeleccionadas > 0 && `(${cantidadSeleccionadas} hojas)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}