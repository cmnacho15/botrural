'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  overview: {
    totalUsers: number
    usersWithCampo: number
    usersWithoutCampo: number
    usersThisMonth: number
    usersLast7Days: number
    usersActiveToday: number
    usersActiveLast7Days: number
    growthRate: number
    totalCampos: number
    totalGrupos: number
    totalEventos: number
    totalVentas: number
    totalGastos: number
    eventosThisMonth: number
  }
  usersByRole: Array<{ role: string, count: number }>
  newUsersByDay: Array<{ date: string, count: number }>
  topCamposByEvents: Array<{
    id: string
    nombre: string
    eventos: number
    ventas: number
    gastos: number
    usuarios: number
  }>
  eventsByType: Array<{ tipo: string, count: number }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    ADMIN_GENERAL: 'Admin General',
    COLABORADOR: 'Colaborador',
    EMPLEADO: 'Empleado',
    CONTADOR: 'Contador'
  }

  const tipoEventoLabels: Record<string, string> = {
    TRATAMIENTO: 'Tratamientos',
    CAMBIO_POTRERO: 'Cambios Potrero',
    NACIMIENTO: 'Nacimientos',
    MORTANDAD: 'Mortandades',
    VENTA: 'Ventas',
    COMPRA: 'Compras',
    TACTO: 'Tactos',
    LLUVIA: 'Lluvias',
    GASTO: 'Gastos'
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-400">
        Error cargando estadísticas
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Vista general de la plataforma</p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Usuarios Totales"
          value={stats.overview.totalUsers}
          subtitle={`${stats.overview.usersWithCampo} con campo`}
          icon="👥"
          color="purple"
        />
        <StatCard
          title="Nuevos (7 días)"
          value={stats.overview.usersLast7Days}
          subtitle={`${stats.overview.usersThisMonth} este mes`}
          icon="📈"
          color="green"
          trend={stats.overview.growthRate}
        />
        <StatCard
          title="Activos Hoy"
          value={stats.overview.usersActiveToday}
          subtitle={`${stats.overview.usersActiveLast7Days} últimos 7 días`}
          icon="🟢"
          color="blue"
        />
        <StatCard
          title="Campos"
          value={stats.overview.totalCampos}
          subtitle={`${stats.overview.totalGrupos} grupos`}
          icon="🏠"
          color="amber"
        />
      </div>

      {/* Segunda fila de cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Eventos Totales"
          value={stats.overview.totalEventos.toLocaleString()}
          subtitle={`${stats.overview.eventosThisMonth.toLocaleString()} este mes`}
          icon="📋"
          color="indigo"
        />
        <StatCard
          title="Ventas Registradas"
          value={stats.overview.totalVentas.toLocaleString()}
          icon="💰"
          color="emerald"
        />
        <StatCard
          title="Gastos Registrados"
          value={stats.overview.totalGastos.toLocaleString()}
          icon="💸"
          color="rose"
        />
      </div>

      {/* Contenido en columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usuarios por Rol */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            👤 Usuarios por Rol
          </h2>
          <div className="space-y-3">
            {stats.usersByRole.map((item) => {
              const percentage = (item.count / stats.overview.totalUsers * 100).toFixed(1)
              return (
                <div key={item.role} className="flex items-center gap-3">
                  <span className="text-gray-400 w-32 text-sm">
                    {roleLabels[item.role] || item.role}
                  </span>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-16 text-right">
                    {item.count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Eventos por Tipo */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            📊 Top Eventos (30 días)
          </h2>
          <div className="space-y-3">
            {stats.eventsByType.slice(0, 8).map((item, idx) => {
              const maxCount = stats.eventsByType[0]?.count || 1
              const percentage = (item.count / maxCount * 100).toFixed(0)
              return (
                <div key={item.tipo} className="flex items-center gap-3">
                  <span className="text-gray-400 w-36 text-sm truncate">
                    {tipoEventoLabels[item.tipo] || item.tipo}
                  </span>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-16 text-right">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Campos */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🏆 Top 10 Campos más Activos
          </h2>
          <Link
            href="/admin/usuarios"
            className="text-purple-400 hover:text-purple-300 text-sm"
          >
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Campo</th>
                <th className="pb-3 font-medium text-right">Usuarios</th>
                <th className="pb-3 font-medium text-right">Eventos</th>
                <th className="pb-3 font-medium text-right">Ventas</th>
                <th className="pb-3 font-medium text-right">Gastos</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.topCamposByEvents.map((campo, idx) => (
                <tr key={campo.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 text-gray-500">{idx + 1}</td>
                  <td className="py-3 text-white font-medium">{campo.nombre}</td>
                  <td className="py-3 text-right text-gray-300">{campo.usuarios}</td>
                  <td className="py-3 text-right text-gray-300">{campo.eventos.toLocaleString()}</td>
                  <td className="py-3 text-right text-green-400">{campo.ventas}</td>
                  <td className="py-3 text-right text-rose-400">{campo.gastos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  color: string
  trend?: number
}) {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/30'
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
      {trend !== undefined && (
        <div className={`mt-3 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mes anterior
        </div>
      )}
    </div>
  )
}
