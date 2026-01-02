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

    // 🔥 FIX: Crear fecha en zona horaria de Montevideo para evitar desfases
const ahora = new Date()
const fechaProgramada = new Date(ahora)
fechaProgramada.setDate(fechaProgramada.getDate() + parsedData.diasDesdeHoy)
fechaProgramada.setHours(12, 0, 0, 0) // Usar mediodía para evitar problemas de timezone

    if (parsedData.diasDesdeHoy < 0) {
      await sendWhatsAppMessage(
        telefono,
        `⚠️ No podés agendar actividades en el pasado.`
      )
      return
    }

    // 🔥 MEJORA: Usar descripcion completa en las notas
    const actividad = await prisma.actividadCalendario.create({
      data: {
        campoId: user.campoId,
        usuarioId: user.id,
        titulo: parsedData.titulo,
        fechaProgramada,
        origen: "WHATSAPP",
        notas: parsedData.descripcion || `Creada por WhatsApp: "${parsedData.fechaRelativa}"`
      }
    })

    const fechaFormateada = fechaProgramada.toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Montevideo'
    })

    // 🔥 MEJORA: Mostrar descripción completa si existe
    const descripcionCompleta = parsedData.descripcion && parsedData.descripcion !== parsedData.titulo
      ? `\n📝 ${parsedData.descripcion}`
      : ""

    await sendWhatsAppButtons(
      telefono,
      `✅ *Actividad agendada*\n\n` +
      `📌 ${parsedData.titulo}` +
      descripcionCompleta +
      `\n📅 ${fechaFormateada}\n` +
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

// 🔥 NUEVO: Verificar si hay actividades lejanas (más de 7 días)
const ahora7dias = new Date(hoy)
ahora7dias.setDate(ahora7dias.getDate() + 7)

const actividadesCercanas = actividades.filter(act => {
  const fecha = new Date(act.fechaProgramada)
  return fecha <= ahora7dias
})

const actividadesLejanas = actividades.filter(act => {
  const fecha = new Date(act.fechaProgramada)
  return fecha > ahora7dias
})

// Si hay ambas, preguntar qué quiere ver
if (actividadesCercanas.length > 0 && actividadesLejanas.length > 0) {
  await prisma.pendingConfirmation.create({
    data: {
      telefono,
      data: JSON.stringify({
        tipo: "CALENDARIO_FILTRO",
        cercanas: actividadesCercanas.length,
        lejanas: actividadesLejanas.length
      })
    }
  })

  await sendWhatsAppButtons(
    telefono,
    `📅 *Calendario*\n\n` +
    `Tenés *${actividadesCercanas.length}* actividad${actividadesCercanas.length !== 1 ? 'es' : ''} en los próximos 7 días\n` +
    `y *${actividadesLejanas.length}* más adelante.\n\n` +
    `¿Qué querés ver?`,
    [
      { id: "cal_filter_7dias", title: "📍 Próximos 7 días" },
      { id: "cal_filter_todas", title: "📋 Todas" }
    ]
  )
  return
}

// Si solo hay cercanas o solo lejanas, mostrar directamente
const actividadesAMostrar = actividadesCercanas.length > 0 ? actividadesCercanas : actividades

for (const act of actividadesAMostrar) {
  // Leer directamente los componentes UTC (porque guardaste a mediodía UTC)
  const fecha = new Date(act.fechaProgramada)
  const año = fecha.getUTCFullYear()
  const mes = fecha.getUTCMonth() 
  const dia = fecha.getUTCDate()
  
  // Crear fecha local con esos componentes
  const fechaCorrecta = new Date(año, mes, dia)
  
  const diasRestantes = Math.ceil((fechaCorrecta.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  
  const fechaStr = fechaCorrecta.toLocaleDateString('es-UY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
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

      // 🔥 MEJORA: Mostrar notas si existen
      const notasTexto = act.notas ? `\n_${act.notas}_` : ""

      await sendWhatsAppButtons(
        telefono,
        `*${act.titulo}*\n${fechaStr} (${urgencia})${notasTexto}`,
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
    // 🔥 NUEVO: Manejar filtros de calendario
    if (buttonId === "cal_filter_7dias" || buttonId === "cal_filter_todas") {
      const pendiente = await prisma.pendingConfirmation.findUnique({
        where: { telefono }
      })

      if (pendiente) {
        await prisma.pendingConfirmation.delete({
          where: { telefono }
        })
      }

      const user = await prisma.user.findUnique({
        where: { telefono },
        select: { campoId: true }
      })

      if (!user?.campoId) {
        await sendWhatsAppMessage(telefono, "❌ Error: usuario no encontrado")
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
        take: buttonId === "cal_filter_7dias" ? 10 : 50
      })

      // Filtrar solo próximos 7 días si eligió esa opción
      let actividadesAMostrar = actividades
      if (buttonId === "cal_filter_7dias") {
        const limite7dias = new Date(hoy)
        limite7dias.setDate(limite7dias.getDate() + 7)
        actividadesAMostrar = actividades.filter(act => {
          const fecha = new Date(act.fechaProgramada)
          return fecha <= limite7dias
        })
      }

      // Mostrar actividades
      for (const act of actividadesAMostrar) {
        const fecha = new Date(act.fechaProgramada)
        const año = fecha.getUTCFullYear()
        const mes = fecha.getUTCMonth() 
        const dia = fecha.getUTCDate()
        const fechaCorrecta = new Date(año, mes, dia)
        
        const diasRestantes = Math.ceil((fechaCorrecta.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        
        const fechaStr = fechaCorrecta.toLocaleDateString('es-UY', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
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

        const notasTexto = act.notas ? `\n_${act.notas}_` : ""

        await sendWhatsAppButtons(
          telefono,
          `*${act.titulo}*\n${fechaStr} (${urgencia})${notasTexto}`,
          [
            { id: `cal_done_${act.id}`, title: "✅ Realizada" },
            { id: `cal_delete_${act.id}`, title: "🗑️ Eliminar" }
          ]
        )
      }

      return
    }

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
      await prisma.actividadCalendario.delete({
        where: { id: actividadId }
      })

      await sendWhatsAppMessage(
        telefono,
        `✏️ *Editando actividad*\n\n` +
        `La actividad fue eliminada.\n\n` +
        `Mandame de nuevo el mensaje completo (texto o audio) con la información correcta.\n\n` +
        `Ejemplo: "en 15 días sacar tablilla a terneros en potrero sol"`
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