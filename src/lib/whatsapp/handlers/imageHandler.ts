// src/lib/whatsapp/handlers/imageHandler.ts

import { prisma } from "@/lib/prisma"
import { processInvoiceImage } from "@/lib/vision-parser"
import { detectarTipoFactura, processVentaImage } from "@/lib/vision-venta-parser"
import {
  downloadWhatsAppImage,
  uploadInvoiceToSupabase,
} from "@/lib/supabase-storage"
import { sendWhatsAppMessage } from "../services/messageService"
import { sendInvoiceFlowMessage } from "./gastoHandler"
import { handleVentaImage } from "./ventaHandler"

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

    console.log("Detectando tipo de factura...", uploadResult.url)

    let tipoFactura: "VENTA" | "GASTO" | null = null

    console.log("ANTES de detectarTipoFactura")
    try {
      tipoFactura = await detectarTipoFactura(uploadResult.url)
      console.log("DESPUÉS de detectarTipoFactura - resultado:", tipoFactura)
    } catch (err: any) {
      console.error("Error en detectarTipoFactura:", err?.message)
      tipoFactura = null
    }
    
    console.log("DECISIÓN - tipoFactura vale:", tipoFactura)

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

    if (tipoFactura === "VENTA") {
      console.log("BRANCH: Procesando como VENTA")
      await handleVentaImage(phoneNumber, uploadResult.url, uploadResult.fileName, user.campoId, caption)
      return
    }

    if (tipoFactura === "GASTO") {
      console.log("BRANCH: Procesando como GASTO")
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
      return
    }

    console.error("tipoFactura inesperado:", tipoFactura)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando la imagen. Intenta de nuevo.")

  } catch (error) {
    console.error("Error en handleImageMessage:", error)
    await sendWhatsAppMessage(phoneNumber, "Ocurrió un error procesando tu imagen.")
  }
}

export async function handleAwaitingInvoiceType(
  phoneNumber: string, 
  messageText: string, 
  pendingData: any
): Promise<boolean> {
  const savedData = JSON.parse(pendingData.data)
  
  if (savedData.tipo !== "AWAITING_INVOICE_TYPE") return false

  const respuesta = messageText.toLowerCase().trim()
  
  if (respuesta.includes("venta") || respuesta === "1") {
    await sendWhatsAppMessage(phoneNumber, "Procesando como venta...")
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
    await sendWhatsAppMessage(phoneNumber, "Procesando como gasto...")
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