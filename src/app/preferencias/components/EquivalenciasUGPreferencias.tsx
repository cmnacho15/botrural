// src/app/preferencias/components/EquivalenciasUGPreferencias.tsx
'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Peso de referencia para 1 UG
const PESO_REFERENCIA = 380

interface Equivalencia {
  categoria: string
  pesoKg: number
  pesoDefault: number
  equivalenciaUG: number
  esPersonalizada: boolean
  id: string | null
}

interface EquivalenciasResponse {
  campoId: string
  equivalencias: Equivalencia[]
  pesoReferencia: number
}

// Agrupar categorías por tipo
const GRUPOS = {
  'Vacunos': [
    'Toros', 'Vacas', 'Vacas Gordas', 
    'Novillos +3 años', 'Novillos 2–3 años', 'Novillos 1–2 años',
    'Vaquillonas +2 años', 'Vaquillonas 1–2 años',
    'Terneros', 'Terneras', 'Terneros nacidos'
  ],
  'Ovinos': [
    'Carneros', 'Ovejas', 'Capones', 
    'Borregas 2–4 dientes', 
    'Corderas DL', 'Corderos DL', 'Corderos/as Mamones'
  ],
  'Equinos': [
    'Padrillos', 'Yeguas', 'Caballos', 'Potrillos'
  ]
}

export default function EquivalenciasUGPreferencias() {
  const { data, error, isLoading, mutate } = useSWR<EquivalenciasResponse>(
    '/api/equivalencias-ug',
    fetcher
  )

  // Estado local para edición
  const [pesos, setPesos] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null)
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    'Vacunos': false,
    'Ovinos': false,
    'Equinos': false
  })

  // Inicializar pesos cuando llegan los datos
  useEffect(() => {
    if (data?.equivalencias) {
      const pesosIniciales: Record<string, number> = {}
      data.equivalencias.forEach(eq => {
        pesosIniciales[eq.categoria] = eq.pesoKg
      })
      setPesos(pesosIniciales)
    }
  }, [data])

  const handlePesoChange = (categoria: string, valor: string) => {
    const numero = parseFloat(valor)
    if (!isNaN(numero) && numero >= 0) {
      setPesos(prev => ({ ...prev, [categoria]: numero }))
    }
  }

  const handleGuardar = async () => {
    setSaving(true)
    setMensaje(null)

    try {
      // Construir lista de equivalencias a guardar
      const equivalenciasAGuardar = Object.entries(pesos).map(([categoria, pesoKg]) => ({
        categoria,
        pesoKg
      }))

      const response = await fetch('/api/equivalencias-ug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equivalencias: equivalenciasAGuardar })
      })

      if (!response.ok) {
        throw new Error('Error al guardar')
      }

      setMensaje({ tipo: 'success', texto: 'Equivalencias guardadas correctamente' })
      mutate() // Refrescar datos
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar las equivalencias' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetear = async () => {
    if (!confirm('¿Estás seguro de resetear todas las equivalencias a los valores por defecto?')) {
      return
    }

    setSaving(true)
    setMensaje(null)

    try {
      const response = await fetch('/api/equivalencias-ug', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al resetear')
      }

      setMensaje({ tipo: 'success', texto: 'Equivalencias reseteadas a valores por defecto' })
      mutate() // Refrescar datos
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al resetear las equivalencias' })
    } finally {
      setSaving(false)
    }
  }

  // Verificar si hay cambios sin guardar
  const hayCambios = data?.equivalencias?.some(eq => 
    pesos[eq.categoria] !== eq.pesoKg
  )

  // Verificar si hay personalizaciones
  const hayPersonalizaciones = data?.equivalencias?.some(eq => eq.esPersonalizada)

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <p className="text-gray-500">Cargando equivalencias...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <p className="text-red-500">Error al cargar equivalencias</p>
      </div>
    )
  }

  // Mostrar siempre todas las categorías
  const equivalenciasFiltradas = data?.equivalencias

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              ⚖️ Equivalencias UG Personalizadas
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Ajustá el peso de cada categoría según tu realidad. 
              <strong> 1 UG = {PESO_REFERENCIA} kg</strong> (vaca de referencia)
            </p>
          </div>
          
          {hayPersonalizaciones && (
            <button
              onClick={handleResetear}
              disabled={saving}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Resetear todo
            </button>
          )}
        </div>

        {/* Mensaje */}
        {mensaje && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            mensaje.tipo === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}
      </div>

      

      {/* Contenido */}
      <div className="p-6 space-y-8">
        {Object.entries(GRUPOS).map(([grupo, categorias]) => {
          // Filtrar categorías de este grupo
          const categoriasDelGrupo = data?.equivalencias?.filter(eq => categorias.includes(eq.categoria))

          if (!categoriasDelGrupo || categoriasDelGrupo.length === 0) return null

          const estaExpandido = gruposExpandidos[grupo]

          return (
            <div key={grupo} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              {/* Header expandible */}
              <button
                onClick={() => setGruposExpandidos(prev => ({
                  ...prev,
                  [grupo]: !prev[grupo]
                }))}
                className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition"
              >
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  {grupo === 'Vacunos' && '🐄'}
                  {grupo === 'Ovinos' && '🐑'}
                  {grupo === 'Equinos' && '🐴'}
                  {grupo}
                  <span className="text-sm font-normal text-gray-500">
                    ({categoriasDelGrupo.length})
                  </span>
                </h3>
                <span className="text-2xl text-gray-600 transition-transform duration-200" style={{ transform: estaExpandido ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>

              {/* Contenido expandible */}
              {estaExpandido && (
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoriasDelGrupo.map(eq => {
                  const pesoActual = pesos[eq.categoria] ?? eq.pesoKg
                  const ugCalculada = pesoActual / PESO_REFERENCIA
                  const esDiferente = pesoActual !== eq.pesoDefault
                  const tienesCambioSinGuardar = pesoActual !== eq.pesoKg

                  return (
                    <div 
                      key={eq.categoria}
                      className={`p-4 rounded-lg border ${
                        tienesCambioSinGuardar 
                          ? 'border-yellow-300 bg-yellow-50'
                          : esDiferente 
                            ? 'border-blue-200 bg-blue-50' 
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{eq.categoria}</span>
                        {esDiferente && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            Personalizado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 block mb-1">Peso (kg)</label>
                          <input
                            type="number"
                            value={pesoActual}
                            onChange={(e) => handlePesoChange(eq.categoria, e.target.value)}
                            min={0}
                            step={1}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="text-center">
                          <label className="text-xs text-gray-500 block mb-1">UG</label>
                          <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                            esDiferente ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {ugCalculada.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {esDiferente && (
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>Default: {eq.pesoDefault} kg ({(eq.pesoDefault / PESO_REFERENCIA).toFixed(2)} UG)</span>
                          <button
                            onClick={() => handlePesoChange(eq.categoria, String(eq.pesoDefault))}
                            className="text-blue-600 hover:underline"
                          >
                             Restaurar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer con botón guardar */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {hayCambios && (
            <span className="text-yellow-600 font-medium">
              ⚠️ Hay cambios sin guardar
            </span>
          )}
        </div>

        <button
          onClick={handleGuardar}
          disabled={saving || !hayCambios}
          className={`px-6 py-2.5 rounded-lg font-medium transition ${
            hayCambios
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Info box */}
      <div className="p-6 bg-blue-50 border-t border-blue-100">
        <h4 className="font-semibold text-blue-800 mb-2">💡 ¿Cómo funciona?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>1 UG = 380 kg</strong> (peso de una vaca adulta de referencia)</li>
          <li>• Si tus terneros pesan 200 kg en promedio, poné 200 kg → te dará <strong>0.53 UG</strong></li>
          <li>• Esto afecta el cálculo de carga animal (UG/ha) en todo el sistema</li>
          <li>• Los valores por defecto están basados en promedios estándar de Uruguay</li>
        </ul>
      </div>
    </div>
  )
}