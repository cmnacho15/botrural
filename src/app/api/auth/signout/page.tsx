'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

export default function SignOutPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    // 🔥 Esto llama al endpoint correcto de NextAuth
    await signOut({ callbackUrl: '/login', redirect: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">
          Cerrar sesión
        </h1>
        
        <p className="text-gray-600 text-center mb-8">
          ¿Estás seguro que deseas cerrar sesión?
        </p>

        <div className="space-y-3">
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </button>

          <button
            onClick={() => window.history.back()}
            disabled={isLoading}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}