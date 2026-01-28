'use client'

import { useEffect, useState } from 'react'

interface QueueStats {
  enabled: boolean
  stats?: {
    pending: number
    processing: number
    processedToday: number
    errorsLast24h: number
    avgProcessingTime: number
    lastMessageAt: number | null
  }
  message?: string
}

interface WhatsAppStats {
  resumen: {
    usuariosActivosHoy: number
    usuariosActivos7d: number
    usuariosActivos30d: number
    totalUsuariosConTelefono: number
    tasaActivacion7d: string
  }
  topUsuarios: Array<{
    id: string
    nombre: string
    telefono: string
    campo: string
    eventos: number
    ultimaActividad: string
    estado: string
  }>
  usuariosRecientes: Array<{
    id: string
    nombre: string
    telefono: string
    campo: string
    ultimaActividad: string
    estado: string
  }>
}

export default function WhatsAppPage() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [waStats, setWaStats] = useState<WhatsAppStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetchAllStats()
  }, [])

  async function fetchAllStats() {
    setLoading(true)
    await Promise.all([fetchQueueStats(), fetchWhatsAppStats()])
    setLoading(false)
  }

  async function fetchQueueStats() {
    try {
      const res = await fetch('/api/bot-worker')
      if (res.ok) {
        const data = await res.json()
        setQueueStats(data)
      }
    } catch (error) {
      console.error('Error fetching queue stats:', error)
    }
  }

  async function fetchWhatsAppStats() {
    try {
      const res = await fetch('/api/admin/whatsapp')
      if (res.ok) {
        const data = await res.json()
        setWaStats(data)
      }
    } catch (error) {
      console.error('Error fetching WhatsApp stats:', error)
    }
  }

  async function processQueueManually() {
    setProcessing(true)
    try {
      const res = await fetch('/api/bot-worker', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Procesados: ${data.processed} mensajes`)
        await fetchQueueStats()
      }
    } catch (error) {
      console.error('Error processing queue:', error)
      alert('Error procesando cola')
    } finally {
      setProcessing(false)
    }
  }

  async function clearQueueManually() {
    if (!confirm('¿Estás seguro de limpiar la cola? Se eliminarán todos los mensajes pendientes.')) {
      return
    }
    setClearing(true)
    try {
      const res = await fetch('/api/bot-worker', { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        alert(`Limpiados: ${data.cleared} mensajes`)
        await fetchQueueStats()
      }
    } catch (error) {
      console.error('Error clearing queue:', error)
      alert('Error limpiando cola')
    } finally {
      setClearing(false)
    }
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'hace segundos'
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
    if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`
    return `hace ${Math.floor(seconds / 86400)}d`
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bot WhatsApp</h1>
          <p className="text-gray-400 text-sm mt-1">Cola de mensajes y estadísticas del bot</p>
        </div>
        <button
          onClick={fetchAllStats}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Queue Stats */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            📬 Cola de Mensajes (Upstash Redis)
          </h2>
          <div className="flex gap-2">
            <button
              onClick={clearQueueManually}
              disabled={clearing || !queueStats?.enabled || (queueStats?.stats?.pending ?? 0) === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
            >
              {clearing ? (
                <>
                  <span className="animate-spin">⏳</span> Limpiando...
                </>
              ) : (
                <>🗑️ Limpiar Cola</>
              )}
            </button>
            <button
              onClick={processQueueManually}
              disabled={processing || !queueStats?.enabled}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
            >
              {processing ? (
                <>
                  <span className="animate-spin">⏳</span> Procesando...
                </>
              ) : (
                <>⚡ Procesar Cola</>
              )}
            </button>
          </div>
        </div>

        {queueStats ? (
          <>
            {/* Primera fila: Estado actual */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${queueStats.enabled ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <p className="text-gray-400 text-sm">Estado</p>
                <p className={`text-xl font-bold ${queueStats.enabled ? 'text-green-400' : 'text-red-400'}`}>
                  {queueStats.enabled ? '✅ Activo' : '❌ Desactivado'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <p className="text-gray-400 text-sm">Pendientes</p>
                <p className="text-xl font-bold text-blue-400">
                  {queueStats.stats?.pending ?? 0}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <p className="text-gray-400 text-sm">Procesando</p>
                <p className="text-xl font-bold text-amber-400">
                  {queueStats.stats?.processing ?? 0}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                <p className="text-gray-400 text-sm">Proveedor</p>
                <p className="text-xl font-bold text-white">
                  Upstash Redis
                </p>
              </div>
            </div>

            {/* Segunda fila: Métricas de rendimiento */}
            {queueStats.enabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <p className="text-gray-400 text-sm">Procesados hoy</p>
                  <p className="text-xl font-bold text-purple-400">
                    {queueStats.stats?.processedToday ?? 0}
                  </p>
                </div>

                <div className={`p-4 rounded-lg ${(queueStats.stats?.errorsLast24h ?? 0) > 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-emerald-500/20 border border-emerald-500/30'}`}>
                  <p className="text-gray-400 text-sm">Errores (24h)</p>
                  <p className={`text-xl font-bold ${(queueStats.stats?.errorsLast24h ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {queueStats.stats?.errorsLast24h ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                  <p className="text-gray-400 text-sm">Tiempo promedio</p>
                  <p className="text-xl font-bold text-cyan-400">
                    {queueStats.stats?.avgProcessingTime
                      ? `${(queueStats.stats.avgProcessingTime / 1000).toFixed(1)}s`
                      : '—'}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <p className="text-gray-400 text-sm">Último mensaje</p>
                  <p className="text-xl font-bold text-indigo-400">
                    {queueStats.stats?.lastMessageAt
                      ? formatTimeAgo(queueStats.stats.lastMessageAt)
                      : '—'}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-400 text-center py-4">
            Error cargando estadísticas de la cola
          </div>
        )}

        {queueStats && !queueStats.enabled && (
          <p className="text-gray-500 text-sm mt-3">
            {queueStats.message || 'La cola no está configurada. Los mensajes se procesan sincrónicamente.'}
          </p>
        )}
      </div>

      {/* WhatsApp Stats */}
      {waStats && (
        <>
          {/* Cards de resumen */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              title="Usuarios con WhatsApp"
              value={waStats.resumen.totalUsuariosConTelefono}
              color="green"
            />
            <StatCard
              title="Activos Hoy"
              value={waStats.resumen.usuariosActivosHoy}
              color="blue"
            />
            <StatCard
              title="Activos (7 días)"
              value={waStats.resumen.usuariosActivos7d}
              color="purple"
            />
            <StatCard
              title="Activos (30 días)"
              value={waStats.resumen.usuariosActivos30d}
              color="amber"
            />
            <StatCard
              title="Tasa Activación"
              value={`${waStats.resumen.tasaActivacion7d}%`}
              color="cyan"
            />
          </div>

          {/* Top Usuarios por Eventos */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Top 10 Usuarios por Eventos (30 días)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Usuario</th>
                    <th className="pb-3 font-medium">Teléfono</th>
                    <th className="pb-3 font-medium">Campo</th>
                    <th className="pb-3 font-medium text-right">Eventos</th>
                    <th className="pb-3 font-medium">Última actividad</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {waStats.topUsuarios.map((u, idx) => (
                    <tr key={u.id} className="border-b border-gray-700/50">
                      <td className="py-3 text-gray-500">{idx + 1}</td>
                      <td className="py-3 text-white font-medium">{u.nombre}</td>
                      <td className="py-3 text-gray-400">{u.telefono}</td>
                      <td className="py-3 text-gray-400">{u.campo}</td>
                      <td className="py-3 text-right text-green-400 font-medium">{u.eventos}</td>
                      <td className="py-3 text-gray-500 text-xs">
                        {u.ultimaActividad ? new Date(u.ultimaActividad).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {waStats.topUsuarios.length === 0 && (
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

          {/* Usuarios Recientes */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Últimos 20 Usuarios Activos</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 font-medium">Usuario</th>
                    <th className="pb-3 font-medium">Teléfono</th>
                    <th className="pb-3 font-medium">Campo</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Última actividad</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {waStats.usuariosRecientes?.map((u) => (
                    <tr key={u.id} className="border-b border-gray-700/50">
                      <td className="py-3 text-white font-medium">{u.nombre}</td>
                      <td className="py-3 text-gray-400">{u.telefono}</td>
                      <td className="py-3 text-gray-400">{u.campo}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          u.estado === 'IDLE' ? 'bg-green-500/20 text-green-400' :
                          u.estado === 'AWAITING_CONFIRMATION' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {u.estado || 'IDLE'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 text-xs">
                        {u.ultimaActividad ? new Date(u.ultimaActividad).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {(!waStats.usuariosRecientes || waStats.usuariosRecientes.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        Sin datos de usuarios recientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}
