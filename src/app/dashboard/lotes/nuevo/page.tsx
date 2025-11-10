'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NuevoLotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      nombre: formData.get('nombre'),
      hectareas: formData.get('hectareas'),
    }

    try {
      const response = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/dashboard/lotes')
        router.refresh()
      } else {
        alert('Error al crear el lote')
      }
    } catch (error) {
      console.error(error)
      alert('Error al crear el lote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8 text-gray-900">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Nuevo Potrero
        </h1>
        <p className="text-gray-600 text-sm">
          Ingresá los datos del potrero para registrarlo en el sistema
        </p>
      </div>

      {/* Contenedor principal */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo: Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Potrero
            </label>
            <input
              type="text"
              name="nombre"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Ej: Campo Oeste"
            />
          </div>

          {/* Campo: Hectáreas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hectáreas
            </label>
            <input
              type="number"
              name="hectareas"
              step="0.01"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Ej: 25.5"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Guardando...' : 'Guardar Potrero'}
            </button>

            <Link
              href="/dashboard/lotes"
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-200 text-center transition shadow-sm"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
