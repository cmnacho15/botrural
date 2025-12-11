// src/app/api/bot-webhook/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseMessageWithAI } from "@/lib/openai-parser"


// Importar todos los handlers organizados
import {
  sendWhatsAppMessage,
  handleAudioMessage,
  handleConfirmacion,
  solicitarConfirmacion,
  handleImageMessage,
  handleInvoiceButtonResponse,
  handleVentaButtonResponse,
  handleStockButtonResponse,
  handleCambioPotrero,
  handleTokenRegistration,
  handleNombreRegistro,
  isToken,
  solicitarConfirmacionConFlow,
} from "@/lib/whatsapp"

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

/**
 * POST - Recibir mensajes de WhatsApp
 */
export async function POST(request: Request) {
  console.error("=== VERSIÓN: v3.0 REFACTORIZADO - 2025-12-08 ===")
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

    // ==========================================
    // 1. PROCESAR IMÁGENES (facturas)
    // ==========================================
    if (messageType === "image") {
      console.log("DETECTADO messageType === image")
      await handleImageMessage(message, from)
      return NextResponse.json({ status: "image processed" })
    }

    // ==========================================
    // 2. EXTRAER TEXTO DEL MENSAJE
    // ==========================================
    let messageText = ""

    if (messageType === "text") {
      messageText = message.text?.body?.trim() || ""
    } else if (messageType === "interactive") {
      // Usuario clickeó un botón
      const buttonReply = message.interactive?.button_reply
      if (buttonReply) {
        messageText = buttonReply.id
        console.log("Botón clickeado:", messageText)

        // Manejar botones específicos
        if (messageText.startsWith("invoice_")) {
          await handleInvoiceButtonResponse(from, messageText)
          return NextResponse.json({ status: "invoice button processed" })
        }

        if (messageText.startsWith("venta_")) {
          await handleVentaButtonResponse(from, messageText)
          return NextResponse.json({ status: "venta button processed" })
        }

        if (messageText.startsWith("stock_")) {
          await handleStockButtonResponse(from, messageText)
          return NextResponse.json({ status: "stock button processed" })
        }
      }
    } else if (messageType === "audio") {
  // Procesar audio y obtener transcripción
  const transcription = await handleAudioMessage(message, from)
  if (transcription) {
    // Usar la transcripción como mensaje de texto
    messageText = transcription
    console.log(`Audio transcrito, procesando como texto: ${messageText}`)
  } else {
    return NextResponse.json({ status: "audio failed" })
  }
} else {
      // Tipo no soportado
      await sendWhatsAppMessage(
        from,
        "Por ahora solo acepto mensajes de texto, audio e imágenes de facturas"
      )
      return NextResponse.json({ status: "unsupported type" })
    }

    console.log(`Mensaje de ${from}: ${messageText}`)

    // ==========================================
    // 3. FASE 1: Detectar si es un token de invitación
    // ==========================================
    if (await isToken(messageText)) {
      await handleTokenRegistration(from, messageText)
      return NextResponse.json({ status: "token processed" })
    }

    // ==========================================
    // 4. FASE 1.5: Si tiene registro pendiente, procesar nombre
    // ==========================================
    const pendiente = await prisma.pendingRegistration.findUnique({
      where: { telefono: from },
    })

    if (pendiente) {
      await handleNombreRegistro(from, messageText, pendiente.token)
      return NextResponse.json({ status: "nombre processed" })
    }

    // ==========================================
    // 5. FASE 2: Verificar si hay confirmación pendiente
    // ==========================================
    const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
      where: { telefono: from },
    })

    if (confirmacionPendiente) {
      await handleConfirmacion(from, messageText, confirmacionPendiente)
      return NextResponse.json({ status: "confirmacion processed" })
    }

    // ==========================================
    // 6. FASE 3: Procesar con GPT (texto/audio)
    // ==========================================
    const parsedData = await parseMessageWithAI(messageText, from)

    if (parsedData) {
      // Decidir qué tipo de confirmación usar
      if (parsedData.tipo === "GASTO") {
        await solicitarConfirmacionConFlow(from, parsedData)
      } else if (parsedData.tipo === "CAMBIO_POTRERO") {
        await handleCambioPotrero(from, parsedData)
      } else {
        await solicitarConfirmacion(from, parsedData)
      }
      return NextResponse.json({ status: "awaiting confirmation" })
    }

    // ==========================================
    // 7. Mensaje no reconocido
    // ==========================================
    await sendWhatsAppMessage(
      from,
      "No entendí tu mensaje. Podés enviarme cosas como:\n\n" +
        "• nacieron 3 terneros en potrero norte\n" +
        "• murieron 2 vacas en lote sur\n" +
        "• llovieron 25mm\n" +
        "• gasté $5000 en alimento\n" +
        "• moví 10 vacas del potrero norte al sur\n\n" +
        "También podés enviarme un *audio* o una *foto de factura*"
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}