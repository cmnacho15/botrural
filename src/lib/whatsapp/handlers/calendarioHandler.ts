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
    // Buscar usuario
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

    // Calcular fecha programada (zona horaria Uruguay)
    const ahora = new Date()
    const fechaProgramada = new Date(ahora)
    fechaProgramada.setDate(fechaProgramada.getDate() + parsedData.diasDesdeHoy)
    
    // Resetear a medianoche Uruguay (UTC-3)
    fechaProgramada.setHours(0, 0, 0, 0)

    // Validar que no sea más de 60 días
    const diasMaximos = 90
    if (parsedData.diasDesdeHoy > diasMaximos) {
      await sendWhatsAppMessage(
        telefono,
        `⚠️ Solo podés agendar actividades hasta 90 días en el futuro.\n\n"${parsedData.titulo}" está programada para ${parsedData.diasDesdeHoy} días.`
      )
      return
    }

    // Validar que no sea en el pasado
    if (parsedData.diasDesdeHoy < 0) {
      await sendWhatsAppMessage(
        telefono,
        `⚠️ No podés agendar actividades en el pasado.`
      )
      return
    }

    // Crear la actividad
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

    // Formatear fecha para mostrar
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
    // Buscar usuario
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

    // Obtener fecha actual (inicio del día en Uruguay)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Calcular límite de 60 días
    const limite = new Date(hoy)
    limite.setDate(limite.getDate() + 60)

    // Buscar actividades pendientes
    const actividades = await prisma.actividadCalendario.findMany({
      where: {
        campoId: user.campoId,
        realizada: false,
        fechaProgramada: {
          gte: hoy,
          lte: limite
        }
      },
      orderBy: {
        fechaProgramada: 'asc'
      },
      take: 10 // Máximo 10 para no saturar el mensaje
    })

    if (actividades.length === 0) {
      await sendWhatsAppMessage(
        telefono,
        "📅 *Calendario*\n\n" +
        "No tenés actividades pendientes en los próximos 60 días.\n\n" +
        "_Podés agendar diciendo por ejemplo: \"en 5 días vacunar\"_"
      )
      return
    }

    // Formatear lista de actividades
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

    // Contar total si hay más de 10
    const total = await prisma.actividadCalendario.count({
      where: {
        campoId: user.campoId,
        realizada: false,
        fechaProgramada: {
          gte: hoy,
          lte: limite
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