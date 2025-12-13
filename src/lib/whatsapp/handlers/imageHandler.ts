// src/lib/whatsapp/handlers/imageHandler.ts

import { prisma } from "@/lib/prisma"
import { detectarTipoFactura } from "@/lib/vision-venta-parser"
import {
  downloadWhatsAppImage,
  uploadInvoiceToSupabase,
} from "@/lib/supabase-storage"
import { sendWhatsAppMessage } from "../services/messageService"
import { handleGastoImage } from "./gastoHandler"
import { handleVentaImage } from "./ventaHandler"

/**
 * Punto de entrada principal para procesar imágenes (facturas)
 * NO envía mensajes duplicados - delega a handlers específicos
 */
export async function handleImageMessage(message: any, phoneNumber: string) {
  console.log("INICIO handleImageMessage - phoneNumber:", phoneNumber)
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

    console.log("Detectando tipo de factura...", uploadResult.url)

    let tipoFactura: "VENTA" | "GASTO" | null = null

    try {
      tipoFactura = await detectarTipoFactura(uploadResult.url)
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
      await handleVentaImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption)
      return
    }

    if (tipoFactura === "GASTO") {
      console.log("DELEGANDO a handleGastoImage")
      await handleGastoImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption)
      return
    }

    console.error("tipoFactura inesperado:", tipoFactura)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando la imagen. Intenta de nuevo.")

  } catch (error) {
    console.error("Error en handleImageMessage:", error)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando tu imagen.")
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
  
  if (respuesta.includes("venta") || respuesta === "1") {
  await sendWhatsAppMessage(phoneNumber, "Procesando como venta... 📊")
  // NO borrar aquí - handleVentaImage creará su propio pending
  await handleVentaImage(
    phoneNumber, 
    savedData.imageUrl, 
    savedData.imageName, 
    savedData.campoId, 
    savedData.caption
  )
  // Borrado movido después de handleVentaImage
  return true
}
  
  if (respuesta.includes("gasto") || respuesta === "2") {
  await sendWhatsAppMessage(phoneNumber, "Procesando como gasto... 💰")
  // NO borrar aquí - handleGastoImage creará su propio pending
  await handleGastoImage(
    phoneNumber,
    savedData.imageUrl,
    savedData.imageName,
    savedData.campoId,
    savedData.caption
  )
  // Borrado movido después de handleGastoImage
  return true
}

  await sendWhatsAppMessage(
    phoneNumber, 
    "No entendí. Respondé *venta* o *gasto*"
  )
  return true
}