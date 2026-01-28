// src/app/api/bot-webhook/route.ts

import { NextResponse } from "next/server"
import { enqueueMessage, isQueueEnabled } from "@/lib/redis-queue"
import { processWhatsAppMessage } from "@/lib/whatsapp/processor"

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "mi_token_secreto"

/**
 * GET - Verificación del webhook de WhatsApp
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado")
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Verificación fallida" }, { status: 403 })
}

// URL base para llamar al worker
const getWorkerUrl = () => {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || "http://localhost:3000"
  return `${baseUrl}/api/bot-worker`
}

/**
 * Dispara el worker de forma asíncrona (fire-and-forget)
 */
async function triggerWorker() {
  try {
    const workerUrl = getWorkerUrl()
    // Fire-and-forget: no esperamos la respuesta
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET || ""}`
      },
    }).catch(err => console.error("Error triggering worker:", err))
  } catch (error) {
    console.error("Error al disparar worker:", error)
  }
}

/**
 * POST - Recibir mensajes de WhatsApp
 * Procesa sincrónicamente + trackea en Redis para métricas
 */
export async function POST(request: Request) {
  console.error("=== VERSIÓN: v3.5 SYNC + METRICS - 2025-01-28 ===")
  try {
    const body = await request.json()

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages?.[0]) {
      return NextResponse.json({ status: "no message" })
    }

    const message = value.messages[0]
    const from = message.from
    const messageType = message.type

    console.log(`Mensaje recibido: ${messageType} de ${from}`)

    const startTime = Date.now()

    // ==========================================
    // PROCESAR SINCRÓNICAMENTE
    // ==========================================
    try {
      const result = await processWhatsAppMessage(message, from, messageType)

      // Trackear métricas en Redis (no bloquea)
      if (isQueueEnabled()) {
        const { trackMessageProcessed } = await import("@/lib/redis-queue")
        trackMessageProcessed(Date.now() - startTime).catch(() => {})
      }

      return NextResponse.json(result)
    } catch (processingError) {
      console.error("Error procesando mensaje:", processingError)

      // Trackear error en Redis (no bloquea)
      if (isQueueEnabled()) {
        const { trackMessageError } = await import("@/lib/redis-queue")
        trackMessageError().catch(() => {})
      }

      throw processingError
    }

  } catch (error) {
    console.error("Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}