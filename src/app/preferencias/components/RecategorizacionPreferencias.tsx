'use client'

import { useState, useEffect } from 'react'
import ModalDividirBovinos from '@/app/components/modales/ModalDividirBovinos'
import ModalDividirOvinosSexado from '@/app/components/modales/ModalDividirOvinosSexado'
import ModalDividirOvinosCastracion from '@/app/components/modales/ModalDividirOvinosCastracion'

type PendientesPotrero = {
  loteId: string
  nombre: string
  cantidad: number
  animalLoteId: string
}

type Pendientes = {
  ternerosNacidos: {
    total: number
    potreros: PendientesPotrero[]
  }
  corderosMamones: {
    total: number
    potreros: PendientesPotrero[]
  }
  corderosDL: {
    total: number
    potreros: PendientesPotrero[]
  }
}

export default function RecategorizacionPreferencias() {
  const [config, setConfig] = useState<{
    bovinosActivo: boolean
    ovinosActivo: boolean
    bovinosDia: number
    bovinosMes: number
    ovinosDia: number
    ovinosMes: number
  }>({
    bovinosActivo: false,
    ovinosActivo: false,
    bovinosDia: 1,
    bovinosMes: 1,
    ovinosDia: 1,
    ovinosMes: 1,
  })
  const [pendientes, setPendientes] = useState<Pendientes>({
    ternerosNacidos: { total: 0, potreros: [] },
    corderosMamones: { total: 0, potreros: [] },
    corderosDL: { total: 0, potreros: [] },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modales
  const [showModalBovinos, setShowModalBovinos] = useState(false)
  const [showModalOvinosSexado, setShowModalOvinosSexado] = useState(false)
  const [showModalOvinosCastracion, setShowModalOvinosCastracion] = useState(false)

  useEffect(() => {
    cargarConfig()
    cargarPendientes()
  }, [])

  async function cargarConfig() {
    try {
      const response = await fetch('/api/recategorizacion/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarPendientes() {
    try {
      const response = await fetch('/api/recategorizacion/pendientes')
      if (response.ok) {
        const data = await response.json()
        setPendientes(data)
      }
    } catch (error) {
      console.error('Error cargando pendientes:', error)
    }
  }

  async function handleGuardarConfig() {
    setSaving(true)
    try {
      const response = await fetch('/api/recategorizacion/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        alert('✅ Configuración guardada')
      } else {
        alert('Error al guardar')
      }
    } catch (error) {
      alert('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando configuración...</p>
      </div>
    )
  }

  return (
  <>
    <div className="space-y-8">

        {/* CONFIGURACIÓN BOVINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🐄</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">BOVINOS</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.bovinosActivo}
                    onChange={(e) => setConfig({ ...config, bovinosActivo: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Activar recategorización automática
                  </span>
                </label>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  📅 Fecha de cambio automático:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Día</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={config.bovinosDia}
                      onChange={(e) => setConfig({ ...config, bovinosDia: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Mes</label>
                    <select
                      value={config.bovinosMes}
                      onChange={(e) => setConfig({ ...config, bovinosMes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    ℹ️ Se recategorizan automáticamente:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4">
                    <li>• Terneros → Novillos 1-2</li>
                    <li>• Terneras → Vaquillonas 1-2</li>
                    <li>• Novillos 1-2 → Novillos 2-3</li>
                    <li>• Novillos 2-3 → Novillos +3</li>
                    <li>• Vaquillonas 1-2 → Vaquillonas +2</li>
                    <li>• Vaquillonas +2 → Vacas</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    ⚠️ Siempre manual:
                  </p>
                  <p className="text-xs text-amber-700">
                    • Terneros/as nacidos (requiere sexado cuando caravanees)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONFIGURACIÓN OVINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🐑</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">OVINOS</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ovinosActivo}
                    onChange={(e) => setConfig({ ...config, ovinosActivo: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Activar recategorización automática
                  </span>
                </label>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  📅 Fecha de cambio automático:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Día</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={config.ovinosDia}
                      onChange={(e) => setConfig({ ...config, ovinosDia: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Mes</label>
                    <select
                      value={config.ovinosMes}
                      onChange={(e) => setConfig({ ...config, ovinosMes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    ℹ️ Se recategorizan automáticamente:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4">
                    <li>• Corderas DL → Borregas 2-4 dientes</li>
                    <li>• Borregas 2-4 dientes → Ovejas</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    ⚠️ Siempre manual:
                  </p>
                  <div className="text-xs text-amber-700 space-y-1">
                    <p>• Corderos/as Mamones (requiere sexado cuando destetes)</p>
                    <p>• Corderos DL (requiere registrar castración)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EQUINOS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🐴</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">EQUINOS</h3>
              <p className="text-sm text-gray-600">
                ℹ️ Solo recategorización manual
              </p>
            </div>
          </div>
        </div>

        {/* BOTÓN GUARDAR */}
        <div className="flex justify-end">
          <button
            onClick={handleGuardarConfig}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition shadow-sm"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* MODALES */}
      <ModalDividirBovinos
        isOpen={showModalBovinos}
        onClose={() => setShowModalBovinos(false)}
        potreros={pendientes.ternerosNacidos.potreros}
        onSuccess={() => {
          cargarPendientes()
          alert('✅ División completada')
        }}
      />

      <ModalDividirOvinosSexado
        isOpen={showModalOvinosSexado}
        onClose={() => setShowModalOvinosSexado(false)}
        potreros={pendientes.corderosMamones.potreros}
        onSuccess={() => {
          cargarPendientes()
          alert('✅ División completada')
        }}
      />

      <ModalDividirOvinosCastracion
        isOpen={showModalOvinosCastracion}
        onClose={() => setShowModalOvinosCastracion(false)}
        potreros={pendientes.corderosDL.potreros}
        onSuccess={() => {
          cargarPendientes()
          alert('✅ División completada')
        }}
      />
    </>
  )
}