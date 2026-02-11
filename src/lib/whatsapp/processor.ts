// src/lib/whatsapp/processor.ts
// Lógica central de procesamiento de mensajes de WhatsApp
// Usado tanto por el webhook (sync) como por el worker (async)

import { prisma } from "@/lib/prisma"
import { parseMessageWithAI } from "@/lib/openai-parser"

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
  handleSeleccionPotreroModulo,
  handleTacto,
  handleMapa,
  handleDAO,
  handleReporteDAO,
  handleLotesGranos,
  handlePagoButtonResponse,
  handlePagoTextResponse,
} from "@/lib/whatsapp"
import { esConsultaConversacional, handleIAConversacional } from "@/lib/whatsapp/handlers/iaConversacionalHandler"
import { handleAgricultura, confirmarAgricultura, cancelarAgricultura } from "@/lib/whatsapp/handlers/agriculturaHandler"
import { handleInsumos, confirmarInsumos, cancelarInsumos } from "@/lib/whatsapp/handlers/insumosHandler"
import { logWhatsAppError } from "@/lib/error-logger"

/**
 * Procesa un mensaje de WhatsApp
 * Esta función contiene toda la lógica de procesamiento
 */
export async function processWhatsAppMessage(
  message: any,
  from: string,
  messageType: string
): Promise<{ status: string }> {

  // Obtener info del usuario para logging
  let userContext: { userId?: string; campoId?: string; telefono: string } = { telefono: from }

  try {
    const userForLogging = await prisma.user.findUnique({
      where: { telefono: from },
      select: { id: true, campoId: true }
    })
    if (userForLogging) {
      userContext = { userId: userForLogging.id, campoId: userForLogging.campoId || undefined, telefono: from }
    }
  } catch {}

  try {
    // ==========================================
    // 1. PROCESAR IMÁGENES (facturas)
    // ==========================================
    if (messageType === "image") {
      console.log("DETECTADO messageType === image")
      await handleImageMessage(message, from)
      return { status: "image processed" }
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
        return { status: "calendario button processed" }
      }

      if (messageText.startsWith("invoice_")) {
        await handleInvoiceButtonResponse(from, messageText)
        return { status: "invoice button processed" }
      }

      if (messageText.startsWith("venta_")) {
        await handleVentaButtonResponse(from, messageText)
        return { status: "venta button processed" }
      }

      if (messageText.startsWith("stock_")) {
        await handleStockButtonResponse(from, messageText)
        return { status: "stock button processed" }
      }

      if (messageText.startsWith("pastoreo_")) {
        await handleReportePastoreoButtonResponse(from, messageText)
        return { status: "pastoreo button processed" }
      }

      if (messageText.startsWith("pago_")) {
        await handlePagoButtonResponse(from, messageText)
        return { status: "pago button processed" }
      }

      if (messageText.startsWith("agri_")) {
        if (messageText === "agri_confirm") {
          await confirmarAgricultura(from)
        } else {
          await cancelarAgricultura(from)
        }
        return { status: "agricultura button processed" }
      }

      if (messageText.startsWith("insumo_")) {
        if (messageText === "insumo_confirm") {
          await confirmarInsumos(from)
        } else {
          await cancelarInsumos(from)
        }
        return { status: "insumos button processed" }
      }

      if (messageText.startsWith("campo_")) {
        await handleCambiarCampoSeleccion(from, messageText)
        return { status: "campo change processed" }
      }
    }
  } else if (messageType === "audio") {
    // Obtener userId para tracking
    const audioUser = await prisma.user.findUnique({
      where: { telefono: from },
      select: { id: true }
    })
    // Procesar audio y obtener transcripción
    const transcription = await handleAudioMessage(message, from, audioUser?.id)
    if (transcription) {
      // Usar la transcripción como mensaje de texto
      messageText = transcription
      console.log(`Audio transcrito, procesando como texto: ${messageText}`)
    } else {
      return { status: "audio failed" }
    }
  } else {
    // Tipo no soportado
    await sendWhatsAppMessage(
      from,
      "Por ahora solo acepto mensajes de texto, audio e imágenes de facturas"
    )
    return { status: "unsupported type" }
  }

  console.log(`Mensaje de ${from}: ${messageText}`)

  // ==========================================
  // COMANDO CANCELAR GLOBAL
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
    return { status: "cancelled" }
  }

  // ==========================================
  // COMANDO CAMBIAR CAMPO
  // ==========================================
  const comandosCambiarCampo = ["cambiar campo", "cambiar de campo", "mis campos", "otros campos"]
  if (comandosCambiarCampo.includes(messageText.toLowerCase().trim())) {
    await handleCambiarCampo(from)
    return { status: "cambiar campo" }
  }

  // ==========================================
  // FASE 1: Detectar si es un token de invitación
  // ==========================================
  if (await isToken(messageText)) {
    await handleTokenRegistration(from, messageText)
    return { status: "token processed" }
  }

  // ==========================================
  // FASE 1.5: Si tiene registro pendiente, procesar nombre
  // ==========================================
  const pendiente = await prisma.pendingRegistration.findUnique({
    where: { telefono: from },
  })

  if (pendiente) {
    await handleNombreRegistro(from, messageText, pendiente.token)
    return { status: "nombre processed" }
  }

  // ==========================================
  // FASE 2: Verificar si hay confirmación pendiente
  // ==========================================
  const confirmacionPendiente = await prisma.pendingConfirmation.findUnique({
    where: { telefono: from },
  })

  console.log("🔍 confirmacionPendiente existe?", !!confirmacionPendiente)
  if (confirmacionPendiente) {
    console.log("📦 confirmacionPendiente.data:", confirmacionPendiente.data)
  }

  if (confirmacionPendiente) {
    const data = JSON.parse(confirmacionPendiente.data)
    console.log("📦 data.tipo:", data.tipo)

    // Si está esperando selección de pagos
    if (data.tipo === "ESTADO_CUENTA_PAGO") {
      const procesado = await handlePagoTextResponse(from, messageText)
      if (procesado) {
        return { status: "pago selection processed" }
      }
    }

    // Si está esperando respuesta de lotes de granos
    if (data.tipo === "LOTES_GRANOS") {
      const { handleLotesGranosResponse } = await import("@/lib/whatsapp/handlers/ventaHandler")
      await handleLotesGranosResponse(from, messageText)
      return { status: "lotes granos response processed" }
    }

    // Si está eligiendo potrero con módulos
    if (data.tipo === "ELEGIR_POTRERO_ORIGEN" || data.tipo === "ELEGIR_POTRERO_DESTINO") {
      await handleSeleccionPotreroModulo(from, messageText, data)
      return { status: "modulo selection processed" }
    }

    // Si está eligiendo potrero para ver stock
    if (data.tipo === "ELEGIR_POTRERO_STOCK") {
      const numero = parseInt(messageText.trim())

      if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
        await sendWhatsAppMessage(from, `❌ Escribí un número del 1 al ${data.opciones.length} para elegir el potrero.`)
        return { status: "invalid stock selection" }
      }

      const { handleSeleccionPotreroStock } = await import("@/lib/whatsapp/handlers/stockConsultaHandler")

      // Obtener campoId del usuario
      const user = await prisma.user.findUnique({
        where: { telefono: from },
        select: { campoId: true }
      })

      if (user?.campoId) {
        await handleSeleccionPotreroStock(from, numero, data.opciones, user.campoId)
      } else {
        await sendWhatsAppMessage(from, "❌ No tenés un campo configurado.")
      }

      return { status: "stock selection processed" }
    }

    // Si está eligiendo categoría para editar stock
    if (data.tipo === "ELEGIR_CATEGORIA_STOCK") {
      const numero = parseInt(messageText.trim())

      if (isNaN(numero) || numero < 1 || numero > data.opciones.length) {
        await sendWhatsAppMessage(from, `❌ Escribí un número del 1 al ${data.opciones.length} para elegir la categoría.`)
        return { status: "invalid categoria selection" }
      }

      const categoriaSeleccionada = data.opciones[numero - 1]

      // Crear el cambio pendiente directamente
      const cambio = {
        categoria: categoriaSeleccionada.categoria,
        cantidadOriginal: categoriaSeleccionada.cantidad,
        cantidadNueva: data.cantidadNueva
      }

      await prisma.pendingConfirmation.upsert({
        where: { telefono: from },
        create: {
          telefono: from,
          data: JSON.stringify({
            tipo: "STOCK_CONSULTA",
            loteId: data.loteId,
            loteNombre: data.loteNombre,
            stockActual: data.opciones,
            cambiosPendientes: [cambio]
          })
        },
        update: {
          data: JSON.stringify({
            tipo: "STOCK_CONSULTA",
            loteId: data.loteId,
            loteNombre: data.loteNombre,
            stockActual: data.opciones,
            cambiosPendientes: [cambio]
          })
        }
      })

      const { sendCustomButtons } = await import("@/lib/whatsapp/services/messageService")

      const cambioTexto = cambio.cantidadNueva === 0
        ? `• ${cambio.categoria}: ~~${cambio.cantidadOriginal}~~ → **ELIMINAR**`
        : `• ${cambio.categoria}: ${cambio.cantidadOriginal} → **${cambio.cantidadNueva}**`

      const mensaje =
        `*Cambio en ${data.loteNombre}:*\n\n` +
        `${cambioTexto}\n\n` +
        `¿Confirmar?`

      await sendCustomButtons(from, mensaje, [
        { id: "stock_confirm", title: "✅ Confirmar" },
        { id: "stock_cancel", title: "❌ Cancelar" }
      ])

      return { status: "categoria selection processed" }
    }

    // Si está eligiendo grupo, procesar número
    if (data.tipo === "CAMBIAR_GRUPO") {
      const numero = parseInt(messageText.trim())
      if (!isNaN(numero)) {
        await handleSeleccionGrupo(from, numero, data.grupos)
        return { status: "grupo selection processed" }
      } else {
        await sendWhatsAppMessage(from, `❌ Escribí un número del 1 al ${data.grupos.length} para elegir el grupo.`)
        return { status: "invalid grupo selection" }
      }
    }

    // PRIORIDAD: Si hay consulta de stock activa, intentar procesar como edición PRIMERO
    if (data.tipo === "STOCK_CONSULTA") {
      // Intentar parsear como edición manual: "300 novillos" o "novillos 300"
      const edicionManual = messageText.match(/^(\d+)\s+(.+)|(.+)\s+(\d+)$/i)

      if (edicionManual) {
        console.log("🔍 Detectada edición manual de stock:", messageText)
        const procesado = await handleStockEdicion(from, messageText)
        if (procesado) {
          console.log("✅ Edición manual procesada correctamente")
          return { status: "stock edit processed" }
        } else {
          console.log("⚠️ handleStockEdicion retornó false, intentando con GPT...")
        }
      }

      // Si la edición manual falló, parsear con GPT como respaldo
      console.log("🤖 Intentando parsear con GPT como respaldo...")
      const usuario = await prisma.user.findUnique({
        where: { telefono: from },
        select: { id: true, campoId: true }
      })

      if (usuario?.campoId) {
        let categorias: Array<{ nombreSingular: string; nombrePlural: string }> = []
        categorias = await prisma.categoriaAnimal.findMany({
          where: { campoId: usuario.campoId, activo: true },
          select: { nombreSingular: true, nombrePlural: true }
        })

        const parsedData = await parseMessageWithAI(messageText, [], categorias, usuario.id)
        console.log("📦 GPT parseó como:", parsedData?.tipo)

        if (parsedData?.tipo === "STOCK_EDICION") {
          const procesado = await handleStockEdicion(from, parsedData)
          if (procesado) {
            console.log("✅ Edición GPT procesada correctamente")
            return { status: "stock edit gpt processed" }
          }
        }
      }

      console.log("❌ No se pudo procesar como edición de stock")
    }

    // Si no fue edición de stock, procesar confirmación normal
    await handleConfirmacion(from, messageText, confirmacionPendiente)
    return { status: "confirmacion processed" }
  }

  // ==========================================
  // FASE 3: Procesar con GPT (texto/audio)
  // ==========================================

  // OBTENER DATOS DEL USUARIO
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
  // DETECTAR COMANDO MAPA (sin pasar por GPT)
  // ==========================================
  const comandosMapa = ["mapa", "ver mapa", "mapa del campo", "mostrame el mapa", "mandame el mapa", "imagen del campo"]
  if (comandosMapa.includes(messageText.toLowerCase().trim())) {
    await handleMapa(from)
    return { status: "mapa sent" }
  }

  // ==========================================
  // PREGUNTAS SOBRE STOCK → PDF DE CARGA
  // ==========================================
  const preguntaStock = /cu[aá]ntos?\s+animales|cu[aá]ntas?\s+vacas|cu[aá]ntos?\s+tengo|stock\s+actual|carga\s+actual|reporte\s+de\s+carga|pdf\s+de\s+carga/i
  if (preguntaStock.test(messageText)) {
    await handleReporteCarga(from)
    return { status: "reporte carga sent" }
  }

  // ==========================================
  // IA CONVERSACIONAL - Preguntas sobre datos
  // ==========================================
  if (usuario?.campoId && esConsultaConversacional(messageText)) {
    const campoNombre = usuario.campo?.nombre || 'tu campo'
    const respondido = await handleIAConversacional(from, messageText, usuario.campoId, campoNombre)
    if (respondido) {
      return { status: "ia conversacional" }
    }
  }

  // ==========================================
  // DETECTAR CONSULTA DE STOCK
  // ==========================================
  // Detectar formato "hay X vacas en potrero Y" primero
  const hayEnPotreroMatch = messageText.match(
    /^(?:hay|tiene)\s+\d+\s+\w+\s+en\s+(?:potrero\s+)?(.+)$/i
  )
  if (hayEnPotreroMatch && usuario?.campoId) {
    const nombrePotrero = hayEnPotreroMatch[1].trim()
    await handleStockConsulta(from, nombrePotrero, usuario.campoId)
    return { status: "stock consulta processed" }
  }

  // Formato simple: "potrero X" / "stock X"
  const consultaStockMatch = messageText.match(
    /^(?:potrero|stock|ver|cuántos?|cuantos?)\s+(?:potrero\s+|en\s+)?(.+)$/i
  )
  if (consultaStockMatch && usuario?.campoId) {
    const nombrePotrero = consultaStockMatch[1].trim()
    await handleStockConsulta(from, nombrePotrero, usuario.campoId)
    return { status: "stock consulta processed" }
  }

  // ==========================================
  // PROCESAR CON GPT
  // ==========================================
  const parsedData = await parseMessageWithAI(messageText, potreros, categorias, usuario?.id)

  // GPT retornó un error
  if (parsedData?.error) {
    const nombresPotreros = potreros.map(p => p.nombre).join(', ')
    await sendWhatsAppMessage(
      from,
      `❌ ${parsedData.error}\n\n` +
      (potreros.length > 0
        ? `📍 Tus potreros son: ${nombresPotreros}`
        : `No tenés potreros creados aún.`)
    )
    return { status: "error from gpt" }
  }

  if (parsedData) {
    // REPORTE DE CARGA (PDF)
    if (parsedData.tipo === "REPORTE_CARGA") {
      await handleReporteCarga(from)
      return { status: "reporte carga sent" }
    }

    // REPORTE DE PASTOREO (PDF)
    if (parsedData.tipo === "REPORTE_PASTOREO") {
      await handleReportePastoreo(from)
      return { status: "reporte pastoreo initiated" }
    }

    // LOTES DE GRANOS - Elegir lote
    if (parsedData.tipo === "LOTES_GRANOS") {
      await handleLotesGranos(from, parsedData)
      return { status: "lotes granos processed" }
    }

    // REPORTE DE DAO (PDF)
    if (parsedData.tipo === "REPORTE_DAO") {
      await handleReporteDAO(from)
      return { status: "reporte dao sent" }
    }

    // CONSULTA DE DATOS
    if (parsedData.tipo === "CONSULTA_DATOS") {
      const { handleConsultaDatos } = await import("@/lib/whatsapp/handlers/consultaDatosHandler")
      await handleConsultaDatos(from, parsedData)
      return { status: "consulta datos processed" }
    }

    // MAPA DEL CAMPO
    if (parsedData.tipo === "MAPA") {
      await handleMapa(from)
      return { status: "mapa sent" }
    }

    // TACTO
    if (parsedData.tipo === "TACTO") {
      await handleTacto(from, parsedData)
      return { status: "tacto processed" }
    }

    // DAO
    if (parsedData.tipo === "DAO") {
      await handleDAO(from, parsedData)
      return { status: "dao processed" }
    }

    // TRATAMIENTO
    if (parsedData.tipo === "TRATAMIENTO") {
      const { handleTratamiento } = await import("@/lib/whatsapp/handlers/tratamientoHandler")
      await handleTratamiento(from, parsedData)
      return { status: "tratamiento processed" }
    }

    // MANEJO (acciones físicas no sanitarias)
    if (parsedData.tipo === "MANEJO") {
      await solicitarConfirmacion(from, parsedData)
      return { status: "awaiting confirmation" }
    }

    // STOCK EDICIÓN
    if (parsedData.tipo === "STOCK_EDICION") {
      await handleStockEdicion(from, parsedData)
      return { status: "stock edicion processed" }
    }

    // CALENDARIO - Crear actividad
    if (parsedData.tipo === "CALENDARIO_CREAR") {
      await handleCalendarioCrear(from, parsedData)
      return { status: "calendario created" }
    }

    // CALENDARIO - Consultar pendientes
    if (parsedData.tipo === "CALENDARIO_CONSULTAR") {
      await handleCalendarioConsultar(from)
      return { status: "calendario consulted" }
    }

    // EVENTOS DE AGRICULTURA
    const tiposAgricultura = ['SIEMBRA', 'COSECHA', 'PULVERIZACION', 'REFERTILIZACION', 'RIEGO', 'MONITOREO', 'OTROS_LABORES']
    if (tiposAgricultura.includes(parsedData.tipo)) {
      await handleAgricultura(from, parsedData)
      return { status: "agricultura processed" }
    }

    // EVENTOS DE INSUMOS
    const tiposInsumos = ['INGRESO_INSUMO', 'USO_INSUMO']
    if (tiposInsumos.includes(parsedData.tipo)) {
      await handleInsumos(from, parsedData)
      return { status: "insumos processed" }
    }

    // Decidir qué tipo de confirmación usar
    if (parsedData.tipo === "GASTO") {
      await solicitarConfirmacionConFlow(from, parsedData)
    } else if (parsedData.tipo === "CAMBIO_POTRERO") {
      await handleCambioPotrero(from, parsedData)
    } else if (parsedData.tipo === "MOVER_POTRERO_MODULO") {
      await handleMoverPotreroModulo(from, parsedData)
    } else {
      await solicitarConfirmacion(from, parsedData)
    }
    return { status: "awaiting confirmation" }
  }

  // ==========================================
  // Mensaje no reconocido
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
      "🌱 *Agricultura:*\n" +
      "• sembré 50 ha de maíz en el norte\n" +
      "• cosechamos la soja del sur\n" +
      "• pulvericé el maíz con glifosato\n" +
      "• regué 20mm el trigo\n\n" +
      "📅 *Calendario:*\n" +
      "• en 14 días sacar tablilla\n" +
      "• el martes vacunar\n" +
      "• calendario (ver pendientes)\n\n" +
      "🤖 *Consultas con IA:*\n" +
      "• ¿cuántos animales tengo?\n" +
      "• ¿cuánto gasté este mes?\n" +
      "• dame un resumen del campo\n\n" +
      "También podés enviarme un *audio* o una *foto de factura*\n\n" +
      `_(Escribí "cambiar campo" si querés trabajar en otro campo)_`
  )

  return { status: "not recognized" }

  } catch (error) {
    // Loguear el error con contexto del usuario
    await logWhatsAppError(
      `Error procesando mensaje de WhatsApp: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      error,
      {
        ...userContext,
        messageType,
        messageText: message?.text?.body || message?.interactive?.button_reply?.id || '[no text]'
      }
    )

    // Notificar al usuario que hubo un error
    try {
      await sendWhatsAppMessage(
        from,
        "❌ Hubo un error procesando tu mensaje. Ya fue registrado y lo vamos a revisar. Por favor intentá de nuevo."
      )
    } catch {}

    return { status: "error" }
  }
}
