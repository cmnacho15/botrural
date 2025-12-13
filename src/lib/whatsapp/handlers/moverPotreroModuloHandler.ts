// src/lib/whatsapp/handlers/moverPotreroModuloHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppMessageWithButtons } from "../services/messageService"

/**
 * Maneja la solicitud de mover un potrero a un módulo
 */
export async function handleMoverPotreroModulo(telefono: string, data: any) {
  try {
    // Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true },
    })

    if (!usuario?.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No encontré tu usuario. ¿Ya te registraste?"
      )
      return
    }

    // Buscar el potrero
    const potrero = await prisma.lote.findFirst({
      where: {
        campoId: usuario.campoId,
        nombre: {
          equals: data.nombrePotrero,
          mode: "insensitive",
        },
      },
      include: {
        moduloPastoreo: {
          select: { nombre: true },
        },
      },
    })

    if (!potrero) {
      await sendWhatsAppMessage(
        telefono,
        `❌ No encontré el potrero "${data.nombrePotrero}" en tu campo.`
      )
      return
    }

    // Buscar el módulo destino
    const moduloDestino = await prisma.moduloPastoreo.findFirst({
      where: {
        campoId: usuario.campoId,
        nombre: {
          equals: data.moduloDestino,
          mode: "insensitive",
        },
      },
    })

    if (!moduloDestino) {
      await sendWhatsAppMessage(
        telefono,
        `❌ No encontré el módulo "${data.moduloDestino}".`
      )
      return
    }

    // Verificar si ya está en ese módulo
    if (potrero.moduloPastoreoId === moduloDestino.id) {
      await sendWhatsAppMessage(
        telefono,
        `ℹ️ El potrero "${potrero.nombre}" ya está en el módulo "${moduloDestino.nombre}".`
      )
      return
    }

    // Crear confirmación pendiente
    await prisma.pendingConfirmation.create({
      data: {
        telefono,
        data: JSON.stringify({
          tipo: "MOVER_POTRERO_MODULO",
          potreroId: potrero.id,
          nombrePotrero: potrero.nombre,
          moduloDestinoId: moduloDestino.id,
          moduloDestino: moduloDestino.nombre,
          moduloOrigen: potrero.moduloPastoreo?.nombre || "Sin módulo",
        }),
      },
    })

    // Enviar mensaje de confirmación
    let mensaje = `📋 *Entendí:*\n\n`
    mensaje += `*Mover Potrero a Módulo*\n`
    mensaje += `• Potrero: ${potrero.nombre}\n`
    mensaje += `• Módulo actual: ${potrero.moduloPastoreo?.nombre || "Sin módulo"}\n`
    mensaje += `• Módulo destino: ${moduloDestino.nombre}`

    await sendWhatsAppMessageWithButtons(telefono, mensaje)

  } catch (error) {
    console.error("❌ Error en handleMoverPotreroModulo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error procesando tu solicitud. Intenta de nuevo."
    )
  }
}

/**
 * Ejecuta el movimiento del potrero al módulo (tras confirmación)
 */
export async function handleMoverPotreroModuloConfirmacion(data: any) {
  try {
    await prisma.lote.update({
      where: { id: data.potreroId },
      data: { moduloPastoreoId: data.moduloDestinoId },
    })

    console.log(
      `✅ Potrero "${data.nombrePotrero}" movido a módulo "${data.moduloDestino}"`
    )
  } catch (error) {
    console.error("❌ Error moviendo potrero:", error)
    throw error
  }
}