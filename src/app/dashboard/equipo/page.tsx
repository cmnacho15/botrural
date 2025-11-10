'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import ModalInvitarUsuario from '@/src/app/components/modales/ModalInvitarUsuario'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: string
  datosIngresados: number
  fechaRegistro: string
  campoNombre?: string
}

export default function EquipoPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)

  // 🔹 Cargar usuarios reales desde la API
  useEffect(() => {
    async function fetchUsuarios() {
      try {
        const res = await fetch('/api/usuarios')
        if (!res.ok) throw new Error('Error al obtener usuarios')
        const data = await res.json()
        setUsuarios(data)
      } catch (error) {
        console.error('Error cargando usuarios:', error)
      }
    }

    fetchUsuarios()
  }, [])

  const campoNombre = usuarios[0]?.campoNombre || 'Campo'

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Equipo de {campoNombre}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Gestioná los usuarios que tienen acceso a tu campo.
          </p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm"
        >
          <span className="text-lg">👤</span> Invitar Usuario
        </button>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Datos Ingresados
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Fecha de Registro
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {usuarios.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-6 text-gray-500 text-sm"
                >
                  No hay usuarios registrados todavía.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold">
                      {u.nombre
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{u.nombre}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {u.datosIngresados} datos
                    </div>
                    <div className="text-xs text-gray-500">
                      +{u.datosIngresados} esta semana
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {u.fechaRegistro}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-red-600 text-lg">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de invitación */}
      {modalAbierto && <ModalInvitarUsuario onClose={() => setModalAbierto(false)} />}
    </div>
  )
}