// src/lib/whatsapp/handlers/mapaHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppImage } from "../sendMessage"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Genera la imagen del mapa usando la API interna
 */
async function generarImagenMapa(campoId: string): Promise<Buffer | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
    const url = `${baseUrl}/api/mapa-imagen?campoId=${campoId}`
    
    console.log('🗺️ Generando imagen desde:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY || 'bot-internal-key'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error generando imagen:', response.status, errorText)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)

  } catch (error) {
    console.error('❌ Error en generarImagenMapa:', error)
    return null
  }
}

/**
 * Sube la imagen a Supabase Storage
 */
async function subirImagenASupabase(imageBuffer: Buffer, nombreCampo: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `mapas/mapa_${nombreCampo.replace(/\s+/g, '_')}_${fecha}_${Date.now()}.png`

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage
      .from('invoices')
      .upload(nombreArchivo, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600'
      })

    if (error) {
      console.error('❌ Error subiendo imagen a Supabase:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(nombreArchivo)

    console.log('✅ Imagen subida a Supabase:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('❌ Error en subirImagenASupabase:', error)
    return null
  }
}

/**
 * Handler principal: genera y envía el mapa del campo
 */
export async function handleMapa(telefono: string) {
  try {
    // 1. Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      include: { campo: true }
    })

    if (!usuario?.campoId || !usuario.campo) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés un campo configurado. Configuralo primero desde la web."
      )
      return
    }

    // Verificar que hay potreros
    const cantidadPotreros = await prisma.lote.count({
      where: { campoId: usuario.campoId }
    })

    if (cantidadPotreros === 0) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés potreros registrados. Agregá potreros desde la web primero."
      )
      return
    }

    await sendWhatsAppMessage(
      telefono,
      "⏳ Generando mapa del campo... Un momento."
    )

    // 2. Generar la imagen
    const imageBuffer = await generarImagenMapa(usuario.campoId)

    if (!imageBuffer) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error generando el mapa. Intentá de nuevo más tarde."
      )
      return
    }

    // 3. Subir a Supabase
    const imageUrl = await subirImagenASupabase(imageBuffer, usuario.campo.nombre)

    if (!imageUrl) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error subiendo la imagen. Intentá de nuevo más tarde."
      )
      return
    }

    // 4. Enviar la imagen por WhatsApp
    const fecha = new Date().toLocaleDateString('es-UY', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })

    await sendWhatsAppImage(
      telefono,
      imageUrl,
      `🗺️ Mapa de ${usuario.campo.nombre}\n📅 ${fecha}`
    )

    console.log(`✅ Mapa enviado a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en handleMapa:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Hubo un error generando el mapa. Intentá de nuevo más tarde."
    )
  }
}