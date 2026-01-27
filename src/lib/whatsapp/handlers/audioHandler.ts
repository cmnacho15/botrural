// src/lib/whatsapp/handlers/audioHandler.ts

import { transcribeAudio } from "@/lib/openai-parser"
import { sendWhatsAppMessage } from "../services/messageService"

/**
 * Procesa mensajes de audio de WhatsApp
 * - Descarga el audio
 * - Transcribe con Whisper
 * - Retorna el texto transcrito
 */
export async function handleAudioMessage(
  message: any,
  from: string,
  userId?: string
): Promise<string | null> {
  try {
    const audioId = message.audio?.id

    if (!audioId) {
      await sendWhatsAppMessage(from, "No pude procesar el audio. Intenta de nuevo.")
      return null
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
      return null
    }

    const mediaData = await mediaResponse.json()
    const audioUrl = mediaData.url

    // Transcribir audio
    await sendWhatsAppMessage(from, "Procesando audio...")

    const transcription = await transcribeAudio(audioUrl, userId)

    if (!transcription) {
      await sendWhatsAppMessage(from, "No pude entender el audio. Intenta de nuevo.")
      return null
    }

    console.log(`Audio transcrito de ${from}: ${transcription}`)
    return transcription

  } catch (error) {
    console.error("Error en handleAudioMessage:", error)
    await sendWhatsAppMessage(from, "Error procesando el audio.")
    return null
  }
}