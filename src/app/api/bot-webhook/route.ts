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
  handleCalendarioCrear,
  handleCalendarioConsultar,
  handleCalendarioButtonResponse,
  handleMoverPotreroModulo,
  handleReporteCarga,
  handleReportePastoreo,
  handleReportePastoreoButtonResponse,
  handleStockConsulta,
  handleStockEdicion,
  handleCambiarCampo,
  handleCambiarCampoSeleccion,
  handleSeleccionGrupo,
  handleTacto,
  handleMapa,
  handleDAO,
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
  console.error("=== VERSIÓN: v3.2 CALENDARIO CON EDICIÓN COMPLETA - 2025-12-11 ===")
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
        if (messageText.startsWith("cal_")) {
          await handleCalendarioButtonResponse(from, messageText)
          return NextResponse.json({ status: "calendario button processed" })
        }

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

        if (messageText.startsWith("pastoreo_")) {
          await handleReportePastoreoButtonResponse(from, messageText)
          return NextResponse.json({ status: "pastoreo button processed" })
        }

        if (messageText.startsWith("campo_")) {
          await handleCambiarCampoSeleccion(from, messageText)
          return NextResponse.json({ status: "campo change processed" })
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
    // 🔥 COMANDO CANCELAR GLOBAL - Siempre funciona
    // ==========================================
    if (messageText.toLowerCase().trim() === "cancelar") {
      const deleted = await prisma.pendingConfirmation.deleteMany({
        where: { telefono: from },
      })
      
      if (deleted.count > 0) {
        await sendWhatsAppMessage(from, "❌ Operación cancelada. Podés empezar de nuevo.")
      } else {
        await sendWhatsAppMessage(from, "No hay ninguna operación pendiente para cancelar.")
      }
      return NextResponse.json({ status: "cancelled" })
    }

    // ==========================================
    // 2.5 COMANDO CAMBIAR CAMPO
    // ==========================================
    const comandosCambiarCampo = ["cambiar campo", "cambiar de campo", "mis campos", "otros campos"]
    if (comandosCambiarCampo.includes(messageText.toLowerCase().trim())) {
      await handleCambiarCampo(from)
      return NextResponse.json({ status: "cambiar campo" })
    }

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
      const data = JSON.parse(confirmacionPendiente.data)
      
      // Si está eligiendo grupo, procesar número
      if (data.tipo === "CAMBIAR_GRUPO") {
        const numero = parseInt(messageText.trim())
        if (!isNaN(numero)) {
          await handleSeleccionGrupo(from, numero, data.grupos)
          return NextResponse.json({ status: "grupo selection processed" })
        } else {
          await sendWhatsAppMessage(from, `❌ Escribí un número del 1 al ${data.grupos.length} para elegir el grupo.`)
          return NextResponse.json({ status: "invalid grupo selection" })
        }
      }
      
      // Si hay consulta de stock activa, intentar procesar como edición
      if (data.tipo === "STOCK_CONSULTA") {
        const procesado = await handleStockEdicion(from, messageText)
        if (procesado) {
          return NextResponse.json({ status: "stock edit processed" })
        }
      }
      
      // Si no fue edición de stock, procesar confirmación normal
      await handleConfirmacion(from, messageText, confirmacionPendiente)
      return NextResponse.json({ status: "confirmacion processed" })
    }
    // ==========================================
// 6. FASE 3: Procesar con GPT (texto/audio)
// ==========================================

// 🔥 OBTENER DATOS DEL USUARIO (una sola vez)
const usuario = await prisma.user.findUnique({
  where: { telefono: from },
  select: { 
    id: true,
    name: true,
    campoId: true,
    campo: { select: { nombre: true } }
  }
})

let potreros: Array<{ id: string; nombre: string }> = []
let categorias: Array<{ nombreSingular: string; nombrePlural: string }> = []

if (usuario?.campoId) {
  potreros = await prisma.lote.findMany({
    where: { campoId: usuario.campoId },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' }
  })

  categorias = await prisma.categoriaAnimal.findMany({
    where: { campoId: usuario.campoId, activo: true },
    select: { nombreSingular: true, nombrePlural: true }
  })
}

// ==========================================
// 6.4 DETECTAR COMANDO MAPA (sin pasar por GPT)
// ==========================================
const comandosMapa = ["mapa", "ver mapa", "mapa del campo", "mostrame el mapa", "mandame el mapa", "imagen del campo"]
if (comandosMapa.includes(messageText.toLowerCase().trim())) {
  await handleMapa(from)
  return NextResponse.json({ status: "mapa sent" })
}

// ==========================================
// 6.5 DETECTAR CONSULTA DE STOCK
// ==========================================
// Detecta múltiples formatos:
// - "potrero sur"
// - "stock potrero sur" / "stock sur"
// - "ver norte" / "ver potrero norte"
// - "cuántos hay en el este"
const consultaStockMatch = messageText.match(
  /^(?:potrero|stock|ver|cuántos?|cuantos?|hay)\s+(?:potrero\s+|en\s+)?(.+)$/i
)
if (consultaStockMatch && usuario?.campoId) {
  const nombrePotrero = consultaStockMatch[1].trim()
  await handleStockConsulta(from, nombrePotrero, usuario.campoId)
  return NextResponse.json({ status: "stock consulta processed" })
}

// ==========================================
// 6. FASE 3: Procesar con GPT (texto/audio)
// ==========================================

const parsedData = await parseMessageWithAI(messageText, potreros, categorias)

    // ========================================
    // 🚫 GPT retornó un error
    // ========================================
    if (parsedData?.error) {
      const nombresPotreros = potreros.map(p => p.nombre).join(', ')
      await sendWhatsAppMessage(
        from,
        `❌ ${parsedData.error}\n\n` +
        (potreros.length > 0 
          ? `📍 Tus potreros son: ${nombresPotreros}`
          : `No tenés potreros creados aún.`)
      )
      return NextResponse.json({ status: "error from gpt" })
    }

    if (parsedData) {
  // ========================================
  // 📊 REPORTE DE CARGA (PDF)
  // ========================================
  if (parsedData.tipo === "REPORTE_CARGA") {
    await handleReporteCarga(from)
    return NextResponse.json({ status: "reporte carga sent" })
  }

  // ========================================
  // 📊 REPORTE DE PASTOREO (PDF)
  // ========================================
  if (parsedData.tipo === "REPORTE_PASTOREO") {
    await handleReportePastoreo(from)
    return NextResponse.json({ status: "reporte pastoreo initiated" })
  }

  // ========================================
  // 🗺️ MAPA DEL CAMPO
  // ========================================
  if (parsedData.tipo === "MAPA") {
    await handleMapa(from)
    return NextResponse.json({ status: "mapa sent" })
  }

  // ========================================
  // 🤚 TACTO
  // ========================================
  if (parsedData.tipo === "TACTO") {
    await handleTacto(from, parsedData)
    return NextResponse.json({ status: "tacto processed" })
  }

  // ========================================
  // 🔬 DAO
  // ========================================
  if (parsedData.tipo === "DAO") {
    await handleDAO(from, parsedData)
    return NextResponse.json({ status: "dao processed" })
  }

  // 🔥 AGREGAR ESTO AQUÍ 👇
  // ========================================
  // 📝 STOCK EDICIÓN (conteo directo)
  // ========================================
  if (parsedData.tipo === "STOCK_EDICION") {
    await handleStockEdicion(from, parsedData)
    return NextResponse.json({ status: "stock edicion processed" })
  }
  // 🔥 FIN DE LO QUE SE AGREGA

  // ========================================
  // 📅 CALENDARIO - Crear actividad
  // ========================================
  if (parsedData.tipo === "CALENDARIO_CREAR") {
        await handleCalendarioCrear(from, parsedData)
        return NextResponse.json({ status: "calendario created" })
      }

      // ========================================
      // 📅 CALENDARIO - Consultar pendientes
      // ========================================
      if (parsedData.tipo === "CALENDARIO_CONSULTAR") {
        await handleCalendarioConsultar(from)
        return NextResponse.json({ status: "calendario consulted" })
      }

      // ========================================
      // Decidir qué tipo de confirmación usar
      // ========================================
      if (parsedData.tipo === "GASTO") {
        await solicitarConfirmacionConFlow(from, parsedData)
      } else if (parsedData.tipo === "CAMBIO_POTRERO") {
        await handleCambioPotrero(from, parsedData)
      } else if (parsedData.tipo === "MOVER_POTRERO_MODULO") {
        await handleMoverPotreroModulo(from, parsedData)
      } else {
        await solicitarConfirmacion(from, parsedData)
      }
      return NextResponse.json({ status: "awaiting confirmation" })
    }

    // ==========================================
    // 7. Mensaje no reconocido
    // ==========================================
    const campoActualNombre = usuario?.campo?.nombre || 'Sin campo'
    await sendWhatsAppMessage(
      from,
      `🏡 *Campo actual: ${campoActualNombre}*\n\n` +
      `No entendí tu mensaje. Podés enviarme cosas como:\n\n` +
        "• nacieron 3 terneros en potrero norte\n" +
        "• murieron 2 vacas en lote sur\n" +
        "• llovieron 25mm\n" +
        "• gasté $5000 en alimento\n" +
        "• moví 10 vacas del potrero norte al sur\n\n" +
        "📅 *Calendario:*\n" +
        "• en 14 días sacar tablilla\n" +
        "• el martes vacunar\n" +
        "• calendario (ver pendientes)\n\n" +
        "También podés enviarme un *audio* o una *foto de factura*\n\n" +
        `_(Escribí "cambiar campo" si querés trabajar en otro campo)_`
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("Error en webhook:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}