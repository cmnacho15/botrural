// src/app/api/bot-worker/route.ts
// Worker que procesa mensajes de la cola de Redis
// Se ejecuta via Vercel Cron o manualmente

import { NextResponse } from "next/server"
import { processQueue, getQueueStats, isQueueEnabled, clearQueue, QueuedMessage } from "@/lib/redis-queue"

// Importar la función de procesamiento del webhook
import { processWhatsAppMessage } from "@/lib/whatsapp/processor"

/**
 * GET - Obtener estadísticas de la cola
 */
export async function GET() {
  if (!isQueueEnabled()) {
    return NextResponse.json({
      enabled: false,
      message: "Queue no configurado (Redis no disponible)"
    })
  }

  const stats = await getQueueStats()
  return NextResponse.json({
    enabled: true,
    stats
  })
}

/**
 * POST - Procesar mensajes de la cola
 * Llamado por Vercel Cron cada minuto o manualmente
 */
export async function POST(request: Request) {
  // Verificar autorización (opcional, para cron)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // Si hay CRON_SECRET configurado, verificar
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Permitir sin auth si no hay secret (desarrollo)
    if (authHeader) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
  }

  if (!isQueueEnabled()) {
    return NextResponse.json({
      processed: 0,
      message: "Queue no habilitado"
    })
  }

  const startTime = Date.now()

  try {
    const processed = await processQueue(async (queuedMessage: QueuedMessage) => {
      console.log(`🔄 [WORKER] Procesando mensaje ${queuedMessage.id}`)

      // Procesar el mensaje usando la misma lógica del webhook
      await processWhatsAppMessage(
        queuedMessage.message,
        queuedMessage.from,
        queuedMessage.messageType
      )
    })

    const duration = Date.now() - startTime
    const stats = await getQueueStats()

    console.log(`✅ [WORKER] Procesados ${processed} mensajes en ${duration}ms`)

    return NextResponse.json({
      processed,
      duration,
      stats,
    })
  } catch (error) {
    console.error("❌ [WORKER] Error procesando cola:", error)
    return NextResponse.json(
      { error: "Error procesando cola" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Limpiar todos los mensajes de la cola
 * Útil para eliminar mensajes obsoletos/stale
 */
export async function DELETE() {
  if (!isQueueEnabled()) {
    return NextResponse.json({
      cleared: 0,
      message: "Queue no habilitado"
    })
  }

  try {
    const result = await clearQueue()
    const stats = await getQueueStats()

    return NextResponse.json({
      ...result,
      stats
    })
  } catch (error) {
    console.error("❌ [WORKER] Error limpiando cola:", error)
    return NextResponse.json(
      { error: "Error limpiando cola" },
      { status: 500 }
    )
  }
}
