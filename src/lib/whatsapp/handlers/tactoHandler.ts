// 📁 src/lib/whatsapp/handlers/tactoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../sendMessage"

/**
 * 🤚 Registrar tacto de preñez
 */
export async function handleTacto(
  telefono: string,
  parsedData: {
    potrero: string
    cantidad: number
    preñadas: number
  }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No estás registrado en ningún campo. Contactá al administrador."
      )
      return
    }

    // Buscar el potrero
    const potrero = await prisma.lote.findFirst({
      where: {
        campoId: user.campoId,
        nombre: {
          equals: parsedData.potrero,
          mode: 'insensitive'
        }
      }
    })

    if (!potrero) {
      const potrerosDisponibles = await prisma.lote.findMany({
        where: { campoId: user.campoId },
        select: { nombre: true }
      })
      const nombres = potrerosDisponibles.map(p => p.nombre).join(', ')
      
      await sendWhatsAppMessage(
        telefono,
        `❌ Potrero "${parsedData.potrero}" no encontrado.\n\n` +
        `📍 Tus potreros son: ${nombres}`
      )
      return
    }

    // Validar datos
    if (parsedData.preñadas > parsedData.cantidad) {
      await sendWhatsAppMessage(
        telefono,
        `❌ Las preñadas (${parsedData.preñadas}) no pueden ser más que las tactadas (${parsedData.cantidad})`
      )
      return
    }

    // Calcular porcentaje
    const porcentaje = Math.round((parsedData.preñadas / parsedData.cantidad) * 100)
    const falladas = parsedData.cantidad - parsedData.preñadas

    // Crear evento
    await prisma.evento.create({
      data: {
        campoId: user.campoId,
        tipo: 'TACTO',
        fecha: new Date(),
        descripcion: `Tacto en potrero ${potrero.nombre}: ${parsedData.cantidad} animales tactados, ${parsedData.preñadas} preñados (${porcentaje}% de preñez)`,
        loteId: potrero.id,
        cantidad: parsedData.cantidad,
        notas: `${parsedData.preñadas} preñadas, ${falladas} falladas`,
        creadoPor: user.id
      }
    })

    // Mensaje de confirmación
    await sendWhatsAppMessage(
      telefono,
      `✅ *Tacto registrado*\n\n` +
      `📍 Potrero: ${potrero.nombre}\n` +
      `🤚 Tactadas: ${parsedData.cantidad}\n` +
      `✅ Preñadas: ${parsedData.preñadas}\n` +
      `❌ Falladas: ${falladas}\n` +
      `📊 Preñez: ${porcentaje}%`
    )

    console.log("✅ Tacto registrado:", potrero.nombre, porcentaje + "%")

  } catch (error) {
    console.error("❌ Error registrando tacto:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el tacto. Intentá de nuevo."
    )
  }
}