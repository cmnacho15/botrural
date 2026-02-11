'use client'

import { useState } from 'react'
import { toast } from '@/app/components/Toast'

type ModalImportarGastosProps = {
  onClose: () => void
  onSuccess: () => void
}

type Paso = 1 | 2 | 3

export default function ModalImportarGastos({ onClose, onSuccess }: ModalImportarGastosProps) {
  const [paso, setPaso] = useState<Paso>(1)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [importando, setImportando] = useState(false)

  // Paso 2: Mapeo
  const [headers, setHeaders] = useState<string[]>([])
  const [mapeo, setMapeo] = useState<Record<string, string | null>>({})
  const [vista, setVista] = useState<{ headers: string[]; primeras5Filas: any[][] }>({ headers: [], primeras5Filas: [] })
  const [totalFilas, setTotalFilas] = useState(0)
  const [columnasNoMapeadas, setColumnasNoMapeadas] = useState<string[]>([])
  const [necesitaTasaCambio, setNecesitaTasaCambio] = useState(false)
  const [tasaCambio, setTasaCambio] = useState('')

  // Paso 3: Resultado
  const [resultado, setResultado] = useState<{
    totalFilas: number
    filasImportadas: number
    filasConError: number
    errores: any[]
    totalGastos?: number
    totalIngresos?: number
  } | null>(null)

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar extensión
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Solo se permiten archivos Excel (.xlsx, .xls)')
      return
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe superar 5MB')
      return
    }

    setArchivo(file)
    setAnalizando(true)

    try {
      // Analizar archivo con IA
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/gastos/analizar-archivo', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al analizar archivo')
      }

      const data = await response.json()

      setHeaders(data.headers)
      setMapeo(data.mapeo)
      setVista(data.vista)
      setTotalFilas(data.totalFilas)
      setColumnasNoMapeadas(data.columnasNoMapeadas || [])

      // Detectar si necesita tasa de cambio
      const tieneMonedaUYU = data.mapeo.moneda && data.vista.primeras5Filas.some(
        (fila: any[]) => {
          const moneda = fila[data.headers.indexOf(data.mapeo.moneda)]
          return moneda && (moneda.toUpperCase() === 'UYU' || moneda.toUpperCase() === '$U')
        }
      )
      setNecesitaTasaCambio(tieneMonedaUYU)

      setPaso(2)
    } catch (error) {
      toast.error('Error al analizar el archivo')
      console.error(error)
    } finally {
      setAnalizando(false)
    }
  }

  const handleImportar = async () => {
    if (!archivo) return

    if (necesitaTasaCambio && (!tasaCambio || parseFloat(tasaCambio) <= 0)) {
      toast.error('Debes ingresar una tasa de cambio válida')
      return
    }

    setImportando(true)

    try {
      const formData = new FormData()
      formData.append('file', archivo)

      // Convertir mapeo de nombres de columnas a índices
      const mapeoIndices: Record<string, number> = {}
      for (const [campo, columna] of Object.entries(mapeo)) {
        if (columna) {
          mapeoIndices[campo] = headers.indexOf(columna)
        }
      }

      formData.append('mapeoColumnas', JSON.stringify(mapeoIndices))
      if (tasaCambio) {
        formData.append('tasaCambio', tasaCambio)
      }

      const response = await fetch('/api/gastos/importar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al importar gastos')
      }

      const data = await response.json()
      setResultado(data.importacion)
      setPaso(3)

      // Notificar éxito
      if (data.importacion.filasConError === 0) {
        toast.success(`Se importaron ${data.importacion.filasImportadas} gastos correctamente`)
      } else {
        toast.info(`Se importaron ${data.importacion.filasImportadas} gastos, ${data.importacion.filasConError} con errores`)
      }
    } catch (error) {
      toast.error('Error al importar gastos')
      console.error(error)
    } finally {
      setImportando(false)
    }
  }

  const handleFinalizar = () => {
    onSuccess()
    onClose()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            📊
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Importar Gastos</h2>
            <p className="text-sm text-gray-500">
              {paso === 1 && 'Paso 1: Subir archivo Excel'}
              {paso === 2 && 'Paso 2: Revisar mapeo de columnas'}
              {paso === 3 && 'Paso 3: Importación completada'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${paso >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            1. Subir
          </span>
          <span className={`text-sm font-medium ${paso >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            2. Mapear
          </span>
          <span className={`text-sm font-medium ${paso >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            3. Confirmar
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(paso / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* PASO 1: Subir archivo */}
      {paso === 1 && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleArchivoSeleccionado}
              className="hidden"
              id="file-upload"
              disabled={analizando}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-700 mb-2">
                {analizando ? 'Analizando archivo...' : 'Seleccionar archivo Excel'}
              </p>
              <p className="text-sm text-gray-500">
                Formatos: .xlsx, .xls • Máximo: 5MB • Límite: 500 filas
              </p>
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Formato recomendado</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Fecha:</strong> Formato DD/MM/AA o DD/MM/AAAA</li>
              <li>• <strong>Monto:</strong> Números (pueden tener puntos o comas como separadores)</li>
              <li>• <strong>Proveedor:</strong> Nombre del comercio o proveedor (opcional)</li>
              <li>• <strong>Descripción:</strong> Concepto del gasto (opcional)</li>
              <li>• <strong>Categoría:</strong> Nombre de la categoría (opcional)</li>
              <li>• <strong>Moneda:</strong> USD o UYU (opcional, por defecto USD)</li>
            </ul>
          </div>
        </div>
      )}

      {/* PASO 2: Mapeo de columnas */}
      {paso === 2 && (
        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              ℹ️ La IA detectó automáticamente el mapeo de columnas. Puedes ajustarlo si es necesario.
              <br />
              <strong>Total de filas a importar: {totalFilas}</strong>
            </p>
          </div>

          {/* Mapeo de columnas */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Mapeo de columnas</h3>

            {/* Fecha */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">
                Fecha <span className="text-red-500">*</span>
              </label>
              <select
                value={mapeo.fecha || ''}
                onChange={(e) => setMapeo({ ...mapeo, fecha: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccionar columna --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">
                Monto <span className="text-red-500">*</span>
              </label>
              <select
                value={mapeo.monto || ''}
                onChange={(e) => setMapeo({ ...mapeo, monto: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccionar columna --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Proveedor */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Proveedor</label>
              <select
                value={mapeo.proveedor || ''}
                onChange={(e) => setMapeo({ ...mapeo, proveedor: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No usar --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Descripción</label>
              <select
                value={mapeo.descripcion || ''}
                onChange={(e) => setMapeo({ ...mapeo, descripcion: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No usar --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Categoría</label>
              <select
                value={mapeo.categoria || ''}
                onChange={(e) => setMapeo({ ...mapeo, categoria: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No usar --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Moneda */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Moneda</label>
              <select
                value={mapeo.moneda || ''}
                onChange={(e) => setMapeo({ ...mapeo, moneda: e.target.value || null })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Asumir USD --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasa de cambio si es necesario */}
          {necesitaTasaCambio && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⚠️ Tasa de cambio UYU → USD <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={tasaCambio}
                onChange={(e) => setTasaCambio(e.target.value)}
                placeholder="Ej: 40.50"
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-yellow-700 mt-1">
                Se detectaron gastos en UYU. Ingresa la tasa de cambio para convertir a USD.
              </p>
            </div>
          )}

          {/* Vista previa */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Vista previa (primeras 5 filas)</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {vista.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vista.primeras5Filas.map((fila, i) => (
                    <tr key={i} className="border-b">
                      {fila.map((val, j) => (
                        <td key={j} className="px-3 py-2 text-gray-600">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={() => setPaso(1)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Atrás
            </button>
            <button
              onClick={handleImportar}
              disabled={!mapeo.fecha || !mapeo.monto || importando}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {importando ? 'Importando...' : 'Importar gastos'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Resultado */}
      {paso === 3 && resultado && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-green-900 mb-2">
              ¡Importación completada!
            </h3>
            <p className="text-green-700">
              Se importaron <strong>{resultado.filasImportadas}</strong> de <strong>{resultado.totalFilas}</strong> gastos
            </p>
          </div>

          {/* Detalles */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{resultado.totalFilas}</div>
              <div className="text-sm text-blue-700">Total filas</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{resultado.filasImportadas}</div>
              <div className="text-sm text-green-700">Importadas</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{resultado.filasConError}</div>
              <div className="text-sm text-red-700">Con errores</div>
            </div>
          </div>

          {/* Desglose Gastos/Ingresos */}
          {(resultado.totalGastos !== undefined || resultado.totalIngresos !== undefined) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{resultado.totalGastos || 0}</div>
                <div className="text-sm text-orange-700">💸 Gastos</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{resultado.totalIngresos || 0}</div>
                <div className="text-sm text-emerald-700">💰 Ingresos</div>
              </div>
            </div>
          )}

          {/* Errores */}
          {resultado.filasConError > 0 && resultado.errores && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Filas con errores:</h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {resultado.errores.map((err: any, i: number) => (
                  <div key={i} className="text-sm text-red-700">
                    • Fila {err.fila}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón finalizar */}
          <button
            onClick={handleFinalizar}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Finalizar
          </button>
        </div>
      )}
    </div>
  )
}
