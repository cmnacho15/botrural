import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "mi_token_secreto"
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID

/**
 * GET - Verificación del webhook de WhatsApp
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  console.log("🔍 Verificación webhook:", { mode, token, challenge })

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado")
    return new NextResponse(challenge, { status: 200 })
  }

  console.log("❌ Verificación fallida")
  return NextResponse.json({ error: "Verificación fallida" }, { status: 403 })
}

/**
 * POST - Recibir mensajes de WhatsApp
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Extraer mensaje
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages?.[0]) {
      return NextResponse.json({ status: "no message" })
    }

    const message = value.messages[0]
    const from = message.from // Número de teléfono del usuario
    const messageText = message.text?.body?.trim() || ""

    console.log(`📱 Mensaje de ${from}: ${messageText}`)

    // 🎯 FASE 1: Detectar si es un token de invitación
    if (await isToken(messageText)) {
      await handleTokenRegistration(from, messageText)
      return NextResponse.json({ status: "token processed" })
    }

    // 🎯 FASE 2: Procesar carga de datos
    const parsedData = parseMessage(messageText, from)
    
    if (parsedData) {
      await handleDataEntry(parsedData)
      await sendWhatsAppMessage(from, "✅ Dato guardado correctamente en el sistema.")
      return NextResponse.json({ status: "data processed" })
    }

    // Mensaje no reconocido
    await sendWhatsAppMessage(
      from,
      "No entendí tu mensaje. Podés enviarme cosas como:\n\n" +
      "• nacieron 3 terneros en potrero norte\n" +
      "• murieron 2 vacas en lote sur\n" +
      "• llovieron 25mm\n" +
      "• gasté $5000 en alimento"
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("💥 Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * 🔍 Detectar si el mensaje es un token de invitación
 */
async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}

/**
 * 🎫 Manejar registro de empleado por token
 */
async function handleTokenRegistration(phone: string, token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitation) {
      await sendWhatsAppMessage(phone, "❌ Token inválido o expirado.")
      return
    }

    if (invitation.usedAt) {
      await sendWhatsAppMessage(phone, "❌ Este token ya fue utilizado.")
      return
    }

    if (invitation.expiresAt < new Date()) {
      await sendWhatsAppMessage(phone, "❌ Este token expiró.")
      return
    }

    // Solo EMPLEADO se registra por WhatsApp
    if (invitation.role !== "EMPLEADO") {
      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`
      await sendWhatsAppMessage(
        phone,
        `Hola! Para completar tu registro, ingresá acá:\n${registerLink}`
      )
      return
    }

    const existingUser = await prisma.user.findUnique({
      where: { telefono: phone },
    })

    if (existingUser) {
      await sendWhatsAppMessage(phone, "❌ Ya estás registrado con este número.")
      return
    }

    await sendWhatsAppMessage(
      phone,
      `¡Bienvenido a ${invitation.campo.nombre}! 🌾\n\n` +
      "Para completar tu registro, enviame tu nombre y apellido.\n" +
      "Ejemplo: Juan Pérez"
    )

    await prisma.pendingRegistration.upsert({
      where: { telefono: phone },
      create: { telefono: phone, token },
      update: { token },
    })

  } catch (error) {
    console.error("Error en registro:", error)
    await sendWhatsAppMessage(phone, "❌ Error al procesar el registro.")
  }
}

/**
 * 📝 Parsear mensaje simple (placeholder)
 */
function parseMessage(text: string, phone: string): any {
  // Por ahora retorna null, implementarás la lógica después
  return null
}

/**
 * 💾 Guardar dato (placeholder)
 */
async function handleDataEntry(data: any) {
  // Implementar después
}

/**
 * 📤 Enviar mensaje de WhatsApp
 */
async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando mensaje:", error)
    }
  } catch (error) {
    console.error("Error en sendWhatsAppMessage:", error)
  }
}