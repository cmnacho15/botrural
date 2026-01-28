'use client'

import { useEffect, useState } from 'react'

interface FeaturesStats {
  resumen: {
    totalEventos: number
    eventosUltimos30Dias: number
    camposActivos: number
    modulosFinancieros: {
      ventas: { total: number; recientes: number; campos: number }
      gastos: { total: number; recientes: number; campos: number }
      compras: { total: number; recientes: number }
    }
  }
  eventosPorTipo: Array<{
    tipo: string
    label: string
    total: number
    recientes: number
    usuariosUnicos: number
  }>
  modulos: Array<{
    nombre: string
    icono: string
    total: number
    recientes: number
    camposUsando: number
  }>
}

export default function FeaturesPage() {
  const [stats, setStats] = useState<FeaturesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/features')
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Uso de Funcionalidades</h1>
          <p className="text-gray-400 text-sm mt-1">Qué módulos y eventos usan más los usuarios</p>
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
          title="Eventos Totales"
          value={stats.resumen.totalEventos.toLocaleString()}
          subtitle={`${stats.resumen.eventosUltimos30Dias.toLocaleString()} últimos 30d`}
          color="purple"
        />
        <StatCard
          title="Campos Activos"
          value={stats.resumen.camposActivos.toString()}
          subtitle="Con eventos registrados"
          color="blue"
        />
        <StatCard
          title="Ventas"
          value={stats.resumen.modulosFinancieros.ventas.total.toLocaleString()}
          subtitle={`${stats.resumen.modulosFinancieros.ventas.campos} campos`}
          color="green"
        />
        <StatCard
          title="Gastos"
          value={stats.resumen.modulosFinancieros.gastos.total.toLocaleString()}
          subtitle={`${stats.resumen.modulosFinancieros.gastos.campos} campos`}
          color="rose"
        />
      </div>

      {/* Módulos */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Uso por Módulo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.modulos.map((m) => (
            <div key={m.nombre} className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{m.icono}</span>
                <span className="text-white font-medium">{m.nombre}</span>
              </div>
              <p className="text-2xl font-bold text-white">{m.total.toLocaleString()}</p>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-green-400">+{m.recientes} (30d)</span>
                {m.camposUsando > 0 && (
                  <span className="text-gray-500">{m.camposUsando} campos</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Eventos por Tipo */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Eventos por Tipo</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium text-right">Total</th>
                <th className="pb-3 font-medium text-right">Últimos 30d</th>
                <th className="pb-3 font-medium text-right">Usuarios únicos</th>
                <th className="pb-3 font-medium">Actividad</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {stats.eventosPorTipo.map((e) => {
                const maxTotal = Math.max(...stats.eventosPorTipo.map(x => x.total))
                const percentage = maxTotal > 0 ? ((e.total / maxTotal) * 100).toFixed(0) : '0'
                return (
                  <tr key={e.tipo} className="border-b border-gray-700/50">
                    <td className="py-3">
                      <span className="text-white font-medium">{e.label}</span>
                    </td>
                    <td className="py-3 text-right text-gray-300">{e.total.toLocaleString()}</td>
                    <td className="py-3 text-right text-green-400">+{e.recientes.toLocaleString()}</td>
                    <td className="py-3 text-right text-blue-400">{e.usuariosUnicos}</td>
                    <td className="py-3 w-40">
                      <div className="bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
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
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
    </div>
  )
}
