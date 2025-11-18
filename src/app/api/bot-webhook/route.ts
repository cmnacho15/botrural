import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseMessageWithAI, transcribeAudio } from "@/lib/openai-parser"


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

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado")
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Verificación fallida" }, { status: 403 })
}

/**
 * POST - Recibir mensajes de WhatsApp
 */
export async function POST(request: Request) {
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

// ✨ NUEVO: Detectar tipo de mensaje
let messageText = ""

if (message.type === "text") {
  messageText = message.text?.body?.trim() || ""
} else if (message.type === "interactive") {
  // Usuario clickeó un botón
  const buttonReply = message.interactive?.button_reply
  if (buttonReply) {
    messageText = buttonReply.id // "btn_confirmar", "btn_editar", "btn_cancelar"
    console.log("🔘 Botón clickeado:", messageText)
  }
} else if (message.type === "audio") {
      // 🎤 Procesar audio
      const audioId = message.audio?.id
      
      if (!audioId) {
        await sendWhatsAppMessage(from, "❌ No pude procesar el audio. Intenta de nuevo.")
        return NextResponse.json({ status: "error" })
      }

      // Obtener URL del audio desde WhatsApp API
      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${audioId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
          }
        }
      )

      if (!mediaResponse.ok) {
        await sendWhatsAppMessage(from, "❌ Error obteniendo el audio.")
        return NextResponse.json({ status: "error" })
      }

      const mediaData = await mediaResponse.json()
      const audioUrl = mediaData.url

      // Transcribir audio
      await sendWhatsAppMessage(from, "🎤 Procesando audio...")
      
      const transcription = await transcribeAudio(audioUrl)
      
      if (!transcription) {
        await sendWhatsAppMessage(from, "❌ No pude entender el audio. Intenta de nuevo.")
        return NextResponse.json({ status: "error" })
      }

      messageText = transcription
      console.log(`🎤 Audio transcrito de ${from}: ${messageText}`)
    } else {
      // Tipo de mensaje no soportado
      await sendWhatsAppMessage(
        from, 
        "Por ahora solo acepto mensajes de texto y audio. Las imágenes llegarán pronto! 📷"
      )
      return NextResponse.json({ status: "unsupported type" })
    }

    console.log(`📱 Mensaje de ${from}: ${messageText}`)

    // 🎯 FASE 1: Detectar si es un token de invitación
    if (await isToken(messageText)) {
      await handleTokenRegistration(from, messageText)
      return NextResponse.json({ status: "token processed" })
    }

    // 🎯 FASE 1.5: Si tiene registro pendiente, procesar nombre
    const pendiente = await prisma.pendingRegistration.findUnique({
      where: { telefono: from },
    })

    if (pendiente) {
      await handleNombreRegistro(from, messageText, pendiente.token)
      return NextResponse.json({ status: "nombre processed" })
    }

    // 🎯 FASE 2: Verificar si hay una confirmación pendiente
    const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
      where: { telefono: from },
    })

    if (confirmacionPendiente) {
      await handleConfirmacion(from, messageText, confirmacionPendiente)
      return NextResponse.json({ status: "confirmacion processed" })
    }

    // 🎯 FASE 3: Procesar con GPT
    const parsedData = await parseMessageWithAI(messageText, from)
    
    if (parsedData) {
      await solicitarConfirmacion(from, parsedData)
      return NextResponse.json({ status: "awaiting confirmation" })
    }

    // Mensaje no reconocido
    await sendWhatsAppMessage(
      from,
      "No entendí tu mensaje. Podés enviarme cosas como:\n\n" +
      "• nacieron 3 terneros en potrero norte\n" +
      "• murieron 2 vacas en lote sur\n" +
      "• llovieron 25mm\n" +
      "• gasté $5000 en alimento\n\n" +
      "También podés enviarme un *audio* 🎤"
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("💥 Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * 🔍 Detectar si el mensaje es un token
 */
async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}

/**
 * 🎫 Manejar registro por token
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

    // COLABORADOR → Guardar teléfono y enviar link web
if (invitation.role === "COLABORADOR") {
  const existingUser = await prisma.user.findUnique({
    where: { telefono: phone },
  })

  if (existingUser) {
    await sendWhatsAppMessage(phone, "❌ Ya estás registrado con este número.")
    return
  }

  // Guardar teléfono temporalmente
  await prisma.pendingRegistration.upsert({
    where: { telefono: phone },
    create: { telefono: phone, token },
    update: { token },
  })

  const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
  const registerLink = `${webUrl}/register?token=${token}`
  
  await sendWhatsAppMessage(
    phone,
    `¡Hola! 👋\n\n` +
    `Bienvenido a *${invitation.campo.nombre}*\n\n` +
    `Para completar tu registro como *Colaborador*, ingresá acá:\n` +
    `🔗 ${registerLink}\n\n` +
    `Una vez registrado, podrás cargar datos desde WhatsApp también! 📱`
  )
  return
}

// CONTADOR → Solo web
if (invitation.role === "CONTADOR") {
  const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
  const registerLink = `${webUrl}/register?token=${token}`
  await sendWhatsAppMessage(
    phone,
    `Hola! Para completar tu registro como Contador, ingresá acá:\n${registerLink}`
  )
  return
}

// EMPLEADO → Flujo por WhatsApp (ya existe)
if (invitation.role === "EMPLEADO") {
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
}

  } catch (error) {
    console.error("Error en registro:", error)
    await sendWhatsAppMessage(phone, "❌ Error al procesar el registro.")
  }
}

/**
 * 👤 Manejar nombre del empleado
 */
async function handleNombreRegistro(phone: string, nombreCompleto: string, token: string) {
  try {
    const partes = nombreCompleto.trim().split(" ")
    
    if (partes.length < 2) {
      await sendWhatsAppMessage(
        phone,
        "⚠️ Por favor envía tu nombre y apellido completos.\nEjemplo: Juan Pérez"
      )
      return
    }

    const resultado = await registrarEmpleadoBot(phone, nombreCompleto.trim(), token)

    await sendWhatsAppMessage(
      phone,
      `✅ ¡Bienvenido ${resultado.usuario.name}!\n\n` +
      `Ya estás registrado en *${resultado.campo.nombre}*.\n\n` +
      `Ahora podés enviarme datos del campo. Por ejemplo:\n` +
      `• nacieron 3 terneros en potrero norte\n` +
      `• llovieron 25mm\n` +
      `• gasté $5000 en alimento`
    )
  } catch (error) {
    console.error("Error procesando nombre:", error)
    await sendWhatsAppMessage(phone, "❌ Error al procesar el registro.")
  }
}

/**
 * 📝 Registrar empleado en la BD
 */
async function registrarEmpleadoBot(telefono: string, nombreCompleto: string, token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { campo: true },
  })

  if (!invitation) {
    throw new Error("Invitación no encontrada")
  }

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
}

/**
 * 📝 Parsear mensaje con regex mejorado
 */
function parseMessage(text: string, phone: string): any {
  const textLower = text.toLowerCase()

  // 🌧️ LLUVIA - Mejorado
  if (textLower.includes("lluv") || textLower.match(/\d+\s*mm/)) {
    const match = text.match(/(\d+)\s*mm/i)
    
    if (match) {
      return {
        tipo: "LLUVIA",
        cantidad: parseInt(match[1]),
        telefono: phone,
        descripcion: `Llovieron ${match[1]}mm`,
      }
    }
  }

  // 🐄 NACIMIENTO
  if (textLower.includes("nacieron") || textLower.includes("nació") || textLower.includes("nacimiento")) {
    const match = text.match(/(\d+)\s*(ternero|ternera|vaca|toro|novillo|vaquillona)/i)
    const loteMatch = text.match(/(?:en|potrero|lote)\s+(\w+)/i)
    
    if (match) {
      return {
        tipo: "NACIMIENTO",
        cantidad: parseInt(match[1]),
        categoria: match[2],
        lote: loteMatch?.[1] || null,
        telefono: phone,
        descripcion: `Nacieron ${match[1]} ${match[2]}${loteMatch ? ` en ${loteMatch[1]}` : ''}`,
      }
    }
  }

  // 💀 MORTANDAD
  if (textLower.includes("murieron") || textLower.includes("murió") || textLower.includes("muerto") || textLower.includes("mortandad")) {
    const match = text.match(/(\d+)\s*(ternero|ternera|vaca|toro|novillo|vaquillona|animal)/i)
    const loteMatch = text.match(/(?:en|potrero|lote)\s+(\w+)/i)
    
    if (match) {
      return {
        tipo: "MORTANDAD",
        cantidad: parseInt(match[1]),
        categoria: match[2],
        lote: loteMatch?.[1] || null,
        telefono: phone,
        descripcion: `Murieron ${match[1]} ${match[2]}${loteMatch ? ` en ${loteMatch[1]}` : ''}`,
      }
    }
  }

  // 💰 GASTO
  if (textLower.includes("gast") || textLower.includes("compré") || textLower.includes("pagué")) {
    const match = text.match(/\$?\s*(\d+)/i)
    const descripcionMatch = text.match(/(?:en|de|para)\s+(.+)/i)
    
    if (match) {
      return {
        tipo: "GASTO",
        monto: parseInt(match[1]),
        descripcion: descripcionMatch?.[1] || "Gasto registrado",
        telefono: phone,
      }
    }
  }

  // 💉 TRATAMIENTO
  if (textLower.includes("tratamiento") || textLower.includes("vacun") || textLower.includes("inyect") || textLower.includes("apliqué")) {
    const cantidadMatch = text.match(/(\d+)\s*(vaca|ternero|animal|cabeza)/i)
    const productoMatch = text.match(/(?:con|de)\s+(\w+)/i)
    const loteMatch = text.match(/(?:en|potrero|lote)\s+(\w+)/i)
    
    if (cantidadMatch) {
      return {
        tipo: "TRATAMIENTO",
        cantidad: parseInt(cantidadMatch[1]),
        producto: productoMatch?.[1] || "Sin especificar",
        lote: loteMatch?.[1] || null,
        telefono: phone,
        descripcion: `Tratamiento a ${cantidadMatch[1]} ${cantidadMatch[2]} con ${productoMatch?.[1] || 'producto'}`,
      }
    }
  }

  // 🌾 SIEMBRA
  if (textLower.includes("sembr") || textLower.includes("plant")) {
    const cantidadMatch = text.match(/(\d+)\s*(hectárea|ha|hectarea)/i)
    const cultivoMatch = text.match(/(?:de|siembra|planté)\s+(\w+)/i)
    const loteMatch = text.match(/(?:en|potrero|lote)\s+(\w+)/i)
    
    if (cantidadMatch || cultivoMatch) {
      return {
        tipo: "SIEMBRA",
        cantidad: cantidadMatch ? parseInt(cantidadMatch[1]) : null,
        cultivo: cultivoMatch?.[1] || "Sin especificar",
        lote: loteMatch?.[1] || null,
        telefono: phone,
        descripcion: `Siembra${cantidadMatch ? ` de ${cantidadMatch[1]}ha` : ''}${cultivoMatch ? ` de ${cultivoMatch[1]}` : ''}`,
      }
    }
  }

  return null
}

/**
 * 🤔 Solicitar confirmación al usuario
 */
async function solicitarConfirmacion(phone: string, data: any) {
  let mensaje = "*Entendí:*\n\n"

  switch (data.tipo) {
    case "LLUVIA":
      mensaje += `🌧️ *Lluvia*\n• Cantidad: ${data.cantidad}mm`
      break
    case "NACIMIENTO":
      mensaje += `🐄 *Nacimiento*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "MORTANDAD":
      mensaje += `💀 *Mortandad*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "GASTO":
      mensaje += `💰 *Gasto*\n• Monto: $${data.monto}\n• Concepto: ${data.descripcion}\n• Categoría: ${data.categoria}`
      
      // 🆕 Mostrar info de pago
      if (data.proveedor) {
        mensaje += `\n• Proveedor: ${data.proveedor}`
      }
      
      if (data.metodoPago === "Plazo") {
        mensaje += `\n• Pago: A plazo (${data.diasPlazo} días)`
        mensaje += `\n• Estado: ${data.pagado ? '✅ Pagado' : '⏳ Pendiente'}`
      } else {
        mensaje += `\n• Pago: Contado ✅`
      }
      break
    case "TRATAMIENTO":
      mensaje += `💉 *Tratamiento*\n• Cantidad: ${data.cantidad}\n• Producto: ${data.producto}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "SIEMBRA":
      mensaje += `🌾 *Siembra*`
      if (data.cantidad) mensaje += `\n• Hectáreas: ${data.cantidad}`
      mensaje += `\n• Cultivo: ${data.cultivo}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
  }

  await prisma.pendingConfirmation.create({
    data: {
      telefono: phone,
      data: JSON.stringify(data),
    },
  })

  await sendWhatsAppMessageWithButtons(phone, mensaje)
}

/**
 * ✅ Manejar confirmación del usuario
 */
async function handleConfirmacion(phone: string, respuesta: string, confirmacion: any) {
  const respuestaLower = respuesta.toLowerCase().trim()

  // ✅ CONFIRMAR
  if (
    respuestaLower === "confirmar" || 
    respuestaLower === "si" || 
    respuestaLower === "sí" || 
    respuestaLower === "yes" ||
    respuesta.includes("btn_confirmar")
  ) {
    try {
      const data = JSON.parse(confirmacion.data)
      await handleDataEntry(data)
      
      await sendWhatsAppMessage(phone, "✅ *Dato guardado correctamente* en el sistema.")
    } catch (error) {
      console.error("Error guardando dato:", error)
      await sendWhatsAppMessage(phone, "❌ Error al guardar el dato. Intenta de nuevo.")
    }
    
    await prisma.pendingConfirmation.delete({
      where: { telefono: phone },
    }).catch(() => {})
    
    return
  }

  // ✏️ EDITAR
  if (
    respuestaLower === "editar" || 
    respuestaLower === "modificar" ||
    respuesta.includes("btn_editar")
  ) {
    await sendWhatsAppMessage(
      phone, 
      "✏️ Ok, enviame los datos corregidos.\n\nEjemplo:\n• llovieron 30mm\n• nacieron 5 terneros"
    )
    
    await prisma.pendingConfirmation.delete({
      where: { telefono: phone },
    }).catch(() => {})
    
    return
  }

  // ❌ CANCELAR
  if (
    respuestaLower === "cancelar" || 
    respuestaLower === "no" ||
    respuesta.includes("btn_cancelar")
  ) {
    await sendWhatsAppMessage(phone, "❌ Dato cancelado. Podés enviar uno nuevo cuando quieras.")
    
    await prisma.pendingConfirmation.delete({
      where: { telefono: phone },
    }).catch(() => {})
    
    return
  }

  await sendWhatsAppMessage(
    phone, 
    "Por favor selecciona una opción:\n• *Confirmar* - para guardar\n• *Editar* - para corregir\n• *Cancelar* - para descartar"
  )
}

/**
 * 💾 Guardar dato en la BD
 */
async function handleDataEntry(data: any) {
  const user = await prisma.user.findUnique({
    where: { telefono: data.telefono },
    select: { id: true, campoId: true },
  })

  if (!user || !user.campoId) {
    throw new Error("Usuario no encontrado")
  }

  let loteId = null
  if (data.lote) {
    const lote = await prisma.lote.findFirst({
      where: {
        campoId: user.campoId,
        nombre: { contains: data.lote, mode: "insensitive" },
      },
      select: { id: true },
    })
    loteId = lote?.id || null
  }

  if (data.tipo === "GASTO") {
    // 💰 GASTO con soporte para pagos a plazo
    await prisma.gasto.create({
      data: {
        tipo: "GASTO",
        monto: data.monto,
        fecha: new Date(),
        descripcion: data.descripcion,
        categoria: data.categoria || "Otros",  // 👈 CAMBIO 1: usa la categoría de la IA
        campoId: user.campoId,
        // 🆕 NUEVOS CAMPOS
        metodoPago: data.metodoPago || "Contado",  // 👈 CAMBIO 2
        diasPlazo: data.diasPlazo || null,         // 👈 CAMBIO 3
        pagado: data.pagado !== undefined ? data.pagado : true,  // 👈 CAMBIO 4
        proveedor: data.proveedor || null,         // 👈 CAMBIO 5
      },
    })
  } else if (data.tipo === "LLUVIA") {
    await prisma.evento.create({
      data: {
        tipo: "LLUVIA",
        descripcion: data.descripcion,
        fecha: new Date(),
        cantidad: data.cantidad,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })
  } else {
    await prisma.evento.create({
      data: {
        tipo: data.tipo,
        descripcion: data.descripcion || `${data.tipo} registrado`,
        fecha: new Date(),
        cantidad: data.cantidad || null,
        categoria: data.categoria || null,
        loteId,
        usuarioId: user.id,
        campoId: user.campoId,
      },
    })
  }

  console.log(`✅ Dato guardado: ${data.tipo}`)
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
  /**
 * 📤 Enviar mensaje con botones interactivos
 */
async function sendWhatsAppMessageWithButtons(to: string, bodyText: string) {
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
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "btn_confirmar",
                    title: "✅ Confirmar"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_editar",
                    title: "✏️ Editar"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_cancelar",
                    title: "❌ Cancelar"
                  }
                }
              ]
            }
          }
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando botones:", error)
      
      await sendWhatsAppMessage(to, bodyText + "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*")
    }
  } catch (error) {
    console.error("Error en sendWhatsAppMessageWithButtons:", error)
    
    await sendWhatsAppMessage(to, bodyText + "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*")
  }
}
