// src/lib/whatsapp/handlers/imageHandler.ts

import { prisma } from "@/lib/prisma"
import { detectarTipoFactura, detectarEstadoDeCuenta } from "@/lib/vision-venta-parser"
import {
  downloadWhatsAppImage,
  uploadInvoiceToSupabase,
} from "@/lib/supabase-storage"
import { sendWhatsAppMessage } from "../services/messageService"
import { handleGastoImage } from "./gastoHandler"
import { handleVentaImage } from "./ventaHandler"
import { handleEstadoDeCuenta } from "./pagoHandler"

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

    console.log("Detectando tipo de documento...", uploadResult.url)

    // PASO 1: Detectar si es un estado de cuenta
    let esEstadoCuenta = false
    try {
      esEstadoCuenta = await detectarEstadoDeCuenta(uploadResult.url, user.id)
      console.log("¿Es estado de cuenta?:", esEstadoCuenta)
    } catch (err: any) {
      console.error("Error detectando estado de cuenta:", err?.message)
    }

    if (esEstadoCuenta) {
      console.log("DELEGANDO a handleEstadoDeCuenta")
      await handleEstadoDeCuenta(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId)
      return
    }

    // PASO 2: Detectar si es VENTA o GASTO
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

  // 🔥 MEJORADO: Mensaje más claro con opción de cancelar
  await sendWhatsAppMessage(
    phoneNumber, 
    "No entendí. Respondé:\n\n• *venta* - factura de venta de animales\n• *gasto* - factura de compra/gasto\n• *cancelar* - para salir"
  )
  return true
}