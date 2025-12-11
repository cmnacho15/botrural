// 📁 src/lib/whatsapp/handlers/calendarioHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../sendMessage"

/**
 * 📅 Crear actividad en el calendario
 */
export async function handleCalendarioCrear(
  telefono: string,
  parsedData: {
    titulo: string
    diasDesdeHoy: number
    fechaRelativa: string
    descripcion: string
  }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true, name: true }
    })

    if (!user || !user.campoId) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No estás registrado en ningún campo. Contactá al administrador."
      )
      return
    }

    const ahora = new Date()
    const fechaProgramada = new Date(ahora)
    fechaProgramada.setDate(fechaProgramada.getDate() + parsedData.diasDesdeHoy)
    fechaProgramada.setHours(0, 0, 0, 0)

    if (parsedData.diasDesdeHoy < 0) {
      await sendWhatsAppMessage(
        telefono,
        `⚠️ No podés agendar actividades en el pasado.`
      )
      return
    }

    const actividad = await prisma.actividadCalendario.create({
      data: {
        campoId: user.campoId,
        usuarioId: user.id,
        titulo: parsedData.titulo,
        fechaProgramada,
        origen: "WHATSAPP",
        notas: `Creada por WhatsApp: "${parsedData.fechaRelativa}"`
      }
    })

    const fechaFormateada = fechaProgramada.toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Montevideo'
    })

    await sendWhatsAppMessage(
      telefono,
      `✅ *Actividad agendada*\n\n` +
      `📌 ${parsedData.titulo}\n` +
      `📅 ${fechaFormateada}\n` +
      `⏰ En ${parsedData.diasDesdeHoy} día${parsedData.diasDesdeHoy !== 1 ? 's' : ''}\n\n` +
      `_Podés ver y marcar como realizada desde la web._`
    )

    console.log("✅ Actividad creada:", actividad.id)

  } catch (error) {
    console.error("❌ Error creando actividad:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al agendar la actividad. Intentá de nuevo."
    )
  }
}

/**
 * 📋 Consultar actividades pendientes
 */
export async function handleCalendarioConsultar(telefono: string) {
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

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const actividades = await prisma.actividadCalendario.findMany({
      where: {
        campoId: user.campoId,
        realizada: false,
        fechaProgramada: {
          gte: hoy
        }
      },
      orderBy: {
        fechaProgramada: 'asc'
      },
      take: 10
    })

    if (actividades.length === 0) {
      await sendWhatsAppMessage(
        telefono,
        "📅 *Calendario*\n\n" +
        "No tenés actividades pendientes.\n\n" +
        "_Podés agendar diciendo por ejemplo: \"en 5 días vacunar\"_"
      )
      return
    }

    let mensaje = "📅 *Actividades pendientes*\n\n"

    for (const act of actividades) {
      const fecha = new Date(act.fechaProgramada)
      const diasRestantes = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      
      const fechaStr = fecha.toLocaleDateString('es-UY', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Montevideo'
      })

      let urgencia = ""
      if (diasRestantes === 0) {
        urgencia = "🔴 HOY"
      } else if (diasRestantes === 1) {
        urgencia = "🟠 Mañana"
      } else if (diasRestantes <= 3) {
        urgencia = `🟡 En ${diasRestantes} días`
      } else {
        urgencia = `En ${diasRestantes} días`
      }

      mensaje += `• *${act.titulo}*\n  ${fechaStr} (${urgencia})\n\n`
    }

    const total = await prisma.actividadCalendario.count({
      where: {
        campoId: user.campoId,
        realizada: false,
        fechaProgramada: {
          gte: hoy
        }
      }
    })

    if (total > 10) {
      mensaje += `_...y ${total - 10} más. Consultá la web para ver todas._`
    } else {
      mensaje += `_Para marcar como realizada, entrá a la web._`
    }

    await sendWhatsAppMessage(telefono, mensaje)

  } catch (error) {
    console.error("❌ Error consultando calendario:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al consultar el calendario. Intentá de nuevo."
    )
  }
}