'use client'

import { useEffect, useState } from 'react'

interface MetricasStats {
  resumen: {
    totalUsuarios: number
    usuariosActivos: number
    totalCampos: number
    totalGrupos: number
    trialsPorExpirar: number
    tasaRetencion: number
  }
  usuariosPorEstado: Array<{ estado: string; cantidad: number }>
  usuariosPorMes: Array<{ mes: string; total: number; activos: number }>
  camposPorTamano: Array<{ rango: string; cantidad: number }>
  topCampos: Array<{
    id: string
    nombre: string
    grupo: string | null
    usuarios: number
    eventos: number
    ventas: number
    gastos: number
    lotes: number
    hectareas: number
  }>
}

export default function MetricasPage() {
  const [stats, setStats] = useState<MetricasStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/metricas')
      if (!res.ok) throw new Error('Error cargando datos')
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error || 'Sin datos'}</p>
          <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-600 rounded-lg text-white">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const tasaActividad = stats.resumen.totalUsuarios > 0
    ? ((stats.resumen.usuariosActivos / stats.resumen.totalUsuarios) * 100).toFixed(1)
    : '0'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Métricas de Negocio</h1>
          <p className="text-gray-400 text-sm mt-1">Usuarios, retención y crecimiento</p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Usuarios" value={stats.resumen.totalUsuarios} color="purple" />
        <StatCard title="Activos (30d)" value={stats.resumen.usuariosActivos} color="green" />
        <StatCard title="Campos" value={stats.resumen.totalCampos} color="blue" />
        <StatCard title="Grupos" value={stats.resumen.totalGrupos} color="amber" />
        <StatCard title="Tasa Actividad" value={`${tasaActividad}%`} color="cyan" />
        <StatCard title="Retención" value={`${stats.resumen.tasaRetencion}%`} color="emerald" />
      </div>

      {/* Usuarios por Estado y Por Tamaño de Campo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Estado */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Usuarios por Estado/Rol</h2>
          <div className="space-y-3">
            {stats.usuariosPorEstado.map((e) => {
              const percentage = stats.resumen.totalUsuarios > 0
                ? ((e.cantidad / stats.resumen.totalUsuarios) * 100).toFixed(1)
                : '0'
              return (
                <div key={e.estado} className="flex items-center gap-3">
                  <span className="text-gray-400 w-32 text-sm truncate">{e.estado}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-12 text-right">{e.cantidad}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Por Tamaño */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Campos por Superficie</h2>
          <div className="space-y-3">
            {stats.camposPorTamano.map((c) => {
              const max = Math.max(...stats.camposPorTamano.map(x => x.cantidad))
              const percentage = max > 0 ? ((c.cantidad / max) * 100).toFixed(0) : '0'
              return (
                <div key={c.rango} className="flex items-center gap-3">
                  <span className="text-gray-400 w-28 text-sm">{c.rango}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-12 text-right">{c.cantidad}</span>
                </div>
              )
            })}
            {stats.camposPorTamano.length === 0 && (
              <p className="text-gray-500 text-center py-4">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      {/* Crecimiento por Mes */}
      {stats.usuariosPorMes.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Usuarios por Mes (últimos 6 meses)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.usuariosPorMes.map((m) => {
              const fecha = new Date(m.mes)
              const mesNombre = fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
              return (
                <div key={m.mes} className="p-4 bg-gray-700/50 rounded-lg text-center">
                  <p className="text-gray-400 text-sm uppercase">{mesNombre}</p>
                  <p className="text-2xl font-bold text-white mt-1">{m.total}</p>
                  <p className="text-green-400 text-xs mt-1">{m.activos} activos</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Campos */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Top 15 Campos por Actividad</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Campo</th>
                <th className="pb-3 font-medium">Grupo</th>
                <th className="pb-3 font-medium text-right">Usuarios</th>
                <th className="pb-3 font-medium text-right">Eventos</th>
                <th className="pb-3 font-medium text-right">Ventas</th>
                <th className="pb-3 font-medium text-right">Gastos</th>
                <th className="pb-3 font-medium text-right">Hectáreas</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.topCampos.map((c, idx) => (
                <tr key={c.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-500">{idx + 1}</td>
                  <td className="py-3 text-white font-medium">{c.nombre}</td>
                  <td className="py-3 text-gray-400">{c.grupo || '—'}</td>
                  <td className="py-3 text-right text-gray-300">{c.usuarios}</td>
                  <td className="py-3 text-right text-blue-400">{c.eventos.toLocaleString()}</td>
                  <td className="py-3 text-right text-green-400">{c.ventas}</td>
                  <td className="py-3 text-right text-rose-400">{c.gastos}</td>
                  <td className="py-3 text-right text-gray-300">{c.hectareas.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4 text-center`}>
      <p className="text-gray-400 text-xs uppercase">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}
