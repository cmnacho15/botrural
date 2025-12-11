'use client'

import { signOut } from 'next-auth/react'

export default function SignOutPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Cerrar sesión
        </h1>
        
        <p className="text-gray-600 mb-8">
          ¿Estás seguro de que quieres salir?
        </p>

        <div className="space-y-3">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition"
          >
            Sí, cerrar sesión
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}