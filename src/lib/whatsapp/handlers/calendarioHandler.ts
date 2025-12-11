// 📁 src/lib/whatsapp/handlers/calendarioHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"

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

    // ✅ SOLO BOTÓN EDITAR - Si está mal, permite corregir TODO desde cero
    await sendWhatsAppButtons(
      telefono,
      `✅ *Actividad agendada*\n\n` +
      `📌 ${parsedData.titulo}\n` +
      `📅 ${fechaFormateada}\n` +
      `⏰ En ${parsedData.diasDesdeHoy} día${parsedData.diasDesdeHoy !== 1 ? 's' : ''}\n\n` +
      `_Si algo no es correcto, podés editarlo._`,
      [
        { id: `cal_edit_${actividad.id}`, title: "✏️ Editar" }
      ]
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
 * 📋 Consultar actividades pendientes (con botones)
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
        urgencia = `📅 En ${diasRestantes} días`
      }

      await sendWhatsAppButtons(
        telefono,
        `*${act.titulo}*\n${fechaStr} (${urgencia})`,
        [
          { id: `cal_done_${act.id}`, title: "✅ Realizada" },
          { id: `cal_delete_${act.id}`, title: "🗑️ Eliminar" }
        ]
      )
    }

  } catch (error) {
    console.error("❌ Error consultando calendario:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al consultar el calendario. Intentá de nuevo."
    )
  }
}

/**
 * 🔘 Manejar respuesta de botones del calendario
 */
export async function handleCalendarioButtonResponse(
  telefono: string,
  buttonId: string
) {
  try {
    const parts = buttonId.split('_')
    const accion = parts[1] // "done", "delete", "edit"
    const actividadId = parts[2]

    const user = await prisma.user.findUnique({
      where: { telefono },
      select: { campoId: true }
    })

    if (!user?.campoId) {
      await sendWhatsAppMessage(telefono, "❌ Error: usuario no encontrado")
      return
    }

    const actividad = await prisma.actividadCalendario.findFirst({
      where: {
        id: actividadId,
        campoId: user.campoId
      }
    })

    if (!actividad) {
      await sendWhatsAppMessage(telefono, "❌ Actividad no encontrada")
      return
    }

    // ==========================================
    // ✏️ EDITAR - Borra actividad y pide mensaje completo de nuevo
    // ==========================================
    if (accion === "edit") {
      // Borrar la actividad
      await prisma.actividadCalendario.delete({
        where: { id: actividadId }
      })

      await sendWhatsAppMessage(
        telefono,
        `✏️ *Editando actividad*\n\n` +
        `La actividad fue eliminada.\n\n` +
        `Mandame de nuevo el mensaje completo (texto o audio) con la información correcta.\n\n` +
        `Ejemplo: "en 15 días sacar tablilla"`
      )
      return
    }

    // ==========================================
    // ✅ MARCAR COMO REALIZADA
    // ==========================================
    if (accion === "done") {
      await prisma.actividadCalendario.update({
        where: { id: actividadId },
        data: {
          realizada: true,
          fechaRealizacion: new Date()
        }
      })

      await sendWhatsAppMessage(
        telefono,
        `✅ *Completada:* ${actividad.titulo}\n\n_¡Bien hecho!_`
      )
      return
    }

    // ==========================================
    // 🗑️ ELIMINAR
    // ==========================================
    if (accion === "delete") {
      await prisma.actividadCalendario.delete({
        where: { id: actividadId }
      })

      await sendWhatsAppMessage(
        telefono,
        `🗑️ *Eliminada:* ${actividad.titulo}`
      )
      return
    }

  } catch (error) {
    console.error("❌ Error procesando botón calendario:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al procesar. Intentá de nuevo."
    )
  }
}