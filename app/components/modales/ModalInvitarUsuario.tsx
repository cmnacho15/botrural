'use client'

import { useState } from 'react'

type Props = {
  onClose: () => void
}

export default function ModalInvitarUsuario({ onClose }: Props) {
  const [rol, setRol] = useState<'ADMIN' | 'USUARIO'>('USUARIO')
  const [paso, setPaso] = useState(1)
  const [linkGenerado, setLinkGenerado] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirmar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: rol }),
      })

      if (!res.ok) throw new Error('Error al generar invitación')

      const data = await res.json()
      setLinkGenerado(data.whatsappLink || data.inviteUrl || '')
      setPaso(2)
    } catch (err) {
      alert('Error al crear la invitación')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>

        {paso === 1 ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Invitar Nuevos Usuarios
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setRol('ADMIN')}
                className={`border-2 rounded-xl p-4 cursor-pointer flex flex-col items-center text-center ${
                  rol === 'ADMIN'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                  alt="Admin"
                  className="w-16 h-16 mb-3"
                />
                <h3 className="font-semibold text-gray-900">Administrador</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Usa la web y el bot con acceso completo (excepto finanzas).
                </p>
              </div>

              <div
                onClick={() => setRol('USUARIO')}
                className={`border-2 rounded-xl p-4 cursor-pointer flex flex-col items-center text-center ${
                  rol === 'USUARIO'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/2922/2922510.png"
                  alt="Usuario"
                  className="w-16 h-16 mb-3"
                />
                <h3 className="font-semibold text-gray-900">Usuario</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Solo usa el bot para cargar datos o ver información del campo.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleConfirmar}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Generando...' : 'Confirmar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Invitación Generada
            </h2>

            <ol className="list-decimal list-inside space-y-4 text-gray-700 text-sm">
              <li>
                Compartí este enlace con tu equipo:
                <div className="mt-2">
                  <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between text-sm font-mono break-all">
                    <span>{linkGenerado}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(linkGenerado)}
                      className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cuando el usuario abra este enlace, podrá unirse al equipo.
                </p>
              </li>
            </ol>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}