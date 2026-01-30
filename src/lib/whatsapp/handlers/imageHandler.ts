// src/lib/whatsapp/handlers/imageHandler.ts

import { prisma } from "@/lib/prisma"
import { detectarTipoFactura, detectarEstadoDeCuenta } from "@/lib/vision-venta-parser"
import { esDocumento } from "@/lib/detectors/es-documento-detector"
import {
  downloadWhatsAppImage,
  uploadInvoiceToSupabase,
} from "@/lib/supabase-storage"
import { sendWhatsAppMessage } from "../services/messageService"
import { handleGastoImage } from "./gastoHandler"
import { handleVentaImage } from "./ventaHandler"
import { handleEstadoDeCuenta } from "./pagoHandler"
import { saveObservacionFromUrl } from "./observacionHandler"

/**
 * Punto de entrada principal para procesar imágenes (facturas)
 * NO envía mensajes duplicados - delega a handlers específicos
 */
export async function handleImageMessage(message: any, phoneNumber: string) {
  console.log("INICIO handleImageMessage - phoneNumber:", phoneNumber)
  
  // Evitar procesamiento duplicado
  const messageId = message.image.id
  const cacheKey = `processing_${messageId}`
  
  // Check si ya se está procesando (en memoria simple)
  if ((global as any)[cacheKey]) {
    console.log("⚠️ Mensaje duplicado detectado, ignorando...")
    return
  }
  
  (global as any)[cacheKey] = true
  
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

    // ✅ ÚNICO mensaje de "Procesando..."
    await sendWhatsAppMessage(phoneNumber, "Procesando imagen... un momento ⏳")

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

    console.log("Detectando tipo de imagen...", uploadResult.url)

    // =====================================================
    // LÓGICA SIMPLIFICADA:
    // - Foto CON mensaje → Procesar mensaje como evento, adjuntar foto
    // - Foto SIN mensaje → Analizar si es factura
    // =====================================================

    if (caption && caption.trim().length > 0) {
      // HAY CAPTION: Procesar como mensaje de texto con foto adjunta
      // No analizar la imagen, ir directo a procesar el mensaje
      console.log("📝 Foto con mensaje, procesando mensaje y adjuntando foto...")
      await saveObservacionFromUrl(
        phoneNumber,
        uploadResult.url,
        uploadResult.fileName,
        user.campoId,
        user.id,
        caption
      )
      return
    }

    // NO HAY CAPTION: Analizar si es factura/documento
    console.log("📷 Foto sin mensaje, analizando si es factura...")

    // =====================================================
    // PASO 1: Detectar si es DOCUMENTO o FOTO normal (usa IA)
    // =====================================================
    const tipoImagen = await esDocumento(uploadResult.url, user.id)
    console.log("Tipo de imagen detectado:", tipoImagen)

    // Si es claramente una FOTO (no documento), guardar como observación
    if (tipoImagen === "FOTO") {
      console.log("📸 Es una FOTO de campo sin descripción, guardando como observación...")
      await saveObservacionFromUrl(
        phoneNumber,
        uploadResult.url,
        uploadResult.fileName,
        user.campoId,
        user.id,
        ""
      )
      return
    }

    // =====================================================
    // PASO 2: Si es DOCUMENTO, detectar si es estado de cuenta
    // =====================================================
    let esEstadoCuenta = false
    try {
      esEstadoCuenta = await detectarEstadoDeCuenta(uploadResult.url, user.id)
      console.log("¿Es estado de cuenta?:", esEstadoCuenta)
    } catch (err: any) {
      console.error("Error detectando estado de cuenta:", err?.message)
    }

    if (esEstadoCuenta) {
      console.log("DELEGANDO a handleEstadoDeCuenta")
      await handleEstadoDeCuenta(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, user.id)
      return
    }

    // =====================================================
    // PASO 3: Detectar si es VENTA o GASTO
    // =====================================================
    let tipoFactura: "VENTA" | "GASTO" | "ESTADO_CUENTA" | null = null

    try {
      tipoFactura = await detectarTipoFactura(uploadResult.url, user.campoId, user.id)
      console.log("Tipo detectado:", tipoFactura)
    } catch (err: any) {
      console.error("Error en detectarTipoFactura:", err?.message)
      tipoFactura = null
    }

    // Si no se detectó el tipo, preguntar al usuario
    if (!tipoFactura) {
      // Si el detector inicial dijo INCIERTO, incluir opción de foto
      const mensaje = tipoImagen === "INCIERTO"
        ? "No pude identificar el tipo de imagen. ¿Qué es?\n\n" +
          "1️⃣ *venta* - Factura de venta de animales\n" +
          "2️⃣ *gasto* - Factura de compra/gasto\n" +
          "3️⃣ *foto* - Foto de campo (observación)\n\n" +
          "Respondé: *venta*, *gasto* o *foto*"
        : "No pude leer bien esta factura. ¿Qué tipo es?\n\n" +
          "1️⃣ *venta* - Factura de venta de animales\n" +
          "2️⃣ *gasto* - Factura de compra/gasto\n\n" +
          "Respondé: *venta* o *gasto*"

      await sendWhatsAppMessage(phoneNumber, mensaje)

      await prisma.pendingConfirmation.upsert({
        where: { telefono: phoneNumber },
        create: {
          telefono: phoneNumber,
          data: JSON.stringify({
            tipo: "AWAITING_INVOICE_TYPE",
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            userId: user.id,
            caption,
            esDocumento: tipoImagen === "DOCUMENTO",
          }),
        },
        update: {
          data: JSON.stringify({
            tipo: "AWAITING_INVOICE_TYPE",
            imageUrl: uploadResult.url,
            imageName: uploadResult.fileName,
            campoId: user.campoId,
            userId: user.id,
            caption,
            esDocumento: tipoImagen === "DOCUMENTO",
          }),
        }
      })
      return
    }

    // ✅ Delegar a handler específico (NO enviar más mensajes aquí)
    if (tipoFactura === "VENTA") {
      console.log("DELEGANDO a handleVentaImage")
      await handleVentaImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption, user.id)
      return
    }

    if (tipoFactura === "GASTO") {
      console.log("DELEGANDO a handleGastoImage")
      await handleGastoImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption, user.id)
      return
    }

    console.error("tipoFactura inesperado:", tipoFactura)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando la imagen. Intenta de nuevo.")

  } catch (error) {
    console.error("Error en handleImageMessage:", error)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando tu imagen.")
  } finally {
    // Limpiar cache después de 60 segundos
    setTimeout(() => {
      delete (global as any)[cacheKey]
    }, 60000)
  }
}

/**
 * Maneja la respuesta cuando el usuario especifica manualmente el tipo de factura
 */
export async function handleAwaitingInvoiceType(
  phoneNumber: string, 
  messageText: string, 
  pendingData: any
): Promise<boolean> {
  const savedData = JSON.parse(pendingData.data)
  
  if (savedData.tipo !== "AWAITING_INVOICE_TYPE") return false

  const respuesta = messageText.toLowerCase().trim()
  
  // 🔥 NUEVO: Manejar CANCELAR
  if (respuesta === "cancelar" || respuesta === "no" || respuesta === "salir") {
    await prisma.pendingConfirmation.delete({
      where: { telefono: phoneNumber },
    }).catch(() => {})
    
    await sendWhatsAppMessage(
      phoneNumber, 
      "❌ Operación cancelada. Podés enviar otra imagen cuando quieras."
    )
    return true
  }
  
  if (respuesta.includes("venta") || respuesta === "1") {
    await sendWhatsAppMessage(phoneNumber, "Procesando como venta... 📊")
    await handleVentaImage(
      phoneNumber, 
      savedData.imageUrl, 
      savedData.imageName, 
      savedData.campoId, 
      savedData.caption
    )
    return true
  }
  
  if (respuesta.includes("gasto") || respuesta === "2") {
    await sendWhatsAppMessage(phoneNumber, "Procesando como gasto... 💰")
    await handleGastoImage(
      phoneNumber,
      savedData.imageUrl,
      savedData.imageName,
      savedData.campoId,
      savedData.caption
    )
    return true
  }

  if (respuesta.includes("foto") || respuesta.includes("observ") || respuesta === "3") {
    await sendWhatsAppMessage(phoneNumber, "Guardando como observación de campo... 📸")
    await saveObservacionFromUrl(
      phoneNumber,
      savedData.imageUrl,
      savedData.imageName,
      savedData.campoId,
      savedData.userId,
      savedData.caption
    )
    // Limpiar pending confirmation
    await prisma.pendingConfirmation.delete({
      where: { telefono: phoneNumber },
    }).catch(() => {})
    return true
  }

  // Mensaje más claro con todas las opciones
  await sendWhatsAppMessage(
    phoneNumber,
    "No entendí. Respondé:\n\n" +
    "• *venta* - factura de venta de animales\n" +
    "• *gasto* - factura de compra/gasto\n" +
    "• *foto* - foto de campo (observación)\n" +
    "• *cancelar* - para salir"
  )
  return true
}