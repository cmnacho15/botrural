// src/lib/whatsapp/handlers/observacionHandler.ts
// Handler para procesar fotos de observaciones de campo (no facturas)

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../services/messageService"
import { uploadObservacionToSupabase } from "@/lib/supabase-storage"

/**
 * Guarda una observación de campo con foto
 */
export async function handleObservacionImage(
  phoneNumber: string,
  imageBuffer: Buffer,
  mimeType: string,
  campoId: string,
  userId: string,
  caption: string
) {
  console.log("INICIO handleObservacionImage")

  try {
    // Subir imagen a Supabase
    const uploadResult = await uploadObservacionToSupabase(imageBuffer, mimeType, campoId)

    if (!uploadResult) {
      await sendWhatsAppMessage(phoneNumber, "Error guardando la foto. Intenta de nuevo.")
      return
    }

    // Crear evento de tipo OBSERVACION
    const evento = await prisma.evento.create({
      data: {
        tipo: "OBSERVACION",
        descripcion: caption || "Observación de campo",
        fecha: new Date(),
        campoId,
        usuarioId: userId,
        imageUrl: uploadResult.url,
        metadata: {
          imageName: uploadResult.fileName,
          captionOriginal: caption,
        },
      },
    })

    console.log("Observación guardada:", evento.id)

    await sendWhatsAppMessage(
      phoneNumber,
      `📸 *Observación guardada*\n\n` +
      `📝 ${caption || "(Sin descripción)"}\n` +
      `📅 ${new Date().toLocaleDateString("es-UY")}\n\n` +
      `Podés verla en la sección de Datos de la app.`
    )

  } catch (error) {
    console.error("Error en handleObservacionImage:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la observación. Intenta de nuevo.")
  }
}

/**
 * Guarda una observación cuando ya tenemos la URL de la imagen subida
 */
export async function saveObservacionFromUrl(
  phoneNumber: string,
  imageUrl: string,
  imageName: string,
  campoId: string,
  userId: string,
  caption: string
) {
  console.log("INICIO saveObservacionFromUrl")

  try {
    const evento = await prisma.evento.create({
      data: {
        tipo: "OBSERVACION",
        descripcion: caption || "Observación de campo",
        fecha: new Date(),
        campoId,
        usuarioId: userId,
        imageUrl: imageUrl,
        metadata: {
          imageName: imageName,
          captionOriginal: caption,
        },
      },
    })

    console.log("Observación guardada:", evento.id)

    await sendWhatsAppMessage(
      phoneNumber,
      `📸 *Observación guardada*\n\n` +
      `📝 ${caption || "(Sin descripción)"}\n` +
      `📅 ${new Date().toLocaleDateString("es-UY")}\n\n` +
      `Podés verla en la sección de Datos de la app.`
    )

    return true
  } catch (error) {
    console.error("Error en saveObservacionFromUrl:", error)
    await sendWhatsAppMessage(phoneNumber, "Error guardando la observación. Intenta de nuevo.")
    return false
  }
}
