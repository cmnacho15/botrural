// 📁 src/lib/whatsapp/handlers/tactoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"

/**
 * 🤚 Solicitar confirmación para registrar tacto
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

    // Guardar en pending confirmation
    await prisma.pendingConfirmation.upsert({
      where: { telefono },
      create: {
        telefono,
        data: JSON.stringify({
          tipo: 'TACTO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          cantidad: parsedData.cantidad,
          preñadas: parsedData.preñadas,
          falladas: falladas,
          porcentaje: porcentaje,
          campoId: user.campoId,
          usuarioId: user.id
        })
      },
      update: {
        data: JSON.stringify({
          tipo: 'TACTO',
          potrero: potrero.nombre,
          potreroId: potrero.id,
          cantidad: parsedData.cantidad,
          preñadas: parsedData.preñadas,
          falladas: falladas,
          porcentaje: porcentaje,
          campoId: user.campoId,
          usuarioId: user.id
        })
      }
    })

    // Enviar mensaje con botones
    const mensaje = 
      `🤚 *Tacto - Confirmá los datos*\n\n` +
      `📍 Potrero: ${potrero.nombre}\n` +
      `🤚 Tactadas: ${parsedData.cantidad}\n` +
      `✅ Preñadas: ${parsedData.preñadas} (${porcentaje}%)\n` +
      `❌ Falladas: ${falladas}\n\n` +
      `_Escribí "editar" para modificar o clickeá confirmar_`

    await sendWhatsAppButtons(
      telefono,
      mensaje,
      [
        { id: 'confirmar_tacto', title: '✅ Confirmar' },
        { id: 'cancelar', title: '❌ Cancelar' }
      ]
    )

    console.log("✅ Solicitud de confirmación tacto enviada")

  } catch (error) {
    console.error("❌ Error solicitando confirmación tacto:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar el tacto. Intentá de nuevo."
    )
  }
}

/**
 * 🤚 Confirmar y registrar el tacto
 */
export async function confirmarTacto(telefono: string, data: any) {
  try {
    const { potreroId, potrero, cantidad, preñadas, falladas, porcentaje, campoId, usuarioId } = data

    // Crear evento
    await prisma.evento.create({
      data: {
        campoId,
        tipo: 'TACTO',
        fecha: new Date(),
        descripcion: `Tacto en potrero ${potrero}: ${cantidad} animales tactados, ${preñadas} preñados (${porcentaje}% de preñez)`,
        loteId: potreroId,
        cantidad: cantidad,
        notas: `${preñadas} preñadas, ${falladas} falladas`,
        usuarioId
      }
    })

    // Mensaje de confirmación
    await sendWhatsAppMessage(
      telefono,
      `✅ *Tacto registrado correctamente*\n\n` +
      `📍 Potrero: ${potrero}\n` +
      `🤚 Tactadas: ${cantidad}\n` +
      `📊 Preñez: ${porcentaje}%`
    )

    console.log("✅ Tacto registrado:", potrero, porcentaje + "%")

  } catch (error) {
    console.error("❌ Error confirmando tacto:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al registrar el tacto. Intentá de nuevo."
    )
  }
}