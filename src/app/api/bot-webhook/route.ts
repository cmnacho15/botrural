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
// CAMBIO 1: Import agregado
import { buscarPotreroPorNombre, buscarAnimalesEnPotrero, obtenerNombresPotreros } from "@/lib/potrero-helpers"

// NUEVO IMPORT PARA VENTAS
import { detectarTipoFactura, processVentaImage, mapearCategoriaVenta, type ParsedVenta } from "@/lib/vision-venta-parser"

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
      console.log("🖼️ DETECTADO messageType === image")  // ← AGREGÁ ESTO
      await handleImageMessage(message, from)
      return NextResponse.json({ status: "image processed" })
    }

    // Detectar tipo de mensaje (texto, audio, botones)
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

        // NUEVO: Botones de VENTA
        if (messageText.startsWith("venta_")) {
          await handleVentaButtonResponse(from, messageText)
          return NextResponse.json({ status: "venta button processed" })
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
      // Primero verificar si está esperando tipo de factura
      const wasHandled = await handleAwaitingInvoiceType(from, messageText, confirmacionPendiente)
      if (wasHandled) {
        return NextResponse.json({ status: "invoice type selected" })
      }
      
      await handleConfirmacion(from, messageText, confirmacionPendiente)
      return NextResponse.json({ status: "confirmacion processed" })
    }

    // FASE 3: Procesar con GPT (texto/audio)
    const parsedData = await parseMessageWithAI(messageText, from)

    // CAMBIO 2: Agregado manejo de CAMBIO_POTRERO
    if (parsedData) {
      // DECIDIR: Flow para GASTOS, CAMBIO_POTRERO especial, botones para el resto
      if (parsedData.tipo === "GASTO") {
        await solicitarConfirmacionConFlow(from, parsedData)
      } else if (parsedData.tipo === "CAMBIO_POTRERO") {
        await handleCambioPotrero(from, parsedData)
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

/* ===============================
   FLOW PARA GASTOS
   =============================== */

async function solicitarConfirmacionConFlow(phone: string, data: any) {
  try {
    if (!FLOW_GASTO_ID) {
      console.log("Flow no configurado, usando botones")
      await solicitarConfirmacion(phone, data)
      return
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

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
      await solicitarConfirmacion(phone, data)
      return
    }

    console.log("Flow de gasto enviado")

  } catch (error) {
    console.error("Error en solicitarConfirmacionConFlow:", error)
    await solicitarConfirmacion(phone, data)
  }
}

/* ===============================
   FACTURAS POR IMAGEN (GASTO O VENTA)
   =============================== */

// REEMPLAZAR la función handleImageMessage completa en route.ts

async function handleImageMessage(message: any, phoneNumber: string) {
  console.log("🎯 INICIO handleImageMessage - phoneNumber:", phoneNumber)
  try {
    const mediaId = message.image.id
    const caption = message.image.caption || ""

    const user = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      include: { campo: true },
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(phoneNumber, "No encontré tu cuenta asociada. Registrate primero.")
      return
    }

    await sendWhatsAppMessage(phoneNumber, "Procesando imagen... un momento")

    const imageData = await downloadWhatsAppImage(mediaId)
    if (!imageData) {
      await sendWhatsAppMessage(phoneNumber, "Error descargando la imagen. Intenta de nuevo.")
      return
    }

    const uploadResult = await uploadInvoiceToSupabase(imageData.buffer, imageData.mimeType, user.campoId)
    if (!uploadResult) {
      await sendWhatsAppMessage(phoneNumber, "Error guardando la imagen.")
      return
    }

    // DETECTAR TIPO: VENTA o GASTO
    console.log("🔍 Detectando tipo de factura...", uploadResult.url)

    let tipoFactura: "VENTA" | "GASTO" | null = null

    console.log("🚨 ANTES de detectarTipoFactura")
    try {
      tipoFactura = await detectarTipoFactura(uploadResult.url)
      console.log("🚨 DESPUÉS de detectarTipoFactura - resultado:", tipoFactura)
    } catch (err: any) {
      console.error("❌ Error en detectarTipoFactura:", err?.message)
      tipoFactura = null
    }
    
    console.log("🚨 DECISIÓN - tipoFactura vale:", tipoFactura)

    // Si no se pudo detectar, preguntar al usuario
    if (!tipoFactura) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No pude identificar el tipo de factura. ¿Es una:\n\n1️⃣ VENTA de animales\n2️⃣ GASTO (compra)\n\nRespondé: *venta* o *gasto*"
      )
      
      await prisma.pendingConfirmation.upsert({
        where: { telefono: phoneNumber },
        create: {
          telefono: phoneNumber,
          data: JSON.stringify({
            tipo: "AWAITING_INVOICE_TYPE",
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            caption,
          }),
        },
        update: {
          data: JSON.stringify({
            tipo: "AWAITING_INVOICE_TYPE",
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            caption,
          }),
        }
      })
      return // ← CRÍTICO: salir aquí
    }

    // ✅ FIX: Procesar según el tipo detectado y SALIR
    if (tipoFactura === "VENTA") {
      console.log("📊 BRANCH: Procesando como VENTA")
      await handleVentaImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption)
      return // ← AGREGADO: evita que siga al código de GASTO
    }

    if (tipoFactura === "GASTO") {
      console.log("💰 BRANCH: Procesando como GASTO")
      const invoiceData = await processInvoiceImage(uploadResult.url)
      
      if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No pude leer la factura de gasto. ¿La imagen está clara?")
        return
      }

      await prisma.pendingConfirmation.upsert({
        where: { telefono: phoneNumber },
        create: {
          telefono: phoneNumber,
          data: JSON.stringify({
            tipo: "INVOICE",
            invoiceData,
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            telefono: phoneNumber,
            caption,
          }),
        },
        update: {
          data: JSON.stringify({
            tipo: "INVOICE",
            invoiceData,
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            telefono: phoneNumber,
            caption,
          }),
        }
      })

      await sendInvoiceFlowMessage(phoneNumber, invoiceData)
      return // ← AGREGADO: salir después de procesar GASTO
    }

    // Si llegamos acá es porque tipoFactura tiene un valor inesperado
    console.error("⚠️ tipoFactura inesperado:", tipoFactura)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando la imagen. Intenta de nuevo.")

  } catch (error) {
    console.error("Error en handleImageMessage:", error)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando tu imagen.")
  }
}

/* ===============================
   VENTAS POR IMAGEN - NUEVAS FUNCIONES
   =============================== */

async function handleVentaImage(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  caption: string
) {
  try {
    const ventaData = await processVentaImage(imageUrl)
    if (!ventaData || !ventaData.renglones?.length) {
      await sendWhatsAppMessage(phoneNumber, "No pude leer la factura de venta. ¿La imagen está clara?")
      return
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: { telefono: phoneNumber, data: JSON.stringify({ tipo: "VENTA", ventaData, imageUrl, imageName, campoId }) },
      update: { data: JSON.stringify({ tipo: "VENTA", ventaData, imageUrl, imageName, campoId }) },
    })

    await sendVentaConfirmation(phoneNumber, ventaData)
  } catch (error) {
    console.error("Error en handleVentaImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error procesando la factura de venta.")
  }
}

async function sendVentaConfirmation(phoneNumber: string, data: any) {
  const renglonesText = data.renglones
    .map((r: any, i: number) => `${i + 1}. ${r.cantidad} ${r.categoria} - ${r.pesoPromedio?.toFixed(1) || 0}kg @ $${r.precioKgUSD?.toFixed(2) || 0}/kg = $${r.importeBrutoUSD?.toFixed(2) || 0}`)
    .join("\n")

  const bodyText =
    `*VENTA DE HACIENDA*\n\n` +
    `${data.fecha}\n` +
    `*${data.comprador}*\n` +
    `${data.productor}\n` +
    (data.nroFactura ? `Fact: ${data.nroFactura}\n` : "") +
    (data.nroTropa ? `Tropa: ${data.nroTropa}\n` : "") +
    `\n*Detalle:*\n${renglonesText}\n\n` +
    `${data.cantidadTotal} animales, ${data.pesoTotalKg?.toFixed(1) || 0} kg\n` +
    `Subtotal: $${data.subtotalUSD?.toFixed(2) || 0}\n` +
    `Impuestos: -$${data.totalImpuestosUSD?.toFixed(2) || 0}\n` +
    `*TOTAL: $${data.totalNetoUSD?.toFixed(2) || 0} USD*\n\n` +
    `¿Guardar?`

  await sendCustomButtons(phoneNumber, bodyText, [
    { id: "venta_confirm", title: "Confirmar" },
    { id: "venta_cancel", title: "Cancelar" },
  ])
}

async function handleVentaButtonResponse(phoneNumber: string, buttonId: string) {
  const pending = await prisma.pendingConfirmation.findUnique({ where: { telefono: phoneNumber } })
  if (!pending) {
    await sendWhatsAppMessage(phoneNumber, "No hay venta pendiente.")
    return
  }

  const savedData = JSON.parse(pending.data)
  if (savedData.tipo !== "VENTA") {
    await sendWhatsAppMessage(phoneNumber, "Usá los botones de la factura.")
    return
  }

  const action = buttonId.replace("venta_", "")

  if (action === "confirm") {
    await guardarVentaEnBD(savedData, phoneNumber)
  } else {
    await sendWhatsAppMessage(phoneNumber, "Venta cancelada.")
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
  }
}

async function guardarVentaEnBD(savedData: any, phoneNumber: string) {
  try {
    const { ventaData, imageUrl, imageName, campoId } = savedData

    console.log("ventaData recibida:", JSON.stringify(ventaData, null, 2))

    const user = await prisma.user.findUnique({ where: { telefono: phoneNumber }, select: { id: true } })

    const venta = await prisma.venta.create({
      data: {
        campoId,
        fecha: new Date(ventaData.fecha),
        comprador: ventaData.comprador,
        consignatario: ventaData.consignatario || null,
        nroTropa: ventaData.nroTropa || null,
        nroFactura: ventaData.nroFactura || null,
        metodoPago: ventaData.metodoPago || "Contado",
        diasPlazo: ventaData.diasPlazo || null,
        pagado: ventaData.metodoPago === "Contado",
        moneda: "USD",
        tasaCambio: ventaData.tipoCambio || null,
        subtotalUSD: ventaData.subtotalUSD,
        totalImpuestosUSD: ventaData.totalImpuestosUSD || 0,
        totalNetoUSD: ventaData.totalNetoUSD,
        imageUrl,
        imageName,
        impuestos: ventaData.impuestos || null,
        notas: "Venta desde WhatsApp",
      },
    })

    for (const r of ventaData.renglones) {
      const mapped = mapearCategoriaVenta(r.categoria)
      await prisma.ventaRenglon.create({
        data: {
          ventaId: venta.id,
          tipo: "GANADO",
          tipoAnimal: r.tipoAnimal || mapped.tipoAnimal,
          categoria: mapped.categoria,
          raza: r.raza || null,
          cantidad: r.cantidad,
          pesoPromedio: r.pesoPromedio,
          precioKgUSD: r.precioKgUSD,
          precioAnimalUSD: r.pesoPromedio * r.precioKgUSD,
          pesoTotalKg: r.pesoTotalKg,
          importeBrutoUSD: r.importeBrutoUSD,
          descontadoDeStock: false,
        },
      })
    }

    await prisma.evento.create({
      data: {
        tipo: "VENTA",
        descripcion: `Venta a ${ventaData.comprador}: ${ventaData.cantidadTotal} animales`,
        fecha: new Date(ventaData.fecha),
        cantidad: ventaData.cantidadTotal,
        monto: ventaData.totalNetoUSD,
        comprador: ventaData.comprador,
        campoId,
        usuarioId: user?.id || null,
        origenSnig: "BOT",
      },
    })

    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })

    await sendWhatsAppMessage(phoneNumber,
      `*Venta guardada!*\n\n${ventaData.cantidadTotal} animales\n$${ventaData.totalNetoUSD?.toFixed(2)} USD\n\nAnimales NO descontados del stock (hacelo desde la web)`
    )
  } catch (error) {
    console.error("Error guardando venta:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la venta.")
  }
}


/* ===============================
   MANEJO DE RESPUESTA TIPO FACTURA
   =============================== */

async function handleAwaitingInvoiceType(
  phoneNumber: string, 
  messageText: string, 
  pendingData: any
): Promise<boolean> {
  const savedData = JSON.parse(pendingData.data)
  
  if (savedData.tipo !== "AWAITING_INVOICE_TYPE") return false

  const respuesta = messageText.toLowerCase().trim()
  
  if (respuesta.includes("venta") || respuesta === "1") {
    await sendWhatsAppMessage(phoneNumber, "📊 Procesando como venta...")
    await handleVentaImage(
      phoneNumber, 
      savedData.imageUrl, 
      savedData.imageName, 
      savedData.campoId, 
      savedData.caption
    )
    await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
    return true
  }
  
  if (respuesta.includes("gasto") || respuesta === "2") {
    await sendWhatsAppMessage(phoneNumber, "💰 Procesando como gasto...")
    const invoiceData = await processInvoiceImage(savedData.imageUrl)
    
    if (!invoiceData?.items?.length) {
      await sendWhatsAppMessage(phoneNumber, "No pude leer la factura. Intenta de nuevo.")
      await prisma.pendingConfirmation.delete({ where: { telefono: phoneNumber } })
      return true
    }

    await prisma.pendingConfirmation.update({
      where: { telefono: phoneNumber },
      data: {
        data: JSON.stringify({
          tipo: "INVOICE",
          invoiceData,
          imageUrl: savedData.imageUrl,
          imageName: savedData.imageName,
          campoId: savedData.campoId,
          telefono: phoneNumber,
          caption: savedData.caption,
        })
      }
    })
    
    await sendInvoiceFlowMessage(phoneNumber, invoiceData)
    return true
  }

  await sendWhatsAppMessage(
    phoneNumber, 
    "No entendí. Respondé *venta* o *gasto*"
  )
  return true
}


/* ===============================
   FACTURAS GASTO (funciones originales)
   =============================== */

async function sendInvoiceFlowMessage(
  phoneNumber: string,
  invoiceData: any
) {
  try {
    if (!FLOW_GASTO_ID) {
      console.error("FLOW_GASTO_ID no configurado")
      await sendInvoiceConfirmation(phoneNumber, invoiceData)
      return false
    }

    const flowToken = crypto.randomBytes(16).toString('hex')

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

    const action = buttonId.replace("invoice_", "")

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

      for (const item of invoiceData.items) {
        const montoOriginal = item.precioFinal
        const montoEnUYU =
          monedaFactura === "USD" ? montoOriginal * tasaCambio : montoOriginal
        
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
            moneda: monedaFactura,
            montoOriginal,
            tasaCambio,
            montoEnUYU,
            montoEnUSD,
            especie: null,
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

async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}

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

    if (invitation.role === "CONTADOR") {
      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`
      await sendWhatsAppMessage(
        phone,
        `Hola! Para completar tu registro como Contador, ingresá acá:\n${registerLink}`
      )
      return
    }

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
        `• moví 10 vacas del potrero norte al sur\n` +
        `• foto de factura`
    )
  } catch (error) {
    console.error("Error procesando nombre:", error)
    await sendWhatsAppMessage(phone, "Error al procesar el registro.")
  }
}

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

async function handleConfirmacion(
  phone: string,
  respuesta: string,
  confirmacion: any
) {
  const respuestaLower = respuesta.toLowerCase().trim()

  const data = JSON.parse(confirmacion.data)

  if (data.tipo === "INVOICE") {
    await sendWhatsAppMessage(
      phone,
      "Para la factura usá los botones de confirmación que te envié."
    )
    return
  }

  // CAMBIO 3: Soporte para CAMBIO_POTRERO en confirmación
  if (
    respuestaLower === "confirmar" ||
    respuestaLower === "si" ||
    respuestaLower === "sí" ||
    respuestaLower === "yes" ||
    respuesta === "btn_confirmar"
  ) {
    try {
      if (data.tipo === "CAMBIO_POTRERO") {
        await ejecutarCambioPotrero(data)
      } else {
        await handleDataEntry(data)
      }
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

  if (
    respuestaLower === "editar" ||
    respuestaLower === "modificar" ||
    respuesta === "btn_editar"
  ) {
    await sendWhatsAppMessage(
      phone,
      "Ok, enviame los datos corregidos.\n\nEjemplo:\n• llovieron 30mm\n• nacieron 5 terneros\n• moví 10 vacas del norte al sur"
    )

    await prisma.pendingConfirmation
      .delete({
        where: { telefono: phone },
      })
      .catch(() => {})

    return
  }

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
    let montoEnUSD = montoOriginal

    if (moneda === "USD") {
      try {
        tasaCambio = await getUSDToUYU()
      } catch (err) {
        console.log("Error obteniendo dólar → uso 40 por defecto")
        tasaCambio = 40
      }
      montoEnUYU = montoOriginal * tasaCambio
      montoEnUSD = montoOriginal
    } else {
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
        moneda,
        montoOriginal,
        tasaCambio,
        montoEnUYU,
        montoEnUSD,
        especie: null,
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

/* ===============================
   CAMBIO DE POTRERO - NUEVAS FUNCIONES
   =============================== */

/**
 * Manejar cambio de potrero desde WhatsApp
 */
async function handleCambioPotrero(phoneNumber: string, data: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono: phoneNumber },
      select: { id: true, campoId: true },
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No encontré tu cuenta. Registrate primero."
      )
      return
    }

    const { cantidad, categoria, loteOrigen, loteDestino } = data

    if (!categoria) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No entendí qué animales querés mover.\n\nEjemplo: *moví 10 vacas del potrero norte al sur*"
      )
      return
    }

    if (!loteOrigen || !loteDestino) {
      await sendWhatsAppMessage(
        phoneNumber,
        "No entendí los potreros.\n\nEjemplo: *moví 10 vacas del potrero norte al sur*"
      )
      return
    }

    const potreroOrigen = await buscarPotreroPorNombre(loteOrigen, user.campoId)
    
    if (!potreroOrigen) {
      const potreros = await obtenerNombresPotreros(user.campoId)
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${loteOrigen}".\n\n` +
        `Tus potreros son:\n${potreros.map(p => `• ${p}`).join('\n')}`
      )
      return
    }

    const potreroDestino = await buscarPotreroPorNombre(loteDestino, user.campoId)
    
    if (!potreroDestino) {
      const potreros = await obtenerNombresPotreros(user.campoId)
      await sendWhatsAppMessage(
        phoneNumber,
        `No encontré el potrero "${loteDestino}".\n\n` +
        `Tus potreros son:\n${potreros.map(p => `• ${p}`).join('\n')}`
      )
      return
    }

    if (potreroOrigen.id === potreroDestino.id) {
      await sendWhatsAppMessage(
        phoneNumber,
        "El potrero origen y destino son el mismo."
      )
      return
    }

    const resultadoBusqueda = await buscarAnimalesEnPotrero(categoria, potreroOrigen.id, user.campoId)
    
    if (!resultadoBusqueda.encontrado) {
      if (resultadoBusqueda.opciones && resultadoBusqueda.opciones.length > 0) {
        const opcionesTexto = resultadoBusqueda.opciones
          .map(o => `• ${o.cantidad} ${o.categoria}`)
          .join('\n')
        
        await sendWhatsAppMessage(
          phoneNumber,
          `${resultadoBusqueda.mensaje}\n\n` +
          `En "${potreroOrigen.nombre}" hay:\n${opcionesTexto}\n\n` +
          `Especificá cuál querés mover.`
        )
      } else {
        await sendWhatsAppMessage(
          phoneNumber,
          `${resultadoBusqueda.mensaje || `No hay "${categoria}" en el potrero "${potreroOrigen.nombre}".`}`
        )
      }
      return
    }

    const animalesOrigen = resultadoBusqueda.animal!

    let cantidadMover = cantidad ? parseInt(cantidad) : animalesOrigen.cantidad
    
    if (cantidadMover <= 0) {
      await sendWhatsAppMessage(
        phoneNumber,
        "La cantidad debe ser mayor a 0."
      )
      return
    }

    if (cantidadMover > animalesOrigen.cantidad) {
      await sendWhatsAppMessage(
        phoneNumber,
        `No hay suficientes animales.\n\n` +
        `Solo hay *${animalesOrigen.cantidad} ${animalesOrigen.categoria}* en "${potreroOrigen.nombre}".\n\n` +
        `¿Querés mover los ${animalesOrigen.cantidad}?`
      )
      return
    }

    const confirmationData = {
      tipo: "CAMBIO_POTRERO",
      cantidad: cantidadMover,
      categoria: animalesOrigen.categoria,
      loteId: potreroOrigen.id,
      loteDestinoId: potreroDestino.id,
      loteOrigenNombre: potreroOrigen.nombre,
      loteDestinoNombre: potreroDestino.nombre,
      cantidadDisponible: animalesOrigen.cantidad,
      telefono: phoneNumber,
    }

    await prisma.pendingConfirmation.upsert({
      where: { telefono: phoneNumber },
      create: {
        telefono: phoneNumber,
        data: JSON.stringify(confirmationData),
      },
      update: {
        data: JSON.stringify(confirmationData),
      },
    })

    const mensaje = 
      `*Cambio de Potrero*\n\n` +
      `*${cantidadMover} ${animalesOrigen.categoria}*\n` +
      `De: *${potreroOrigen.nombre}*\n` +
      `A: *${potreroDestino.nombre}*\n\n` +
      (cantidadMover < animalesOrigen.cantidad 
        ? `Quedarán ${animalesOrigen.cantidad - cantidadMover} ${animalesOrigen.categoria} en ${potreroOrigen.nombre}\n\n`
        : '') +
      `¿Confirmar?`

    await sendWhatsAppMessageWithButtons(phoneNumber, mensaje)

  } catch (error) {
    console.error("Error en handleCambioPotrero:", error)
    await sendWhatsAppMessage(
      phoneNumber,
      "Error procesando el cambio de potrero. Intentá de nuevo."
    )
  }
}

/**
 * Ejecutar el cambio de potrero (después de confirmación)
 */
async function ejecutarCambioPotrero(data: any) {
  const user = await prisma.user.findUnique({
    where: { telefono: data.telefono },
    select: { id: true, campoId: true },
  })

  if (!user || !user.campoId) {
    throw new Error("Usuario no encontrado")
  }

  const animalOrigen = await prisma.animalLote.findFirst({
    where: { 
      loteId: data.loteId, 
      categoria: data.categoria,
      lote: { campoId: user.campoId }
    },
  })

  if (!animalOrigen || animalOrigen.cantidad < data.cantidad) {
    throw new Error("No hay suficientes animales")
  }

  const nuevaCantidadOrigen = animalOrigen.cantidad - data.cantidad
  
  if (nuevaCantidadOrigen === 0) {
    await prisma.animalLote.delete({ where: { id: animalOrigen.id } })
  } else {
    await prisma.animalLote.update({
      where: { id: animalOrigen.id },
      data: { cantidad: nuevaCantidadOrigen },
    })
  }

  const animalDestino = await prisma.animalLote.findFirst({
    where: { 
      loteId: data.loteDestinoId, 
      categoria: data.categoria,
      lote: { campoId: user.campoId }
    },
  })

  if (animalDestino) {
    await prisma.animalLote.update({
      where: { id: animalDestino.id },
      data: { cantidad: animalDestino.cantidad + data.cantidad },
    })
  } else {
    await prisma.animalLote.create({
      data: {
        categoria: data.categoria,
        cantidad: data.cantidad,
        loteId: data.loteDestinoId,
      },
    })
  }

  await prisma.lote.update({
    where: { id: data.loteId },
    data: { ultimoCambio: new Date() },
  })

  await prisma.lote.update({
    where: { id: data.loteDestinoId },
    data: { ultimoCambio: new Date() },
  })

  const descripcion = `Cambio de ${data.cantidad} ${data.categoria} del potrero "${data.loteOrigenNombre}" al potrero "${data.loteDestinoNombre}".`

  await prisma.evento.create({
    data: {
      tipo: "CAMBIO_POTRERO",
      descripcion,
      fecha: new Date(),
      cantidad: data.cantidad,
      categoria: data.categoria,
      loteId: data.loteId,
      loteDestinoId: data.loteDestinoId,
      usuarioId: user.id,
      campoId: user.campoId,
      origenSnig: "BOT",
    },
  })

  console.log(`Cambio de potrero ejecutado: ${descripcion}`)
}


//hola