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

    // 🎯 1) Si el mensaje coincide con un token → manejar registro
    if (await isToken(messageText)) {
      await handleTokenRegistration(from, messageText)
      return NextResponse.json({ status: "token processed" })
    }

    // 🎯 2) Si tiene un registro pendiente → procesar nombre
    const pendiente = await prisma.pendingRegistration.findUnique({
      where: { telefono: from },
    })

    if (pendiente && messageText && !(await isToken(messageText))) {
      return await procesarNombrePendiente(from, messageText, pendiente.token)
    }

    // 🎯 3) Eventos (por ahora null)
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
 * 👤 Registrar empleado después de recibir nombre
 */
async function registrarEmpleadoBot(telefono: string, nombreCompleto: string, token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitation) {
      throw new Error("Invitación no encontrada")
    }

    // email temporal único
    const timestamp = Date.now()
    const email = `empleado_${timestamp}@botrural.temp`

    const nuevoUsuario = await prisma.user.create({
      data: {
        name: nombreCompleto,
        email: email,
        telefono: telefono,
        role: "EMPLEADO",
        campoId: invitation.campoId,
        accesoFinanzas: false,
      },
    })

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        usedAt: new Date(),
        usedById: nuevoUsuario.id,
      },
    })

    await prisma.pendingRegistration.delete({
      where: { telefono },
    }).catch(() => {})

    return {
      usuario: nuevoUsuario,
      campo: invitation.campo,
    }
  } catch (error) {
    console.error("Error en registrarEmpleadoBot:", error)
    throw error
  }
}

/**
 * 🧠 Procesar nombre enviado en registro pendiente
 */
async function procesarNombrePendiente(phone: string, messageText: string, token: string) {
  try {
    const partes = messageText.trim().split(" ")

    if (partes.length < 2) {
      await sendWhatsAppMessage(
        phone,
        "⚠️ Por favor envía tu nombre y apellido.\nEjemplo: Juan Pérez"
      )
      return NextResponse.json({ status: "nombre inválido" })
    }

    // Registrar empleado
    const resultado = await registrarEmpleadoBot(phone, messageText.trim(), token)

    await sendWhatsAppMessage(
      phone,
      `✅ ¡Bienvenido ${resultado.usuario.name}!\n\n` +
      `Ya estás registrado en *${resultado.campo.nombre}*.\n\n` +
      `Ahora podés enviarme datos del campo. Por ejemplo:\n` +
      `• nacieron 3 terneros en potrero norte\n` +
      `• llovieron 25mm\n` +
      `• gasté $5000 en alimento`
    )

    return NextResponse.json({ status: "registrado" })
  } catch (error) {
    console.error("Error procesando nombre:", error)
    await sendWhatsAppMessage(phone, "❌ Error al registrar el usuario.")
    return NextResponse.json({ status: "error" })
  }
}

/**
 * 🎫 Manejar registro inicial cuando recibe un token
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

    // COLABORADOR o CONTADOR → registro web
    if (invitation.role !== "EMPLEADO") {
      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`
      await sendWhatsAppMessage(
        phone,
        `Hola! Para completar tu registro, ingresá acá:\n${registerLink}`
      )
      return
    }

    // EMPLEADO → sigue por WhatsApp
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
    console.error("Error en handleTokenRegistration:", error)
    await sendWhatsAppMessage(phone, "❌ Error al procesar el registro.")
  }
}

/**
 * 📝 Parseo de mensajes (vacío por ahora)
 */
function parseMessage(text: string, phone: string): any {
  return null
}

/**
 * 💾 Guardar eventos (se implementará después)
 */
async function handleDataEntry(data: any) {
  return
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