"use client"

import { useState, useEffect } from "react"

interface ErrorLog {
  id: string
  source: string
  level: string
  message: string
  stack?: string
  context?: any
  url?: string
  resolved: boolean
  resolvedAt?: string
  notes?: string
  emailSent: boolean
  createdAt: string
  user?: {
    name?: string
    email?: string
    telefono?: string
  }
}

interface UserWithErrors {
  id: string
  label: string
  campo: string
  count: number
}

interface LogsData {
  logs: ErrorLog[]
  total: number
  stats: Record<string, number>
  users: UserWithErrors[]
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

// Estilos inline para proteger de dark mode
const styles = {
  container: {
    padding: "16px",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#e5e7eb",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px",
    color: "#fff",
  },
  statsRow: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
  },
  statBadge: (color: string) => ({
    padding: "8px 16px",
    borderRadius: "8px",
    backgroundColor: color,
    fontWeight: 600,
    fontSize: "14px",
  }),
  filtersContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
    padding: "16px",
    backgroundColor: "#1f2937",
    borderRadius: "12px",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #374151",
    backgroundColor: "#111827",
    color: "#e5e7eb",
    fontSize: "14px",
    width: "100%",
    cursor: "pointer",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
  },
  logCard: (resolved: boolean) => ({
    backgroundColor: resolved ? "#064e3b" : "#1f2937",
    border: `1px solid ${resolved ? "#10b981" : "#374151"}`,
    borderRadius: "12px",
    marginBottom: "12px",
    overflow: "hidden",
  }),
  logHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    cursor: "pointer",
    flexWrap: "wrap" as const,
  },
  levelBadge: (level: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      CRITICAL: { bg: "#dc2626", text: "#fff" },
      ERROR: { bg: "#f97316", text: "#fff" },
      WARNING: { bg: "#eab308", text: "#000" },
    }
    const c = colors[level] || { bg: "#3b82f6", text: "#fff" }
    return {
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 700,
      backgroundColor: c.bg,
      color: c.text,
    }
  },
  userBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    backgroundColor: "#7c3aed",
    color: "#fff",
    whiteSpace: "nowrap" as const,
  },
  message: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#d1d5db",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    minWidth: 0,
  },
  date: {
    fontSize: "12px",
    color: "#9ca3af",
    whiteSpace: "nowrap" as const,
  },
  resolveBtn: (resolved: boolean) => ({
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    border: "none",
    cursor: "pointer",
    backgroundColor: resolved ? "#10b981" : "#4b5563",
    color: "#fff",
  }),
  expandedContent: {
    padding: "16px",
    backgroundColor: "#111827",
    borderTop: "1px solid #374151",
  },
  codeBlock: {
    backgroundColor: "#000",
    color: "#10b981",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontFamily: "monospace",
    overflowX: "auto" as const,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    marginTop: "8px",
  },
  label: {
    fontWeight: 600,
    color: "#9ca3af",
    fontSize: "13px",
    marginBottom: "4px",
    display: "block",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "16px",
    marginTop: "24px",
    flexWrap: "wrap" as const,
  },
  pageBtn: (disabled: boolean) => ({
    padding: "10px 20px",
    borderRadius: "8px",
    backgroundColor: disabled ? "#374151" : "#4b5563",
    color: disabled ? "#6b7280" : "#fff",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }),
}

export default function AdminLogsPage() {
  const [data, setData] = useState<LogsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    source: "",
    level: "",
    resolved: "",
    userId: "",
    dateRange: "7d"
  })
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.source) params.set("source", filters.source)
      if (filters.level) params.set("level", filters.level)
      if (filters.resolved) params.set("resolved", filters.resolved)
      if (filters.userId) params.set("userId", filters.userId)
      if (filters.dateRange) params.set("dateRange", filters.dateRange)
      params.set("offset", offset.toString())
      params.set("limit", "30")

      const res = await fetch(`/api/admin/logs?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [filters, offset])

  const toggleResolved = async (id: string, currentResolved: boolean) => {
    try {
      const res = await fetch("/api/admin/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: !currentResolved })
      })
      if (res.ok) fetchLogs()
    } catch (error) {
      console.error("Error updating log:", error)
    }
  }

  const getSourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      WEB: "🌐",
      WHATSAPP: "📱",
      API: "⚙️",
      CRON: "⏰"
    }
    return icons[source] || "📝"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const totalUnresolved = data?.stats ? Object.values(data.stats).reduce((a, b) => a + b, 0) : 0

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🚨 Logs de Errores</h1>

      {/* Stats */}
      {data?.stats && (
        <div style={styles.statsRow}>
          <div style={styles.statBadge("#7f1d1d")}>
            <span style={{ color: "#fca5a5" }}>🔴 CRITICAL: {data.stats.CRITICAL || 0}</span>
          </div>
          <div style={styles.statBadge("#7c2d12")}>
            <span style={{ color: "#fdba74" }}>🟠 ERROR: {data.stats.ERROR || 0}</span>
          </div>
          <div style={styles.statBadge("#713f12")}>
            <span style={{ color: "#fde047" }}>🟡 WARNING: {data.stats.WARNING || 0}</span>
          </div>
          <div style={{ ...styles.statBadge("#1f2937"), marginLeft: "auto" }}>
            <span style={{ color: "#9ca3af" }}>Total sin resolver: {totalUnresolved}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersContainer}>
        <select
          value={filters.userId}
          onChange={(e) => { setFilters({ ...filters, userId: e.target.value }); setOffset(0) }}
          style={styles.select}
        >
          <option value="">👤 Todos los usuarios</option>
          {data?.users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label} ({u.campo}) - {u.count}
            </option>
          ))}
        </select>

        <select
          value={filters.dateRange}
          onChange={(e) => { setFilters({ ...filters, dateRange: e.target.value }); setOffset(0) }}
          style={styles.select}
        >
          <option value="24h">📅 Últimas 24h</option>
          <option value="7d">📅 Últimos 7 días</option>
          <option value="30d">📅 Últimos 30 días</option>
          <option value="all">📅 Todo</option>
        </select>

        <select
          value={filters.source}
          onChange={(e) => { setFilters({ ...filters, source: e.target.value }); setOffset(0) }}
          style={styles.select}
        >
          <option value="">📍 Origen</option>
          <option value="WEB">🌐 Web</option>
          <option value="WHATSAPP">📱 WhatsApp</option>
          <option value="API">⚙️ API</option>
          <option value="CRON">⏰ Cron</option>
        </select>

        <select
          value={filters.level}
          onChange={(e) => { setFilters({ ...filters, level: e.target.value }); setOffset(0) }}
          style={styles.select}
        >
          <option value="">⚡ Nivel</option>
          <option value="CRITICAL">🔴 Critical</option>
          <option value="ERROR">🟠 Error</option>
          <option value="WARNING">🟡 Warning</option>
        </select>

        <select
          value={filters.resolved}
          onChange={(e) => { setFilters({ ...filters, resolved: e.target.value }); setOffset(0) }}
          style={styles.select}
        >
          <option value="">📋 Estado</option>
          <option value="false">❌ Sin resolver</option>
          <option value="true">✅ Resueltos</option>
        </select>

        <button onClick={fetchLogs} style={styles.button}>
          🔄 Refrescar
        </button>
      </div>

      {/* Logs list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
          Cargando...
        </div>
      ) : data?.logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          No hay logs con estos filtros
        </div>
      ) : (
        <div>
          {data?.logs.map((log) => (
            <div key={log.id} style={styles.logCard(log.resolved)}>
              {/* Header */}
              <div
                style={styles.logHeader}
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <span style={{ fontSize: "18px" }}>{getSourceIcon(log.source)}</span>
                <span style={styles.levelBadge(log.level)}>{log.level}</span>
                <span style={styles.userBadge}>
                  👤 {log.user?.name || log.user?.email || log.user?.telefono || "Anónimo"}
                </span>
                <span style={styles.message}>{log.message}</span>
                <span style={styles.date}>{formatDate(log.createdAt)}</span>
                {log.emailSent && <span title="Email enviado">📧</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleResolved(log.id, log.resolved) }}
                  style={styles.resolveBtn(log.resolved)}
                >
                  {log.resolved ? "✅" : "Resolver"}
                </button>
                <span style={{ color: "#6b7280" }}>{expandedLog === log.id ? "▲" : "▼"}</span>
              </div>

              {/* Expanded content */}
              {expandedLog === log.id && (
                <div style={styles.expandedContent}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                    <div>
                      <span style={styles.label}>Usuario</span>
                      <span style={{ color: "#e5e7eb" }}>
                        {log.user?.name || log.user?.email || log.user?.telefono || "Anónimo"}
                      </span>
                    </div>
                    {log.url && (
                      <div>
                        <span style={styles.label}>URL</span>
                        <code style={{ color: "#60a5fa", fontSize: "12px", wordBreak: "break-all" }}>{log.url}</code>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <span style={styles.label}>Mensaje</span>
                    <pre style={styles.codeBlock}>{log.message}</pre>
                  </div>

                  {log.stack && (
                    <div style={{ marginBottom: "16px" }}>
                      <span style={styles.label}>Stack trace</span>
                      <pre style={{ ...styles.codeBlock, maxHeight: "200px", overflowY: "auto" }}>
                        {log.stack}
                      </pre>
                    </div>
                  )}

                  {log.context && (
                    <div style={{ marginBottom: "16px" }}>
                      <span style={styles.label}>Contexto</span>
                      <pre style={{ ...styles.codeBlock, color: "#fbbf24" }}>
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.notes && (
                    <div style={{ padding: "12px", backgroundColor: "#422006", borderRadius: "8px" }}>
                      <span style={styles.label}>Notas</span>
                      <span style={{ color: "#fde047" }}>{log.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 30 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setOffset(Math.max(0, offset - 30))}
            disabled={offset === 0}
            style={styles.pageBtn(offset === 0)}
          >
            ← Anterior
          </button>
          <span style={{ color: "#9ca3af" }}>
            {offset + 1} - {Math.min(offset + 30, data.total)} de {data.total}
          </span>
          <button
            onClick={() => setOffset(offset + 30)}
            disabled={!data.pagination.hasMore}
            style={styles.pageBtn(!data.pagination.hasMore)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
