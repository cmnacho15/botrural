'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR, { mutate } from 'swr' // ✅ Importar SWR

interface Lote {
  id: string
  nombre: string
  hectareas: number
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

// ✅ Fetcher para SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function LotesPage() {
  // ✅ Usar SWR en lugar de useState + useEffect
  const { data: lotes = [], isLoading: loading, mutate: revalidate } = useSWR<Lote[]>(
    '/api/lotes',
    fetcher,
    {
      revalidateOnFocus: true, // ✅ Se actualiza al volver a la pestaña
      refreshInterval: 30000, // ✅ Opcional: refresh cada 30s
    }
  )

  // ==========================================
  // 🗑️ ELIMINAR LOTE
  // ==========================================

  async function eliminarLote(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de eliminar el potrero "${nombre}"?`)) return

    try {
      const response = await fetch(`/api/lotes?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        // ✅ Actualizar la lista local inmediatamente
        revalidate()
        alert('Potrero eliminado correctamente')
      } else {
        alert('Error al eliminar el potrero')
      }
    } catch (error) {
      console.error('Error eliminando lote:', error)
      alert('Error al eliminar el potrero')
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
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 md:p-8 text-gray-900">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-6">
        <div className="text-center md:text-left space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            Potreros en Rodazo
          </h1>
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
          // 🔹 Vista vacía
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
          // 🔹 Tabla con potreros reales
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

                    {/* NOMBRE Y HAS */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {lote.nombre}
                      </div>
                      <div className="text-sm text-gray-500">
                        {Number(lote.hectareas).toLocaleString('es-UY', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        has
                      </div>
                    </td>

                    {/* CULTIVOS */}
<td className="px-6 py-4 text-sm text-gray-700">
  {lote.cultivos?.length > 0 ? (
    <div className="space-y-1">
      {lote.cultivos.map((cultivo, idx) => (
        <div key={idx} className="text-sm">
          <span className="font-medium">{cultivo.tipoCultivo}</span>
          <div className="text-xs text-gray-500">
            {cultivo.hectareas.toFixed(1)} ha
          </div>
        </div>
      ))}
    </div>
  ) : (
    <span className="text-gray-400 italic">
      Sin cultivos
    </span>
  )}
</td>

                    {/* ANIMALES */}
                    <td className="px-6 py-4 text-sm text-gray-700">
  {lote.animalesLote.length > 0 ? (
    <div className="space-y-1">
      {lote.animalesLote.map((animal, idx) => (
        <div key={idx} className="text-sm">
          <span className="font-medium">{animal.cantidad}</span>{' '}
          <span className="text-gray-600">({animal.categoria})</span>
        </div>
      ))}
    </div>
  ) : (
    <span className="text-gray-400 italic">
      Sin animales
    </span>
  )}
</td>

                    {/* ACCIONES */}
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
                          onClick={() => eliminarLote(lote.id, lote.nombre)}
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
  )
}