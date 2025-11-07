'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegistroCampoPage() {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/campos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al crear el campo')
      } else {
        setSuccess('✅ Campo creado exitosamente')
        setTimeout(() => router.push('/dashboard'), 1500)
      }
    } catch (err) {
      setError('Error inesperado al crear el campo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
          🌾 Bienvenido a MiCampoData
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Último paso: asigná un nombre a tu campo
        </p>

        {/* Mensajes */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del campo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Campo San Pedro"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? '⏳ Creando campo...' : '🚜 Crear campo'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Este nombre será visible para tus colaboradores.
        </p>
      </div>
    </div>
  )
}