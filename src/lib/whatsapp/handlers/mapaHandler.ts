// src/lib/whatsapp/handlers/mapaHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../sendMessage"

/**
 * Handler principal: envía link al mapa interactivo en la web
 * Nota: Generar imágenes de mapas server-side requiere APIs externas costosas.
 * Es mejor que el usuario vea el mapa interactivo completo en la web.
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

    // Obtener resumen de potreros
    const potreros = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      select: { nombre: true, hectareas: true }
    })

    const totalHa = potreros.reduce((sum, p) => sum + (p.hectareas || 0), 0)

    // Armar mensaje con info del campo y link a la web
    let mensaje = `🗺️ *Mapa de ${usuario.campo.nombre}*\n\n`
    mensaje += `📍 *${cantidadPotreros} potreros* | ${totalHa.toFixed(0)} ha totales\n\n`

    // Listar potreros
    mensaje += `*Potreros:*\n`
    for (const p of potreros.slice(0, 10)) {
      mensaje += `• ${p.nombre}${p.hectareas ? ` (${p.hectareas} ha)` : ''}\n`
    }
    if (potreros.length > 10) {
      mensaje += `_...y ${potreros.length - 10} más_\n`
    }

    mensaje += `\n🌐 *Ver mapa interactivo:*\n`
    mensaje += `botrural.vercel.app/dashboard/mapa`

    await sendWhatsAppMessage(telefono, mensaje)

    console.log(`✅ Info de mapa enviada a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en handleMapa:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Hubo un error. Intentá de nuevo más tarde."
    )
  }
}