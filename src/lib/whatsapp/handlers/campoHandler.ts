// src/lib/whatsapp/handlers/campoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"

/**
 * Muestra los campos disponibles del usuario
 */
export async function handleCambiarCampo(telefono: string) {
  try {
    // Buscar usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, name: true, campoId: true }
    })

    if (!usuario) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No estás registrado. Enviá tu código de invitación para registrarte."
      )
      return
    }

    // Obtener campos del usuario desde UsuarioCampo
    const usuarioCampos = await prisma.usuarioCampo.findMany({
      where: { userId: usuario.id },
      include: {
        campo: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Si no tiene registros en UsuarioCampo, usar el campoId directo (compatibilidad)
    if (usuarioCampos.length === 0 && usuario.campoId) {
      const campo = await prisma.campo.findUnique({
        where: { id: usuario.campoId },
        select: { nombre: true }
      })
      
      await sendWhatsAppMessage(
        telefono,
        `🏡 Tu campo actual es *${campo?.nombre || 'Sin nombre'}*.\n\n` +
        `Solo tenés un campo registrado.`
      )
      return
    }

    if (usuarioCampos.length === 0) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés campos asociados a tu cuenta."
      )
      return
    }

    // Si solo tiene 1 campo
    if (usuarioCampos.length === 1) {
      await sendWhatsAppMessage(
        telefono,
        `🏡 Tu campo actual es *${usuarioCampos[0].campo.nombre}*.\n\n` +
        `Solo tenés un campo registrado.`
      )
      return
    }

    // Si tiene múltiples campos, mostrar botones (máximo 3)
    const campoActualId = usuario.campoId
    const camposParaMostrar = usuarioCampos.slice(0, 3)

    const buttons = camposParaMostrar.map(uc => ({
      id: `campo_${uc.campo.id}`,
      title: uc.campo.id === campoActualId 
        ? `✓ ${uc.campo.nombre}`.substring(0, 20)
        : uc.campo.nombre.substring(0, 20)
    }))

    const campoActual = usuarioCampos.find(uc => uc.campo.id === campoActualId)
    
    await sendWhatsAppButtons(
      telefono,
      `🏡 *Tus campos*\n\n` +
      `Campo actual: *${campoActual?.campo.nombre || 'No seleccionado'}*\n\n` +
      `Seleccioná el campo donde querés trabajar:`,
      buttons
    )

    // Si tiene más de 3 campos, avisar
    if (usuarioCampos.length > 3) {
      await sendWhatsAppMessage(
        telefono,
        `ℹ️ Tenés ${usuarioCampos.length} campos. Solo se muestran los primeros 3. ` +
        `Para ver todos, usá la web.`
      )
    }

  } catch (error) {
    console.error("❌ Error en handleCambiarCampo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al obtener tus campos. Intentá de nuevo."
    )
  }
}

/**
 * Procesa la selección de campo (cuando el usuario clickea un botón)
 */
export async function handleCambiarCampoSeleccion(telefono: string, buttonId: string) {
  try {
    // buttonId tiene formato: campo_<campoId>
    const campoId = buttonId.replace('campo_', '')

    // Buscar usuario
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!usuario) {
      await sendWhatsAppMessage(telefono, "❌ Usuario no encontrado.")
      return
    }

    // Verificar que el usuario tiene acceso a ese campo
    const usuarioCampo = await prisma.usuarioCampo.findFirst({
      where: {
        userId: usuario.id,
        campoId: campoId,
      },
      include: {
        campo: true,
      },
    })

    if (!usuarioCampo) {
      await sendWhatsAppMessage(telefono, "❌ No tenés acceso a ese campo.")
      return
    }

    // Si ya está en ese campo
    if (usuario.campoId === campoId) {
      await sendWhatsAppMessage(
        telefono,
        `✅ Ya estás trabajando en *${usuarioCampo.campo.nombre}*.`
      )
      return
    }

    // Desactivar todos los campos del usuario
    await prisma.usuarioCampo.updateMany({
      where: { userId: usuario.id },
      data: { esActivo: false },
    })

    // Activar el campo seleccionado
    await prisma.usuarioCampo.updateMany({
      where: {
        userId: usuario.id,
        campoId: campoId,
      },
      data: { esActivo: true },
    })

    // Actualizar User.campoId para compatibilidad
    await prisma.user.update({
      where: { id: usuario.id },
      data: { campoId: campoId },
    })

    await sendWhatsAppMessage(
      telefono,
      `✅ Cambiaste al campo *${usuarioCampo.campo.nombre}*.\n\n` +
      `Todos los datos que cargues ahora irán a este campo.`
    )

    console.log(`✅ Usuario ${telefono} cambió al campo: ${usuarioCampo.campo.nombre}`)

  } catch (error) {
    console.error("❌ Error en handleCambiarCampoSeleccion:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al cambiar de campo. Intentá de nuevo."
    )
  }
}