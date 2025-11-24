"use client"

import { useEffect, useState } from "react"
import { UserPlus, DollarSign, Trash2 } from "lucide-react"
import ModalInvitarUsuario from "@/app/components/modales/ModalInvitarUsuario"

interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  rol: string
  roleCode: string
  accesoFinanzas: boolean
  datosIngresados: number
  fechaRegistro: string
  campoNombre: string
}

export default function EquipoPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [actualizando, setActualizando] = useState<string | null>(null)

  const cargarUsuarios = async () => {
    try {
      const res = await fetch("/api/usuarios")
      const data = await res.json()
      
      // Ordenar: ADMIN_GENERAL primero, luego el resto por fecha
      const ordenados = data.sort((a: Usuario, b: Usuario) => {
        if (a.roleCode === "ADMIN_GENERAL") return -1
        if (b.roleCode === "ADMIN_GENERAL") return 1
        return new Date(a.fechaRegistro).getTime() - new Date(b.fechaRegistro).getTime()
      })
      
      setUsuarios(ordenados)
    } catch (error) {
      console.error("Error cargando usuarios:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const handleToggleFinanzas = async (userId: string, nuevoEstado: boolean) => {
    if (!confirm(`¿Confirmas ${nuevoEstado ? "habilitar" : "deshabilitar"} acceso a finanzas?`)) {
      return
    }

    setActualizando(userId)

    try {
      const res = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          accesoFinanzas: nuevoEstado,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      await cargarUsuarios()
      alert("Permisos actualizados correctamente")
    } catch (error: any) {
      alert(error.message || "Error actualizando permisos")
    } finally {
      setActualizando(null)
    }
  }

  const handleEliminarUsuario = async (usuario: Usuario) => {
    const confirmar = confirm(
      `¿Estás seguro de eliminar a ${usuario.nombre} ${usuario.apellido}?\n\n` +
      `Esto eliminará:\n` +
      `• Su acceso a la plataforma\n` +
      `• Su conexión al bot de WhatsApp\n\n` +
      `Los datos que cargó (gastos, eventos, etc.) se mantendrán en el sistema.\n\n` +
      `Esta acción NO se puede deshacer.`
    )

    if (!confirmar) return

    setActualizando(usuario.id)

    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "DELETE",
      })

      let data
      const text = await res.text()
      
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: "Error en la respuesta del servidor" }
      }

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar usuario")
      }

      await cargarUsuarios()
      alert(`${usuario.nombre} ${usuario.apellido} eliminado correctamente`)
    } catch (error: any) {
      console.error("Error eliminando usuario:", error)
      alert(`Error: ${error.message}`)
    } finally {
      setActualizando(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-600 mt-1">Gestiona los usuarios de tu campo</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Invitar usuario
        </button>
      </div>

      {/* Tabla de usuarios con scroll horizontal */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Datos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Finanzas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registro
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {usuario.nombre.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nombre} {usuario.apellido}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.roleCode === "ADMIN_GENERAL"
                          ? "bg-purple-100 text-purple-800"
                          : usuario.roleCode === "COLABORADOR"
                          ? "bg-blue-100 text-blue-800"
                          : usuario.roleCode === "EMPLEADO"
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="max-w-[200px] truncate">{usuario.email || "-"}</div>
                    {usuario.telefono && (
                      <div className="text-xs text-gray-400">{usuario.telefono}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    {usuario.datosIngresados}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {usuario.roleCode === "COLABORADOR" ? (
                      <button
                        onClick={() => handleToggleFinanzas(usuario.id, !usuario.accesoFinanzas)}
                        disabled={actualizando === usuario.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                          usuario.accesoFinanzas
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <DollarSign className="w-3 h-3" />
                        {actualizando === usuario.id ? (
                          "..."
                        ) : usuario.accesoFinanzas ? (
                          "Sí"
                        ) : (
                          "No"
                        )}
                      </button>
                    ) : usuario.roleCode === "ADMIN_GENERAL" || usuario.roleCode === "CONTADOR" ? (
                      <span className="text-xs text-gray-500">Siempre</span>
                    ) : (
                      <span className="text-xs text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.fechaRegistro}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {usuario.roleCode !== "ADMIN_GENERAL" && (
                      <button
                        onClick={() => handleEliminarUsuario(usuario)}
                        disabled={actualizando === usuario.id}
                        className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usuarios.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay usuarios registrados aún</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <ModalInvitarUsuario
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={cargarUsuarios}
      />
    </div>
  )
}