'use client'

import { useState } from 'react'
import RecategorizacionPreferencias from './RecategorizacionPreferencias'
import RecategorizacionMasiva from './RecategorizacionMasiva'

export default function RecategorizacionWrapper() {
  const [acordeonAbierto, setAcordeonAbierto] = useState<'automatica' | 'manual' | null>(null)

  const toggleAcordeon = (tipo: 'automatica' | 'manual') => {
    setAcordeonAbierto(acordeonAbierto === tipo ? null : tipo)
  }

  return (
    <div className="space-y-4">
      {/* HEADER GENERAL */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">🔄 Recategorización</h2>
        <p className="text-sm text-gray-500">
          Configura los cambios de categoría automáticos y manuales
        </p>
      </div>

      {/* ACORDEÓN 1: AUTOMÁTICA */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleAcordeon('automatica')}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-xl sm:text-2xl">🤖</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Recategorización Automática</h3>
              <p className="text-xs sm:text-sm text-gray-500">Cambios programados por fecha</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              acordeonAbierto === 'automatica' ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {acordeonAbierto === 'automatica' && (
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
            <RecategorizacionPreferencias />
          </div>
        )}
      </div>

      {/* ACORDEÓN 2: MANUAL MASIVA */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleAcordeon('manual')}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-xl sm:text-2xl">🔄</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Recategorización Manual Masiva</h3>
              <p className="text-xs sm:text-sm text-gray-500">Aplicá cambios cuando quieras con filtros personalizados</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              acordeonAbierto === 'manual' ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {acordeonAbierto === 'manual' && (
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
            <RecategorizacionMasiva />
          </div>
        )}
      </div>

      {/* INFO ADICIONAL */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> La recategorización automática se ejecuta en las fechas que configures. 
          La manual masiva te permite hacer cambios inmediatos con filtros personalizados.
        </p>
      </div>
    </div>
  )
}