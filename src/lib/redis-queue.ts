// src/lib/redis-queue.ts
// Queue de mensajes WhatsApp usando Upstash Redis
// Permite manejar alta concurrencia (100+ mensajes simultáneos)

import { Redis } from "@upstash/redis"

// Inicializar Redis solo si hay credenciales
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

const QUEUE_KEY = "whatsapp:message:queue"
const PROCESSING_KEY = "whatsapp:message:processing"
const METRICS_KEY = "whatsapp:metrics"

// Obtener fecha actual en formato YYYY-MM-DD para keys diarios
const getTodayKey = () => new Date().toISOString().split('T')[0]

export interface QueuedMessage {
  id: string
  message: any
  from: string
  messageType: string
  timestamp: number
  attempts: number
}

/**
 * Verifica si el queue está habilitado
 */
export function isQueueEnabled(): boolean {
  return redis !== null
}

/**
 * Agrega un mensaje a la cola
 * Retorna true si se encoló, false si hay que procesar sincrónicamente
 */
export async function enqueueMessage(data: Omit<QueuedMessage, "id" | "attempts">): Promise<boolean> {
  if (!redis) {
    console.log("⚠️ [QUEUE] Redis no configurado, procesando sincrónicamente")
    return false
  }

  try {
    const queuedMessage: QueuedMessage = {
      ...data,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
    }

    // Agregar a la cola (LPUSH para FIFO con RPOP)
    await redis.lpush(QUEUE_KEY, JSON.stringify(queuedMessage))

    console.log(`✅ [QUEUE] Mensaje encolado: ${queuedMessage.id} de ${data.from}`)
    return true
  } catch (error) {
    console.error("❌ [QUEUE] Error encolando mensaje:", error)
    return false
  }
}

/**
 * Obtiene el siguiente mensaje de la cola para procesar
 */
export async function dequeueMessage(): Promise<QueuedMessage | null> {
  if (!redis) return null

  try {
    // Obtener mensaje de la cola (RPOP para FIFO)
    const messageStr = await redis.rpop(QUEUE_KEY)

    if (!messageStr) return null

    // Agregar a processing
    await redis.lpush(PROCESSING_KEY, messageStr as string)

    return JSON.parse(messageStr as string) as QueuedMessage
  } catch (error) {
    console.error("❌ [QUEUE] Error obteniendo mensaje:", error)
    return null
  }
}

/**
 * Marca un mensaje como completado (lo elimina de processing)
 */
export async function completeMessage(messageId: string): Promise<void> {
  if (!redis) return

  try {
    // Obtener todos los mensajes en processing y eliminar el completado
    const messages = await redis.lrange(PROCESSING_KEY, 0, -1)

    for (const msgStr of messages) {
      const msg = JSON.parse(msgStr as string) as QueuedMessage
      if (msg.id === messageId) {
        await redis.lrem(PROCESSING_KEY, 1, msgStr)
        console.log(`✅ [QUEUE] Mensaje completado: ${messageId}`)
        break
      }
    }
  } catch (error) {
    console.error("❌ [QUEUE] Error completando mensaje:", error)
  }
}

/**
 * Reencola un mensaje fallido para reintento
 */
export async function requeueMessage(message: QueuedMessage): Promise<void> {
  if (!redis) return

  try {
    // Eliminar de processing
    const messages = await redis.lrange(PROCESSING_KEY, 0, -1)
    for (const msgStr of messages) {
      const msg = JSON.parse(msgStr as string) as QueuedMessage
      if (msg.id === message.id) {
        await redis.lrem(PROCESSING_KEY, 1, msgStr)
        break
      }
    }

    // Si tiene menos de 3 intentos, reencolar
    if (message.attempts < 3) {
      message.attempts++
      await redis.lpush(QUEUE_KEY, JSON.stringify(message))
      console.log(`🔄 [QUEUE] Mensaje reencolado (intento ${message.attempts}): ${message.id}`)
    } else {
      console.error(`❌ [QUEUE] Mensaje descartado después de 3 intentos: ${message.id}`)
    }
  } catch (error) {
    console.error("❌ [QUEUE] Error reencolando mensaje:", error)
  }
}

export interface QueueMetrics {
  pending: number
  processing: number
  processedToday: number
  errorsLast24h: number
  avgProcessingTime: number
  lastMessageAt: number | null
}

/**
 * Registra una métrica de mensaje procesado
 */
export async function trackMessageProcessed(processingTimeMs: number): Promise<void> {
  if (!redis) return

  try {
    const todayKey = getTodayKey()
    const now = Date.now()

    // Incrementar contador de procesados hoy
    await redis.hincrby(METRICS_KEY, `processed:${todayKey}`, 1)

    // Guardar último mensaje procesado
    await redis.hset(METRICS_KEY, { lastMessageAt: now })

    // Acumular tiempo de procesamiento para calcular promedio
    await redis.hincrby(METRICS_KEY, `totalTime:${todayKey}`, Math.round(processingTimeMs))

  } catch (error) {
    console.error("❌ [QUEUE] Error tracking metrics:", error)
  }
}

/**
 * Registra un error de procesamiento
 */
export async function trackMessageError(): Promise<void> {
  if (!redis) return

  try {
    const todayKey = getTodayKey()
    await redis.hincrby(METRICS_KEY, `errors:${todayKey}`, 1)
  } catch (error) {
    console.error("❌ [QUEUE] Error tracking error metric:", error)
  }
}

/**
 * Obtiene estadísticas de la cola
 */
export async function getQueueStats(): Promise<QueueMetrics | null> {
  if (!redis) return null

  try {
    const todayKey = getTodayKey()
    const yesterdayKey = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Obtener todas las métricas en paralelo
    const [
      pending,
      processing,
      processedToday,
      processedYesterday,
      errorsToday,
      errorsYesterday,
      totalTimeToday,
      lastMessageAt
    ] = await Promise.all([
      redis.llen(QUEUE_KEY),
      redis.llen(PROCESSING_KEY),
      redis.hget(METRICS_KEY, `processed:${todayKey}`),
      redis.hget(METRICS_KEY, `processed:${yesterdayKey}`),
      redis.hget(METRICS_KEY, `errors:${todayKey}`),
      redis.hget(METRICS_KEY, `errors:${yesterdayKey}`),
      redis.hget(METRICS_KEY, `totalTime:${todayKey}`),
      redis.hget(METRICS_KEY, "lastMessageAt")
    ])

    const processedTodayNum = Number(processedToday) || 0
    const totalTimeTodayNum = Number(totalTimeToday) || 0
    const errorsTodayNum = Number(errorsToday) || 0
    const errorsYesterdayNum = Number(errorsYesterday) || 0

    // Calcular promedio de tiempo de procesamiento
    const avgProcessingTime = processedTodayNum > 0
      ? totalTimeTodayNum / processedTodayNum
      : 0

    return {
      pending,
      processing,
      processedToday: processedTodayNum,
      errorsLast24h: errorsTodayNum + errorsYesterdayNum,
      avgProcessingTime: Math.round(avgProcessingTime),
      lastMessageAt: lastMessageAt ? Number(lastMessageAt) : null
    }
  } catch (error) {
    console.error("❌ [QUEUE] Error obteniendo stats:", error)
    return null
  }
}

/**
 * Limpia todos los mensajes de la cola (pendientes y en procesamiento)
 * Útil para eliminar mensajes obsoletos
 */
export async function clearQueue(): Promise<{ cleared: number }> {
  if (!redis) return { cleared: 0 }

  try {
    const [pendingCount, processingCount] = await Promise.all([
      redis.llen(QUEUE_KEY),
      redis.llen(PROCESSING_KEY)
    ])

    // Eliminar ambas listas
    await Promise.all([
      redis.del(QUEUE_KEY),
      redis.del(PROCESSING_KEY)
    ])

    const total = pendingCount + processingCount
    console.log(`🗑️ [QUEUE] Cola limpiada: ${pendingCount} pendientes, ${processingCount} en proceso`)

    return { cleared: total }
  } catch (error) {
    console.error("❌ [QUEUE] Error limpiando cola:", error)
    return { cleared: 0 }
  }
}

/**
 * Procesa todos los mensajes pendientes en la cola
 * Llamado por el worker/cron
 */
export async function processQueue(
  processor: (message: QueuedMessage) => Promise<void>
): Promise<number> {
  if (!redis) return 0

  let processed = 0
  const maxBatch = 10 // Procesar máximo 10 por llamada

  while (processed < maxBatch) {
    const message = await dequeueMessage()
    if (!message) break

    const startTime = Date.now()

    try {
      console.log(`🔄 [QUEUE] Procesando: ${message.id} de ${message.from}`)
      await processor(message)
      await completeMessage(message.id)

      // Trackear métricas de éxito
      const processingTime = Date.now() - startTime
      await trackMessageProcessed(processingTime)

      processed++
    } catch (error) {
      console.error(`❌ [QUEUE] Error procesando ${message.id}:`, error)
      await trackMessageError()
      await requeueMessage(message)
    }
  }

  return processed
}
