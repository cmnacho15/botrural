import { NextResponse } from "next/server"
import { getUSDToUYU } from "@/lib/currency"
import { prisma } from "@/lib/prisma"
import { parseMessageWithAI, transcribeAudio } from "@/lib/openai-parser"
import { processInvoiceImage } from "@/lib/vision-parser"
import {
  downloadWhatsAppImage,
  uploadInvoiceToSupabase,
} from "@/lib/supabase-storage"
import crypto from "crypto"

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "mi_token_secreto"
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID
// NUEVA LÍNEA
const FLOW_GASTO_ID = process.env.FLOW_GASTO_ID

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

    // NUEVO: Procesar IMÁGENES (facturas)
    if (messageType === "image") {
      await handleImageMessage(message, from)
      return NextResponse.json({ status: "image processed" })
    }

    // ✨ Detectar tipo de mensaje (texto, audio, botones)
    let messageText = ""

    if (messageType === "text") {
      messageText = message.text?.body?.trim() || ""
    } else if (messageType === "interactive") {
      // Usuario clickeó un botón
      const buttonReply = message.interactive?.button_reply
      if (buttonReply) {
        messageText = buttonReply.id // "btn_confirmar", "invoice_confirm", etc.
        console.log("Botón clickeado:", messageText)

        // Manejar botones de FACTURA por separado
        if (messageText.startsWith("invoice_")) {
          await handleInvoiceButtonResponse(from, messageText)
          return NextResponse.json({ status: "invoice button processed" })
        }
      }
    } else if (messageType === "audio") {
      // Procesar audio
      const audioId = message.audio?.id

      if (!audioId) {
        await sendWhatsAppMessage(from, "No pude procesar el audio. Intenta de nuevo.")
        return NextResponse.json({ status: "error" })
      }

      // Obtener URL del audio desde WhatsApp API
      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${audioId}`,
        {
          headers: {
            "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        }
      )

      if (!mediaResponse.ok) {
        await sendWhatsAppMessage(from, "Error obteniendo el audio.")
        return NextResponse.json({ status: "error" })
      }

      const mediaData = await mediaResponse.json()
      const audioUrl = mediaData.url

      // Transcribir audio
      await sendWhatsAppMessage(from, "Procesando audio...")

      const transcription = await transcribeAudio(audioUrl)

      if (!transcription) {
        await sendWhatsAppMessage(from, "No pude entender el audio. Intenta de nuevo.")
        return NextResponse.json({ status: "error" })
      }

      messageText = transcription
      console.log(`Audio transcrito de ${from}: ${messageText}`)
    } else {
      // Tipo de mensaje no soportado
      await sendWhatsAppMessage(
        from,
        "Por ahora solo acepto mensajes de texto, audio e imágenes de facturas"
      )
      return NextResponse.json({ status: "unsupported type" })
    }

    console.log(`Mensaje de ${from}: ${messageText}`)

    // FASE 1: Detectar si es un token de invitación
    if (await isToken(messageText)) {
      await handleTokenRegistration(from, messageText)
      return NextResponse.json({ status: "token processed" })
    }

    // FASE 1.5: Si tiene registro pendiente, procesar nombre
    const pendiente = await prisma.pendingRegistration.findUnique({
      where: { telefono: from },
    })

    if (pendiente) {
      await handleNombreRegistro(from, messageText, pendiente.token)
      return NextResponse.json({ status: "nombre processed" })
    }

    // FASE 2: Verificar si hay una confirmación pendiente (TEXTO/AUDIO)
    const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
      where: { telefono: from },
    })

    if (confirmacionPendiente) {
      await handleConfirmacion(from, messageText, confirmacionPendiente)
      return NextResponse.json({ status: "confirmacion processed" })
    }

    // FASE 3: Procesar con GPT (texto/audio)
    const parsedData = await parseMessageWithAI(messageText, from)

    if (parsedData) {
      // DECIDIR: Flow para GASTOS, botones para el resto
      if (parsedData.tipo === "GASTO") {
        await solicitarConfirmacionConFlow(from, parsedData)
      } else {
        await solicitarConfirmacion(from, parsedData)
      }
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
        "También podés enviarme un *audio* o una *foto de factura*"
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/* ===============================
   FLOW PARA GASTOS
   =============================== */

/**
 * Solicitar confirmación con Flow (solo para GASTOS)
 */
async function solicitarConfirmacionConFlow(phone: string, data: any) {
  try {
    // Si no está configurado el Flow, usar botones tradicionales
    if (!FLOW_GASTO_ID) {
      console.log("Flow no configurado, usando botones")
      await solicitarConfirmacion(phone, data)
      return
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

    // Guardar datos del gasto en pendingConfirmation
    await prisma.pendingConfirmation.upsert({
      where: { telefono: phone },
      create: {
        telefono: phone,
        data: JSON.stringify({
          tipo: "GASTO_FLOW",
          flowToken,
          gastoData: data
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "GASTO_FLOW",
          flowToken,
          gastoData: data
        })
      }
    })

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Gasto Detectado"
            },
            body: {
              text: `Entendí este gasto:\n\n` +
                    `• ${data.descripcion}\n` +
                    `• Monto: $${data.monto}\n` +
                    `• Categoría: ${data.categoria}\n\n` +
                    `Tocá "Ver menú" para revisar y completar:`
            },
            footer: {
              text: "FieldData"
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: flowToken,
                flow_id: FLOW_GASTO_ID,
                flow_cta: "Ver menú",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "EDIT_INVOICE",
                  data: {
                    phone_number: phone,
                    proveedor: data.proveedor || "",
                    fecha: new Date().toISOString().split('T')[0],
                    moneda: "UYU",
                    item_nombre: data.descripcion || "",
                    item_categoria: data.categoria || "Otros",
                    item_precio: data.monto?.toString() || "0",
                    item_iva: "0"
                  }
                }
              }
            }
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando Flow:", error)
      
      // Fallback a botones si falla
      await solicitarConfirmacion(phone, data)
      return
    }

    console.log("Flow de gasto enviado")

  } catch (error) {
    console.error("Error en solicitarConfirmacionConFlow:", error)
    // Fallback a botones si hay error
    await solicitarConfirmacion(phone, data)
  }
}

/* ===============================
   🧾 FACTURAS POR IMAGEN
   =============================== */

/**
 * Handler para IMÁGENES DE FACTURAS
 */
async function handleImageMessage(message: any, phoneNumber: string) {
  try {
    const mediaId = message.image.id
    const caption = message.image.caption || ""

    // Buscar usuario y campo asociado
    const user = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      include: { campo: true },
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No encontré tu cuenta asociada. Registrate primero."
      )
      return
    }

    // Mensaje de procesamiento
    await sendWhatsAppMessage(
      phoneNumber,
      "Procesando factura... un momento"
    )

    // 1️⃣ Descargar imagen de WhatsApp
    const imageData = await downloadWhatsAppImage(mediaId)
    if (!imageData) {
      await sendWhatsAppMessage(
        phoneNumber,
        "Error descargando la imagen. Intenta de nuevo."
      )
      return
    }

    // 2️⃣ Subir a Supabase Storage (para tener URL permanente)
    const uploadResult = await uploadInvoiceToSupabase(
      imageData.buffer,
      imageData.mimeType,
      user.campoId
    )

    if (!uploadResult) {
      await sendWhatsAppMessage(phoneNumber, "Error guardando la imagen.")
      return
    }

    // 3️⃣ Procesar con Vision API
    const invoiceData = await processInvoiceImage(uploadResult.url)

    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No pude leer la factura. ¿La imagen está clara?\n\nProbá con mejor iluminación o más cerca."
      )
      return
    }

    // 4️⃣ Guardar SOLO en pendingConfirmation (NO guardar gastos todavía)
    const invoiceConfirmationData = {
      tipo: "INVOICE", // marcador especial
      invoiceData,
      imageUrl: uploadResult.url,
      imageName: uploadResult.fileName,
      campoId: user.campoId,
      telefono: phoneNumber,
      caption,
    }

    await prisma.pendingConfirmation.create({
      data: {
        telefono: phoneNumber,
        data: JSON.stringify(invoiceConfirmationData),
      },
    })

    // 5️⃣ Enviar Flow en lugar de botones
    await sendInvoiceFlowMessage(phoneNumber, invoiceData)
  } catch (error) {
    console.error("Error en handleImageMessage:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Ocurrió un error procesando tu factura. Intenta nuevamente."
    )
  }
}

/**
 * Enviar Flow para editar factura
 */
async function sendInvoiceFlowMessage(
  phoneNumber: string,
  invoiceData: any
) {
  try {
    // Si no está configurado el Flow, usar botones tradicionales
    if (!FLOW_GASTO_ID) {
      console.error("FLOW_GASTO_ID no configurado")
      await sendInvoiceConfirmation(phoneNumber, invoiceData)
      return false
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

    // Actualizar pendingConfirmation con el token del Flow
    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify({
          tipo: "INVOICE_FLOW",
          flowToken,
          invoiceData
        })
      },
      update: {
        data: JSON.stringify({
          tipo: "INVOICE_FLOW",
          flowToken,
          invoiceData
        })
      }
    })

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber,
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Factura Procesada"
            },
            body: {
              text: `Detecté estos datos:\n\n` +
                    `• Proveedor: ${invoiceData.proveedor || 'N/A'}\n` +
                    `• Fecha: ${invoiceData.fecha}\n` +
                    `• Total: $${invoiceData.montoTotal?.toFixed(2) || '0.00'}\n\n` +
                    `Tocá "Ver menú" para revisar y editar:`
            },
            footer: {
              text: "FieldData"
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: flowToken,
                flow_id: FLOW_GASTO_ID,
                flow_cta: "Ver menú",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "EDIT_INVOICE",
                  data: {
                    phone_number: phoneNumber,
                    proveedor: invoiceData.proveedor || "",
                    fecha: invoiceData.fecha || new Date().toISOString().split('T')[0],
                    moneda: invoiceData.moneda || "UYU",
                    item_nombre: invoiceData.items?.[0]?.descripcion || "",
                    item_categoria: invoiceData.items?.[0]?.categoria || "Otros",
                    item_precio: invoiceData.items?.[0]?.precioSinIva?.toString() || "0",
                    item_iva: invoiceData.items?.[0]?.iva?.toString() || "0"
                  }
                }
              }
            }
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando Flow:", error)
      
      // Fallback a botones tradicionales
      await sendInvoiceConfirmation(phoneNumber, invoiceData)
      return false
    }

    console.log("Flow enviado correctamente")
    return true

  } catch (error) {
    console.error("Error en sendInvoiceFlowMessage:", error)
    await sendInvoiceConfirmation(phoneNumber, invoiceData)
    return false
  }
}

/**
 * Manejar respuestas de botones de FACTURA
 * IDs: "invoice_confirm", "invoice_edit", "invoice_cancel"
 */
async function handleInvoiceButtonResponse(
  phoneNumber: string,
  buttonId: string
) {
  try {
    const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
      where: { telefono: phoneNumber },
    })

    if (!confirmacionPendiente) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No hay ninguna factura pendiente de confirmación."
      )
      return
    }

    const savedData = JSON.parse(confirmacionPendiente.data)

    if (savedData.tipo !== "INVOICE") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Error: esta confirmación no corresponde a una factura."
      )
      return
    }

    const action = buttonId.replace("invoice_", "") // confirm | edit | cancel

    // ============================
    // CONFIRMAR FACTURA
    // ============================
    if (action === "confirm") {
      const { invoiceData, imageUrl, imageName, campoId } = savedData

      const monedaFactura = invoiceData.moneda === "USD" ? "USD" : "UYU"

      let tasaCambio = null

      if (monedaFactura === "USD") {
        try {
          tasaCambio = await getUSDToUYU()
        } catch (err) {
          console.log("Error obteniendo dólar → uso 40")
          tasaCambio = 40
        }
      }

      // Guardar cada ítem como gasto
for (const item of invoiceData.items) {
  const montoOriginal = item.precioFinal
  const montoEnUYU =
    monedaFactura === "USD" ? montoOriginal * tasaCambio : montoOriginal
  
  // ✅ Calcular montoEnUSD
  const montoEnUSD =
    monedaFactura === "USD" 
      ? montoOriginal 
      : montoOriginal / (tasaCambio || 40)

  await prisma.gasto.create({
    data: {
      tipo: invoiceData.tipo,
      fecha: new Date(invoiceData.fecha),
      descripcion: item.descripcion,
      categoria: item.categoria,
      proveedor: invoiceData.proveedor,
      metodoPago: invoiceData.metodoPago,
      pagado: invoiceData.pagado,
      diasPlazo: invoiceData.diasPlazo || null,
      iva: item.iva,
      campoId,
      imageUrl,
      imageName,

      // campos de moneda
      moneda: monedaFactura,
      montoOriginal,
      tasaCambio,
      montoEnUYU,
      montoEnUSD,  // ✅ AGREGAR
      
      // asignación de especie
      especie: null,  // ✅ AGREGAR (el bot no asigna especie)

      // compatibilidad
      monto: montoEnUYU,
    },
  })
}

      await sendWhatsAppMessage(
        phoneNumber,
        "¡Factura confirmada y guardada correctamente!"
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })

      return
    }

    // ============================
    // CANCELAR FACTURA
    // ============================
    if (action === "cancel") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Factura cancelada. No se guardó nada."
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }

    // ============================
    // EDITAR FACTURA
    // ============================
    if (action === "edit") {
      await sendWhatsAppMessage(
        phoneNumber,
        "Ok, enviame los datos corregidos o reenviá otra foto."
      )

      await prisma.pendingConfirmation.delete({
        where: { telefono: phoneNumber },
      })
      return
    }
  } catch (error) {
    console.error("Error en handleInvoiceButtonResponse:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Error procesando tu respuesta."
    )
  }
}

/**
 * Enviar resumen de factura con botones (usa ids invoice_*)
 */
async function sendInvoiceConfirmation(phoneNumber: string, data: any) {
  const itemsList = data.items
    .map(
      (item: any, i: number) =>
        `${i + 1}. ${item.descripcion} - $${item.precioFinal.toFixed(
          2
        )} (${item.categoria})`
    )
    .join("\n")

  const bodyText =
    `*Factura procesada:*\n\n` +
    `Proveedor: ${data.proveedor}\n` +
    `Fecha: ${data.fecha}\n` +
    `Total: $${data.montoTotal.toFixed(2)}\n` +
    `Pago: ${data.metodoPago}${
      data.diasPlazo ? ` (${data.diasPlazo} días)` : ""
    }\n\n` +
    `*Ítems:*\n${itemsList}\n\n` +
    `¿Todo correcto?`

  await sendCustomButtons(phoneNumber, bodyText, [
    { id: "invoice_confirm", title: "Confirmar" },
    { id: "invoice_edit", title: "Editar" },
    { id: "invoice_cancel", title: "Cancelar" },
  ])
}

/* ===============================
   INVITACIONES / REGISTRO
   =============================== */

/**
 * Detectar si el mensaje es un token
 */
async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}

/**
 * Manejar registro por token
 */
async function handleTokenRegistration(phone: string, token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitation) {
      await sendWhatsAppMessage(phone, "Token inválido o expirado.")
      return
    }

    if (invitation.usedAt) {
      await sendWhatsAppMessage(phone, "Este token ya fue utilizado.")
      return
    }

    if (invitation.expiresAt < new Date()) {
      await sendWhatsAppMessage(phone, "Este token expiró.")
      return
    }

    // COLABORADOR → Guardar teléfono y enviar link web
    if (invitation.role === "COLABORADOR") {
      const existingUser = await prisma.user.findUnique({
        where: { telefono: phone },
      })

      if (existingUser) {
        await sendWhatsAppMessage(
          phone,
          "Ya estás registrado con este número."
        )
        return
      }

      await prisma.pendingRegistration.upsert({
        where: { telefono: phone },
        create: { telefono: phone, token },
        update: { token },
      })

      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`

      await sendWhatsAppMessage(
        phone,
        `¡Hola!\n\n` +
          `Bienvenido a *${invitation.campo.nombre}*\n\n` +
          `Para completar tu registro como *Colaborador*, ingresá acá:\n` +
          `${registerLink}\n\n` +
          `Una vez registrado, podrás cargar datos desde WhatsApp también!`
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

    // EMPLEADO → Flujo por WhatsApp
    if (invitation.role === "EMPLEADO") {
      const existingUser = await prisma.user.findUnique({
        where: { telefono: phone },
      })

      if (existingUser) {
        await sendWhatsAppMessage(
          phone,
          "Ya estás registrado con este número."
        )
        return
      }

      await sendWhatsAppMessage(
        phone,
        `¡Bienvenido a ${invitation.campo.nombre}!\n\n` +
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
    await sendWhatsAppMessage(phone, "Error al procesar el registro.")
  }
}

/**
 * Manejar nombre del empleado
 */
async function handleNombreRegistro(
  phone: string,
  nombreCompleto: string,
  token: string
) {
  try {
    const partes = nombreCompleto.trim().split(" ")

    if (partes.length < 2) {
      await sendWhatsAppMessage(
        phone,
        "Por favor envía tu nombre y apellido completos.\nEjemplo: Juan Pérez"
      )
      return
    }

    const resultado = await registrarEmpleadoBot(
      phone,
      nombreCompleto.trim(),
      token
    )

    await sendWhatsAppMessage(
      phone,
      `¡Bienvenido ${resultado.usuario.name}!\n\n` +
        `Ya estás registrado en *${resultado.campo.nombre}*.\n\n` +
        `Ahora podés enviarme datos del campo. Por ejemplo:\n` +
        `• nacieron 3 terneros en potrero norte\n` +
        `• llovieron 25mm\n` +
        `• gasté $5000 en alimento\n` +
        `• foto de factura`
    )
  } catch (error) {
    console.error("Error procesando nombre:", error)
    await sendWhatsAppMessage(phone, "Error al procesar el registro.")
  }
}

/**
 * Registrar empleado en la BD
 */
async function registrarEmpleadoBot(
  telefono: string,
  nombreCompleto: string,
  token: string
) {
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
      email,
      telefono,
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

  await prisma.pendingRegistration
    .delete({
      where: { telefono },
    })
    .catch(() => {})

  return {
    usuario: nuevoUsuario,
    campo: invitation.campo,
  }
}

/* ===============================
   CONFIRMACIÓN TEXTO / AUDIO
   =============================== */

/**
 * Solicitar confirmación al usuario (para texto/audio)
 */
async function solicitarConfirmacion(phone: string, data: any) {
  let mensaje = "*Entendí:*\n\n"

  switch (data.tipo) {
    case "LLUVIA":
      mensaje += `*Lluvia*\n• Cantidad: ${data.cantidad}mm`
      break
    case "NACIMIENTO":
      mensaje += `*Nacimiento*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "MORTANDAD":
      mensaje += `*Mortandad*\n• Cantidad: ${data.cantidad} ${data.categoria}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "GASTO":
      mensaje += `*Gasto*\n• Monto: $${data.monto}\n• Concepto: ${data.descripcion}\n• Categoría: ${data.categoria}`

      if (data.proveedor) {
        mensaje += `\n• Proveedor: ${data.proveedor}`
      }

      if (data.metodoPago === "Plazo") {
        mensaje += `\n• Pago: A plazo (${data.diasPlazo} días)`
        mensaje += `\n• Estado: ${
          data.pagado ? "Pagado" : "Pendiente"
        }`
      } else {
        mensaje += `\n• Pago: Contado`
      }
      break
    case "TRATAMIENTO":
      mensaje += `*Tratamiento*\n• Cantidad: ${data.cantidad}\n• Producto: ${data.producto}`
      if (data.lote) mensaje += `\n• Potrero: ${data.lote}`
      break
    case "SIEMBRA":
      mensaje += `*Siembra*`
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
 * Manejar confirmación del usuario (SOLO texto/audio, NO facturas)
 */
async function handleConfirmacion(
  phone: string,
  respuesta: string,
  confirmacion: any
) {
  const respuestaLower = respuesta.toLowerCase().trim()

  const data = JSON.parse(confirmacion.data)

  // Si es una factura, no se maneja acá
  if (data.tipo === "INVOICE") {
    await sendWhatsAppMessage(
      phone,
      "Para la factura usá los botones de confirmación que te envié."
    )
    return
  }

  // CONFIRMAR
  if (
    respuestaLower === "confirmar" ||
    respuestaLower === "si" ||
    respuestaLower === "sí" ||
    respuestaLower === "yes" ||
    respuesta === "btn_confirmar"
  ) {
    try {
      await handleDataEntry(data)
      await sendWhatsAppMessage(
        phone,
        "*Dato guardado correctamente* en el sistema."
      )
    } catch (error) {
      console.error("Error guardando dato:", error)
      await sendWhatsAppMessage(
        phone,
        "Error al guardar el dato. Intenta de nuevo."
      )
    }

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  // EDITAR
  if (
    respuestaLower === "editar" ||
    respuestaLower === "modificar" ||
    respuesta === "btn_editar"
  ) {
    await sendWhatsAppMessage(
      phone,
      "Ok, enviame los datos corregidos.\n\nEjemplo:\n• llovieron 30mm\n• nacieron 5 terneros"
    )

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  // CANCELAR
  if (
    respuestaLower === "cancelar" ||
    respuestaLower === "no" ||
    respuesta === "btn_cancelar"
  ) {
    await sendWhatsAppMessage(
      phone,
      "Dato cancelado. Podés enviar uno nuevo cuando quieras."
    )

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

  await sendWhatsAppMessage(
    phone,
    "Por favor selecciona una opción:\n• *Confirmar* - para guardar\n• *Editar* - para corregir\n• *Cancelar* - para descartar"
  )
}

/**
 * Guardar dato en la BD (texto/audio)
 */
async function handleDataEntry(data: any) {
  const user = await prisma.user.findUnique({
    where: { telefono: data.telefono },
    select: { id: true, campoId: true },
  })

  if (!user || !user.campoId) {
    throw new Error("Usuario no encontrado")
  }

  let loteId: string | null = null
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
  const moneda = data.moneda === "USD" ? "USD" : "UYU"
  const montoOriginal = data.monto ?? 0

  let tasaCambio: number | null = null
  let montoEnUYU = montoOriginal
  let montoEnUSD = montoOriginal  // ✅ NUEVO

  if (moneda === "USD") {
    // Gasto en dólares
    try {
      tasaCambio = await getUSDToUYU()
    } catch (err) {
      console.log("Error obteniendo dólar → uso 40 por defecto")
      tasaCambio = 40
    }
    montoEnUYU = montoOriginal * tasaCambio
    montoEnUSD = montoOriginal
  } else {
    // Gasto en pesos uruguayos
    try {
      tasaCambio = await getUSDToUYU()
      montoEnUSD = montoOriginal / tasaCambio
    } catch (err) {
      montoEnUSD = montoOriginal / 40
    }
  }

  await prisma.gasto.create({
    data: {
      tipo: "GASTO",
      fecha: new Date(),
      descripcion: data.descripcion,
      categoria: data.categoria || "Otros",
      campoId: user.campoId,
      metodoPago: data.metodoPago || "Contado",
      diasPlazo:
        data.metodoPago === "Plazo"
          ? data.diasPlazo ?? null
          : null,
      pagado:
        data.metodoPago === "Plazo"
          ? (data.pagado !== undefined ? data.pagado : false)
          : true,
      proveedor: data.proveedor || null,
      iva: data.iva ?? null,

      // 💵 campos de moneda
      moneda,
      montoOriginal,
      tasaCambio,
      montoEnUYU,
      montoEnUSD,  // ✅ NUEVO
      especie: null,  // ✅ NUEVO (el bot no asigna especie)

      // compatibilidad
      monto: montoEnUYU,
    },
  })

  return
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

  console.log(`Dato guardado: ${data.tipo}`)
}

/* ===============================
   ENVÍO DE MENSAJES
   =============================== */

/**
 * Enviar mensaje de WhatsApp (texto simple)
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
          to,
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
 * Enviar mensaje con botones interactivos (para texto/audio)
 */
async function sendWhatsAppMessageWithButtons(
  to: string,
  bodyText: string
) {
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
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText,
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "btn_confirmar",
                    title: "Confirmar",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_editar",
                    title: "Editar",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_cancelar",
                    title: "Cancelar",
                  },
                },
              ],
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando botones:", error)

      await sendWhatsAppMessage(
        to,
        bodyText +
          "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
      )
    }
  } catch (error) {
    console.error("Error en sendWhatsAppMessageWithButtons:", error)

    await sendWhatsAppMessage(
      to,
      bodyText +
        "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
    )
  }
}

/**
 * Enviar mensaje con botones personalizados (para facturas)
 */
async function sendCustomButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
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
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText,
            },
            action: {
              buttons: buttons.map((btn) => ({
                type: "reply",
                reply: {
                  id: btn.id,
                  title: btn.title,
                },
              })),
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando botones personalizados:", error)

      await sendWhatsAppMessage(
        to,
        bodyText +
          "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
      )
    }
  } catch (error) {
    console.error("Error en sendCustomButtons:", error)

    await sendWhatsAppMessage(
      to,
      bodyText +
        "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
    )
  }
}