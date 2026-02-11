// src/lib/error-logger.ts
// Cliente para enviar errores al sistema de logs

type LogLevel = "ERROR" | "WARNING" | "CRITICAL"
type LogSource = "WEB" | "WHATSAPP" | "API" | "CRON"

interface LogErrorOptions {
  level?: LogLevel
  source?: LogSource
  context?: Record<string, any>
  url?: string
}

/**
 * Envía un error al sistema de logs (desde el cliente o servidor)
 */
export async function logError(
  message: string,
  error?: Error | unknown,
  options: LogErrorOptions = {}
): Promise<void> {
  try {
    const stack = error instanceof Error ? error.stack : undefined

    // Detectar si estamos en el cliente o servidor
    const isClient = typeof window !== "undefined"
    const baseUrl = isClient ? "" : process.env.NEXT_PUBLIC_APP_URL || "https://botrural.vercel.app"

    await fetch(`${baseUrl}/api/logs/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: options.source || (isClient ? "WEB" : "API"),
        level: options.level || "ERROR",
        message,
        stack,
        context: options.context,
        url: options.url || (isClient ? window.location.href : undefined)
      })
    })
  } catch (e) {
    // Si falla el log, al menos loguear en consola
    console.error("Error enviando log:", e)
    console.error("Error original:", message, error)
  }
}

/**
 * Log de error crítico (siempre envía email)
 */
export async function logCritical(
  message: string,
  error?: Error | unknown,
  context?: Record<string, any>
): Promise<void> {
  return logError(message, error, { level: "CRITICAL", context })
}

/**
 * Log de warning (no envía email inmediato)
 */
export async function logWarning(
  message: string,
  context?: Record<string, any>
): Promise<void> {
  return logError(message, undefined, { level: "WARNING", context })
}

/**
 * Log específico para errores de WhatsApp
 */
export async function logWhatsAppError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, any>
): Promise<void> {
  return logError(message, error, { source: "WHATSAPP", context })
}

/**
 * Log específico para errores de cron jobs
 */
export async function logCronError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, any>
): Promise<void> {
  return logError(message, error, { source: "CRON", context })
}
