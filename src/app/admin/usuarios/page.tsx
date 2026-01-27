'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string | null
  name: string | null
  apellido: string | null
  telefono: string | null
  role: string
  campoId: string | null
  campoNombre: string | null
  grupoNombre: string | null
  createdAt: string
  lastMessageAt: string | null
  lastLoginAt: string | null
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  trialEndsAt: string | null
  eventosCount: number
  invitacionesCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function UsuariosPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        role: roleFilter,
        sortBy,
        sortOrder
      })

      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, search, roleFilter, sortBy, sortOrder])

  useEffect(() => {
    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [fetchUsers])

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  function formatRelativeTime(dateStr: string | null) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'ahora'
    if (diffMins < 60) return `hace ${diffMins}m`
    if (diffHours < 24) return `hace ${diffHours}h`
    if (diffDays < 7) return `hace ${diffDays}d`
    return formatDate(dateStr)
  }

  const roleLabels: Record<string, { label: string, color: string }> = {
    ADMIN_GENERAL: { label: 'Admin', color: 'bg-purple-500/20 text-purple-400' },
    COLABORADOR: { label: 'Colaborador', color: 'bg-blue-500/20 text-blue-400' },
    EMPLEADO: { label: 'Empleado', color: 'bg-gray-500/20 text-gray-400' },
    CONTADOR: { label: 'Contador', color: 'bg-amber-500/20 text-amber-400' }
  }

  const statusColors: Record<string, string> = {
    TRIAL: 'bg-yellow-500/20 text-yellow-400',
    ACTIVE: 'bg-green-500/20 text-green-400',
    EXPIRED: 'bg-red-500/20 text-red-400',
    CANCELLED: 'bg-gray-500/20 text-gray-400'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 text-sm mt-1">
            {pagination.total} usuarios registrados
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPagination(p => ({ ...p, page: 1 }))
                }}
                placeholder="Buscar por email, nombre o teléfono..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
            </div>
          </div>

          {/* Filtro por rol */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPagination(p => ({ ...p, page: 1 }))
            }}
            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">Todos los roles</option>
            <option value="ADMIN_GENERAL">Admin General</option>
            <option value="COLABORADOR">Colaborador</option>
            <option value="EMPLEADO">Empleado</option>
            <option value="CONTADOR">Contador</option>
          </select>

          {/* Ordenar por */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-')
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
            }}
            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="createdAt-desc">Más recientes</option>
            <option value="createdAt-asc">Más antiguos</option>
            <option value="lastMessageAt-desc">Última actividad</option>
            <option value="name-asc">Nombre A-Z</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm bg-gray-700/50">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Campo</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Eventos</th>
                <th className="px-4 py-3 font-medium">Registro</th>
                <th className="px-4 py-3 font-medium">Última actividad</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => router.push(`/admin/usuarios/${user.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">
                          {user.name || user.apellido || 'Sin nombre'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {user.email || user.telefono || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.campoNombre ? (
                        <div>
                          <p className="text-gray-300 text-sm">{user.campoNombre}</p>
                          {user.grupoNombre && (
                            <p className="text-gray-500 text-xs">{user.grupoNombre}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Sin campo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleLabels[user.role]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                        {roleLabels[user.role]?.label || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[user.subscriptionStatus || ''] || 'bg-gray-500/20 text-gray-400'}`}>
                        {user.subscriptionStatus || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-300">{user.eventosCount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{formatDate(user.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{formatRelativeTime(user.lastMessageAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/usuarios/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1 text-gray-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
