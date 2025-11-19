'use client';
export const dynamic = "force-dynamic"

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { EQUIVALENCIAS_UG } from '@/lib/ugCalculator'

interface Lote {
  id: string
  nombre: string
  hectareas: number
  diasPastoreo: number
  diasDescanso: number 
  cultivos: Array<{ 
    tipoCultivo: string
    hectareas: number
    fechaSiembra: string
  }>
  animalesLote: Array<{ 
    cantidad: number
    categoria: string 
  }>
}

// Modal de confirmación
interface ModalConfirmarBorradoProps {
  isOpen: boolean
  nombrePotrero: string
  animales: Array<{ categoria: string; cantidad: number }>
  cultivos: Array<{ tipoCultivo: string; hectareas: number }>
  onConfirmar: () => void
  onCancelar: () => void
  loading?: boolean
}

function ModalConfirmarBorrado({
  isOpen,
  nombrePotrero,
  animales,
  cultivos,
  onConfirmar,
  onCancelar,
  loading = false
}: ModalConfirmarBorradoProps) {
  if (!isOpen) return null

  const tieneAnimales = animales.length > 0
  const tieneCultivos = cultivos.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirmar Borrado</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Se eliminará el potrero <strong>"{nombrePotrero}"</strong>. Para proceder, 
            {tieneAnimales && tieneCultivos && ' el potrero no deberá tener ningún animal ni cultivo.'}
            {tieneAnimales && !tieneCultivos && ' el potrero no deberá tener ningún animal.'}
            {!tieneAnimales && tieneCultivos && ' el potrero no deberá tener ningún cultivo.'}
          </p>

          {tieneAnimales && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                🐄 Animales presentes ({animales.reduce((sum, a) => sum + a.cantidad, 0)} total)
              </h3>
              <ul className="space-y-1 text-sm text-red-700">
                {animales.map((animal, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{animal.categoria}</span>
                    <span className="font-medium">{animal.cantidad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tieneCultivos && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                🌾 Cultivos presentes
              </h3>
              <ul className="space-y-1 text-sm text-amber-700">
                {cultivos.map((cultivo, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{cultivo.tipoCultivo}</span>
                    <span className="font-medium">{cultivo.hectareas.toFixed(1)} ha</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!tieneAnimales && !tieneCultivos && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm">
                ✅ El potrero está vacío y puede ser eliminado.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancelar}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={loading || tieneAnimales || tieneCultivos}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Eliminando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function LotesPage() {
  const { data: lotes = [], isLoading: loading, mutate: refreshLotes } = useSWR<Lote[]>(
    '/api/lotes',
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  )

  const [modalBorrado, setModalBorrado] = useState<{
    isOpen: boolean
    loteId: string
    nombre: string
    animales: Array<{ categoria: string; cantidad: number }>
    cultivos: Array<{ tipoCultivo: string; hectareas: number }>
  }>({
    isOpen: false,
    loteId: '',
    nombre: '',
    animales: [],
    cultivos: []
  })

  const [loadingBorrado, setLoadingBorrado] = useState(false)

  // ==========================================
  // 🗑️ ABRIR MODAL DE CONFIRMACIÓN
  // ==========================================
  function abrirModalBorrado(lote: Lote) {
    setModalBorrado({
      isOpen: true,
      loteId: lote.id,
      nombre: lote.nombre,
      animales: lote.animalesLote || [],
      cultivos: lote.cultivos || []
    })
  }

  // ==========================================
  // 🗑️ ELIMINAR LOTE
  // ==========================================
  async function eliminarLote() {
    setLoadingBorrado(true)

    try {
      const response = await fetch(`/api/lotes/${modalBorrado.loteId}`, { 
        method: 'DELETE' 
      })

      if (response.ok) {
        refreshLotes()
        setModalBorrado({
          isOpen: false,
          loteId: '',
          nombre: '',
          animales: [],
          cultivos: []
        })
        alert('Potrero eliminado correctamente')
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar el potrero')
      }
    } catch (error) {
      console.error('Error eliminando lote:', error)
      alert('Error al eliminar el potrero')
    } finally {
      setLoadingBorrado(false)
    }
  }

  const hayLotes = lotes.length > 0

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <p className="text-gray-600">Cargando potreros...</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 text-gray-900">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-6">
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                Potreros en Rodazo
              </h1>
              
              {/* 🌾 CARGA GLOBAL DEL CAMPO */}
              {hayLotes && (() => {
                const totalHectareas = lotes.reduce((sum, l) => sum + l.hectareas, 0)
                const todosAnimales = lotes.flatMap(l => l.animalesLote || [])
                const ugTotales = todosAnimales.reduce((total, animal) => {
                  const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
                  return total + (animal.cantidad * equivalencia)
                }, 0)
                const cargaGlobal = totalHectareas > 0 ? ugTotales / totalHectareas : 0
                
                if (todosAnimales.length === 0) return null
                
                const color = 
                  cargaGlobal < 0.7 ? 'bg-blue-100 text-blue-700' :
                  cargaGlobal <= 1.5 ? 'bg-green-100 text-green-700' :
                  cargaGlobal <= 2.0 ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                
                return (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                    {cargaGlobal.toFixed(2)} UG/ha
                  </span>
                )
              })()}
            </div>
            <p className="text-gray-600 text-sm">
              Gestión de potreros y lotes del campo
            </p>
          </div>

          {hayLotes && (
            <div className="flex flex-wrap justify-center md:justify-end gap-3">
              <Link
                href="/dashboard/lotes/nuevo"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 shadow-sm transition text-sm"
              >
                <span className="text-lg">+</span> Nuevo potrero
              </Link>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 shadow-sm transition text-sm"
              >
                <span className="text-lg">⬆️</span> Importar CSV
              </button>
            </div>
          )}
        </div>

        {/* CONTENIDO */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          {!hayLotes ? (
            <div className="p-10 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Potreros en Rodazo
              </h3>
              <p className="text-gray-600 mb-8">
                Ingresá los potreros de tu campo para empezar a usar la app.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link
                  href="/dashboard/lotes/nuevo"
                  className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-gray-100 transition w-52 h-36 mx-auto"
                >
                  <img
                    src="https://cdn-icons-png.flaticon.com/512/992/992700.png"
                    alt="Formulario"
                    className="w-8 h-8 mb-2 opacity-90"
                  />
                  <p className="font-medium text-gray-800 text-sm">
                    Ingresar manualmente
                  </p>
                </Link>

                <button
                  className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-5 hover:bg-gray-100 transition w-52 h-36 mx-auto"
                >
                  <img
                    src="https://cdn-icons-png.flaticon.com/512/732/732220.png"
                    alt="Excel"
                    className="w-8 h-8 mb-2 opacity-90"
                  />
                  <p className="font-medium text-gray-800 text-sm">
                    Subir Excel o CSV
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Potrero
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Cultivos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Animales
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {lotes.map((lote) => (
                    <tr key={lote.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{lote.nombre}</div>
                        <div className="text-sm text-gray-500">
                          {Number(lote.hectareas).toLocaleString('es-UY', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          has
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700">
                        {lote.cultivos?.length > 0 ? (
                          <div className="space-y-1">
                            {lote.cultivos.map((cultivo, idx) => (
                              <Link
                                key={idx}
                                href={`/dashboard/datos?potreros=${encodeURIComponent(lote.nombre)}&cultivos=${encodeURIComponent(cultivo.tipoCultivo)}`}
                                className="block"
                              >
                                <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition cursor-pointer">
                                  <span className="font-medium">{cultivo.tipoCultivo}</span>
                                  <span className="text-xs ml-1">({cultivo.hectareas.toFixed(1)} ha)</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Sin cultivos</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-700">
                        {lote.animalesLote.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="relative group">
                                <div className="inline-block px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-semibold cursor-pointer">
                                  {lote.animalesLote.reduce((sum, a) => sum + a.cantidad, 0)} ({lote.diasPastoreo || 0} días)
                                </div>
                                <div className="hidden group-hover:block absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-10 left-0 whitespace-nowrap">
                                  {lote.animalesLote.reduce((sum, a) => sum + a.cantidad, 0)} animales, {lote.diasPastoreo || 0} días de pastoreo
                                </div>
                              </div>
                              
                              {/* 🌾 CARGA UG/ha DEL POTRERO */}
                              {(() => {
                                const ugTotales = lote.animalesLote.reduce((total, animal) => {
                                  const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
                                  return total + (animal.cantidad * equivalencia)
                                }, 0)
                                const cargaUG = lote.hectareas > 0 ? ugTotales / lote.hectareas : 0
                                
                                const color = 
                                  cargaUG < 0.7 ? 'bg-blue-100 text-blue-700' :
                                  cargaUG <= 1.5 ? 'bg-green-100 text-green-700' :
                                  cargaUG <= 2.0 ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                
                                return (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                                    {cargaUG.toFixed(2)} UG/ha
                                  </span>
                                )
                              })()}
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {lote.animalesLote.map((animal, idx) => (
                                <Link
                                  key={idx}
                                  href={`/dashboard/datos?potreros=${encodeURIComponent(lote.nombre)}&animales=${encodeURIComponent(animal.categoria)}`}
                                >
                                  <div className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition cursor-pointer">
                                    <span className="font-medium">{animal.cantidad}</span> {animal.categoria}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative group">
                              <div className="inline-block px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold cursor-pointer">
                                Descanso ({lote.diasDescanso || 0} días)
                              </div>
                              <div className="hidden group-hover:block absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-10 left-0 whitespace-nowrap">
                                Potrero en descanso: {lote.diasDescanso || 0} días
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button className="text-gray-400 hover:text-gray-600 transition" title="Ver detalles">
                            🔗
                          </button>

                          <Link
                            href={`/dashboard/lotes/${lote.id}/editar`}
                            className="text-gray-400 hover:text-gray-600 transition"
                            title="Editar"
                          >
                            ✏️
                          </Link>

                          <button
                            onClick={() => abrirModalBorrado(lote)}
                            className="text-gray-400 hover:text-red-600 transition"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      <ModalConfirmarBorrado
        isOpen={modalBorrado.isOpen}
        nombrePotrero={modalBorrado.nombre}
        animales={modalBorrado.animales}
        cultivos={modalBorrado.cultivos}
        onConfirmar={eliminarLote}
        onCancelar={() => setModalBorrado({
          isOpen: false,
          loteId: '',
          nombre: '',
          animales: [],
          cultivos: []
        })}
        loading={loadingBorrado}
      />
    </>
  )
}