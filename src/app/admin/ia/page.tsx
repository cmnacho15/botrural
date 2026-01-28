'use client'

import { useEffect, useState } from 'react'

interface IAStats {
  resumen: {
    totalRequests: number
    requestsHoy: number
    requests7d: number
    requests30d: number
    totalTokens: number
    tokensHoy: number
    tokens7d: number
    tokens30d: number
    totalCostUSD: number
    costHoyUSD: number
    cost7dUSD: number
    cost30dUSD: number
  }
  porProveedor: Array<{
    provider: string
    requests: number
    tokens: number
    costUSD: number
  }>
  porFeature: Array<{
    feature: string
    label: string
    requests: number
    tokens: number
    costUSD: number
  }>
  porModelo: Array<{
    model: string
    requests: number
    tokens: number
    costUSD: number
  }>
  topUsuarios: Array<{
    id: string
    nombre: string
    email: string
    campo: string
    requests: number
    tokens: number
    costUSD: number
  }>
}

export default function IAConsumptionPage() {
  const [stats, setStats] = useState<IAStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/ia')
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
          <p className="text-red-400">{error || 'Sin datos de consumo de IA'}</p>
          <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-600 rounded-lg text-white">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Consumo de IA</h1>
          <p className="text-gray-400 text-sm mt-1">Tokens consumidos y costos por usuario</p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Costo Total"
          value={`$${stats.resumen.totalCostUSD.toFixed(2)}`}
          subtitle={`$${stats.resumen.cost30dUSD.toFixed(2)} últimos 30d`}
          color="green"
        />
        <StatCard
          title="Tokens Totales"
          value={formatNumber(stats.resumen.totalTokens)}
          subtitle={`${formatNumber(stats.resumen.tokens30d)} últimos 30d`}
          color="blue"
        />
        <StatCard
          title="Requests Hoy"
          value={stats.resumen.requestsHoy.toString()}
          subtitle={`$${stats.resumen.costHoyUSD.toFixed(4)} USD`}
          color="purple"
        />
        <StatCard
          title="Requests 7 días"
          value={stats.resumen.requests7d.toString()}
          subtitle={`$${stats.resumen.cost7dUSD.toFixed(2)} USD`}
          color="amber"
        />
      </div>

      {/* Por Proveedor y Por Modelo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Proveedor */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Por Proveedor</h2>
          <div className="space-y-3">
            {stats.porProveedor.map((p) => (
              <div key={p.provider} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <span className="text-white font-medium">{p.provider}</span>
                  <p className="text-gray-400 text-sm">{p.requests} requests</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-medium">${p.costUSD.toFixed(2)}</p>
                  <p className="text-gray-500 text-xs">{formatNumber(p.tokens)} tokens</p>
                </div>
              </div>
            ))}
            {stats.porProveedor.length === 0 && (
              <p className="text-gray-500 text-center py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Por Modelo */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Por Modelo</h2>
          <div className="space-y-3">
            {stats.porModelo.slice(0, 6).map((m) => (
              <div key={m.model} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <span className="text-white font-medium text-sm">{m.model}</span>
                  <p className="text-gray-400 text-xs">{m.requests} requests</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-medium">${m.costUSD.toFixed(3)}</p>
                  <p className="text-gray-500 text-xs">{formatNumber(m.tokens)} tokens</p>
                </div>
              </div>
            ))}
            {stats.porModelo.length === 0 && (
              <p className="text-gray-500 text-center py-4">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      {/* Por Feature */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Por Funcionalidad</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.porFeature.map((f) => (
            <div key={f.feature} className="p-4 bg-gray-700/50 rounded-lg">
              <p className="text-white font-medium">{f.label}</p>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-400">{f.requests} requests</span>
                <span className="text-green-400">${f.costUSD.toFixed(3)}</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{formatNumber(f.tokens)} tokens</p>
            </div>
          ))}
          {stats.porFeature.length === 0 && (
            <p className="text-gray-500 text-center py-4 col-span-3">Sin datos</p>
          )}
        </div>
      </div>

      {/* Top Usuarios */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Top 10 Usuarios (30 días)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Campo</th>
                <th className="pb-3 font-medium text-right">Requests</th>
                <th className="pb-3 font-medium text-right">Tokens</th>
                <th className="pb-3 font-medium text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.topUsuarios.map((u, idx) => (
                <tr key={u.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-500">{idx + 1}</td>
                  <td className="py-3">
                    <p className="text-white">{u.nombre}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                  </td>
                  <td className="py-3 text-gray-400">{u.campo}</td>
                  <td className="py-3 text-right text-gray-300">{u.requests}</td>
                  <td className="py-3 text-right text-gray-300">{formatNumber(u.tokens)}</td>
                  <td className="py-3 text-right text-green-400">${u.costUSD.toFixed(3)}</td>
                </tr>
              ))}
              {stats.topUsuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Sin datos de usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle, color }: {
  title: string
  value: string
  subtitle: string
  color: string
}) {
  const colors: Record<string, string> = {
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
