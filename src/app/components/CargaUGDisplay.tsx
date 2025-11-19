'use client'

import { calcularEstadisticasLote, evaluarCarga, EQUIVALENCIAS_UG } from '@/lib/ugCalculator'

interface Animal {
  id: string
  categoria: string
  cantidad: number
}

interface Lote {
  id: string
  nombre: string
  hectareas: number
  animalesLote?: Animal[]
}

interface CargaUGDisplayProps {
  lote: Lote
}

/**
 * Componente para mostrar cálculos de UG de un lote individual
 */
export function CargaUGDisplay({ lote }: CargaUGDisplayProps) {
  const stats = calcularEstadisticasLote(lote)
  const evaluacion = evaluarCarga(stats.cargaGlobal)

  if (!lote.animalesLote || lote.animalesLote.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-gray-500 text-sm italic">
          Sin animales registrados en este potrero
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold text-gray-900 text-lg">
          📊 Análisis de Carga - {lote.nombre}
        </h3>
        <span className="text-sm text-gray-500">
          {stats.hectareas.toFixed(2)} ha
        </span>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total UG */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">Total UG</p>
          <p className="text-2xl font-bold text-blue-900">
            {stats.ugTotales.toFixed(2)}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {stats.totalAnimales} animales
          </p>
        </div>

        {/* Carga Global */}
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium mb-1">
            Carga Global
          </p>
          <p className="text-2xl font-bold text-green-900">
            {stats.cargaGlobal.toFixed(2)}
          </p>
          <p className="text-xs text-green-600 mt-1">UG/ha</p>
        </div>

        {/* Carga Instantánea */}
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium mb-1">
            Carga Instantánea
          </p>
          <p className="text-2xl font-bold text-purple-900">
            {stats.cargaInstantanea.toFixed(2)}
          </p>
          <p className="text-xs text-purple-600 mt-1">UG/ha (actual)</p>
        </div>
      </div>

      {/* Evaluación */}
      <div className={`rounded-lg p-4 border-2 ${
        evaluacion.nivel === 'optima' ? 'bg-green-50 border-green-300' :
        evaluacion.nivel === 'baja' ? 'bg-blue-50 border-blue-300' :
        evaluacion.nivel === 'alta' ? 'bg-orange-50 border-orange-300' :
        'bg-red-50 border-red-300'
      }`}>
        <p className={`font-medium ${evaluacion.color}`}>
          {evaluacion.mensaje}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Referencia: 0.7-1.5 UG/ha para campo natural
        </p>
      </div>

      {/* Desglose por tipo */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700 text-sm">
          Desglose por tipo de animal:
        </h4>
        
        <div className="space-y-2">
          {stats.desglosePorTipo.vacunos > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <span className="text-sm text-gray-700">🐄 Vacunos</span>
              <span className="font-semibold text-gray-900">
                {stats.desglosePorTipo.vacunos.toFixed(2)} UG
              </span>
            </div>
          )}

          {stats.desglosePorTipo.ovinos > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <span className="text-sm text-gray-700">🐑 Ovinos</span>
              <span className="font-semibold text-gray-900">
                {stats.desglosePorTipo.ovinos.toFixed(2)} UG
              </span>
            </div>
          )}

          {stats.desglosePorTipo.yeguarizos > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <span className="text-sm text-gray-700">🐴 Yeguarizos</span>
              <span className="font-semibold text-gray-900">
                {stats.desglosePorTipo.yeguarizos.toFixed(2)} UG
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Detalle de categorías */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
          Ver detalle por categoría ▼
        </summary>
        <div className="mt-3 space-y-2 pl-4">
          {Object.entries(stats.totalAnimalesPorCategoria).map(([categoria, cantidad]) => {
            const equivalencia = EQUIVALENCIAS_UG[categoria] || 0
            const ugCategoria = cantidad * equivalencia
            
            return (
              <div key={categoria} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{categoria}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{cantidad} × {equivalencia}</span>
                  <span className="font-semibold text-gray-900 w-16 text-right">
                    {ugCategoria.toFixed(2)} UG
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}

/**
 * Componente para mostrar estadísticas globales del campo completo
 */
interface CargaGlobalCampoProps {
  lotes: Lote[]
}

export function CargaGlobalCampo({ lotes }: CargaGlobalCampoProps) {
  if (!lotes || lotes.length === 0) {
    return null
  }

  const totalHectareas = lotes.reduce((sum, l) => sum + l.hectareas, 0)
  const todosLosAnimales = lotes
  .flatMap(l => l.animalesLote || [])
  .filter(a => !['Padrillos', 'Yeguas', 'Caballos', 'Potrillos'].includes(a.categoria))
  
  if (todosLosAnimales.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-gray-500 text-center">
          No hay animales registrados en ningún potrero
        </p>
      </div>
    )
  }

  // Calcular totales
  const ugTotales = todosLosAnimales.reduce((total, animal) => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    return total + (animal.cantidad * equivalencia)
  }, 0)

  const cargaGlobal = totalHectareas > 0 ? ugTotales / totalHectareas : 0
  const evaluacion = evaluarCarga(cargaGlobal)

  // Desglose por tipo
  const desglose = { vacunos: 0, ovinos: 0, yeguarizos: 0 }
  todosLosAnimales.forEach(animal => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    const ug = animal.cantidad * equivalencia
    
    if (['Toros', 'Vacas', 'Novillos +3 años', 'Novillos 2–3 años', 
         'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
         'Terneros/as'].includes(animal.categoria)) {
      desglose.vacunos += ug
    } else if (['Carneros', 'Ovejas', 'Capones', 'Borregas 2–4 dientes', 
                'Corderas DL', 'Corderos DL', 'Corderos/as Mamones'].includes(animal.categoria)) {
      desglose.ovinos += ug
    } else {
      desglose.yeguarizos += ug
    }
  })

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border-2 border-blue-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          🌾 Carga Global del Campo
        </h2>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-lg font-semibold text-gray-900">
            {totalHectareas.toFixed(2)} ha
          </p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Potreros</p>
          <p className="text-2xl font-bold text-gray-900">{lotes.length}</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Total Animales</p>
          <p className="text-2xl font-bold text-gray-900">
            {todosLosAnimales.reduce((sum, a) => sum + a.cantidad, 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Total UG</p>
          <p className="text-2xl font-bold text-blue-900">
            {ugTotales.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Carga Global</p>
          <p className="text-2xl font-bold text-green-900">
            {cargaGlobal.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">UG/ha</p>
        </div>
      </div>

      {/* Evaluación */}
      <div className={`rounded-lg p-4 border-2 ${
        evaluacion.nivel === 'optima' ? 'bg-green-100 border-green-400' :
        evaluacion.nivel === 'baja' ? 'bg-blue-100 border-blue-400' :
        evaluacion.nivel === 'alta' ? 'bg-orange-100 border-orange-400' :
        'bg-red-100 border-red-400'
      }`}>
        <p className={`font-semibold text-lg ${evaluacion.color}`}>
          {evaluacion.mensaje}
        </p>
      </div>

      {/* Distribución por tipo */}
      <div className="bg-white rounded-lg p-4">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">
          Distribución de carga:
        </h3>
        <div className="space-y-2">
          {desglose.vacunos > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🐄 Vacunos</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500"
                    style={{ width: `${(desglose.vacunos / ugTotales) * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-20 text-right">
                  {desglose.vacunos.toFixed(2)} UG
                </span>
              </div>
            </div>
          )}

          {desglose.ovinos > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🐑 Ovinos</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${(desglose.ovinos / ugTotales) * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-20 text-right">
                  {desglose.ovinos.toFixed(2)} UG
                </span>
              </div>
            </div>
          )}

          {desglose.yeguarizos > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🐴 Yeguarizos</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500"
                    style={{ width: `${(desglose.yeguarizos / ugTotales) * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-20 text-right">
                  {desglose.yeguarizos.toFixed(2)} UG
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}