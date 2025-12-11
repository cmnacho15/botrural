// src/app/auth/signout/page.tsx
'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function SignOutPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)

  const handleSignOut = async () => {
    setCargando(true)
    await signOut({ redirect: false })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-6">Cerrar sesión</h1>
        <p className="text-gray-600 mb-10 text-lg">
          ¿Estás seguro de que querés salir?
        </p>

        <div className="space-y-4">
          <button
            onClick={handleSignOut}
            disabled={cargando}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-3"
          >
            {cargando && <Loader2 className="w-5 h-5 animate-spin" />}
            {cargando ? 'Cerrando sesión...' : 'Sí, cerrar sesión'}
          </button>

          <button
            onClick={() => router.back()}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-xl transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}