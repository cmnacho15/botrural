// src/lib/whatsapp/handlers/campoHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage, sendWhatsAppButtons } from "../sendMessage"

/**
 * Muestra los campos disponibles del usuario agrupados por grupo/empresa
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

    // Obtener grupos del usuario con sus campos
    const usuarioGrupos = await prisma.usuarioGrupo.findMany({
      where: { userId: usuario.id },
      include: {
        grupo: {
          include: {
            campos: {
              select: { id: true, nombre: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Si no tiene grupos, buscar campos directamente (compatibilidad)
    if (usuarioGrupos.length === 0) {
      const usuarioCampos = await prisma.usuarioCampo.findMany({
        where: { userId: usuario.id },
        include: {
          campo: { select: { id: true, nombre: true } }
        }
      })

      if (usuarioCampos.length === 0 && usuario.campoId) {
        const campo = await prisma.campo.findUnique({
          where: { id: usuario.campoId },
          select: { nombre: true }
        })
        
        await sendWhatsAppMessage(
          telefono,
          `🏡 Tu campo actual es *${campo?.nombre || 'Sin nombre'}*.\n\nSolo tenés un campo registrado.`
        )
        return
      }

      if (usuarioCampos.length === 1) {
        await sendWhatsAppMessage(
          telefono,
          `🏡 Tu campo actual es *${usuarioCampos[0].campo.nombre}*.\n\nSolo tenés un campo registrado.`
        )
        return
      }

      // Múltiples campos sin grupos - mostrar como antes
      const camposParaMostrar = usuarioCampos.slice(0, 3)
      const buttons = camposParaMostrar.map(uc => ({
        id: `campo_${uc.campo.id}`,
        title: uc.campo.id === usuario.campoId 
          ? `✓ ${uc.campo.nombre}`.substring(0, 20)
          : uc.campo.nombre.substring(0, 20)
      }))

      await sendWhatsAppButtons(
        telefono,
        `🏡 *Tus campos*\n\nSeleccioná el campo donde querés trabajar:`,
        buttons
      )
      return
    }

    // Contar total de campos
    const totalCampos = usuarioGrupos.reduce((sum, ug) => sum + ug.grupo.campos.length, 0)

    // Si solo tiene 1 campo en total
    if (totalCampos === 1) {
      const unicoCampo = usuarioGrupos[0].grupo.campos[0]
      await sendWhatsAppMessage(
        telefono,
        `🏡 Tu campo actual es *${unicoCampo.nombre}*.\n\nSolo tenés un campo registrado.`
      )
      return
    }

    // Si tiene un solo grupo con múltiples campos
    if (usuarioGrupos.length === 1) {
      const grupo = usuarioGrupos[0].grupo
      const camposParaMostrar = grupo.campos.slice(0, 3)
      
      const buttons = camposParaMostrar.map(campo => ({
        id: `campo_${campo.id}`,
        title: campo.id === usuario.campoId 
          ? `✓ ${campo.nombre}`.substring(0, 20)
          : campo.nombre.substring(0, 20)
      }))

      const campoActual = grupo.campos.find(c => c.id === usuario.campoId)

      await sendWhatsAppButtons(
        telefono,
        `🏡 *${grupo.nombre}*\n\n` +
        `Campo actual: *${campoActual?.nombre || 'No seleccionado'}*\n\n` +
        `Seleccioná el campo donde querés trabajar:`,
        buttons
      )

      if (grupo.campos.length > 3) {
        await sendWhatsAppMessage(
          telefono,
          `ℹ️ Tenés ${grupo.campos.length} campos. Solo se muestran los primeros 3. Para ver todos, usá la web.`
        )
      }
      return
    }

    // Si tiene múltiples grupos - mostrar lista de grupos
    let mensaje = `🏢 *Tus empresas/clientes:*\n\n`
    
    usuarioGrupos.forEach((ug, index) => {
      const grupoActivo = ug.grupo.campos.some(c => c.id === usuario.campoId)
      const marca = grupoActivo ? ' ✅' : ''
      mensaje += `*${index + 1}.* ${ug.grupo.nombre}${marca}\n`
      mensaje += `   📍 ${ug.grupo.campos.length} campo${ug.grupo.campos.length > 1 ? 's' : ''}\n\n`
    })

    mensaje += `Escribí el *número* del grupo para ver sus campos.`

    // Guardar estado de que está eligiendo grupo
    await prisma.pendingConfirmation.upsert({
      where: { telefono },
      update: {
        data: JSON.stringify({
          tipo: 'CAMBIAR_GRUPO',
          grupos: usuarioGrupos.map(ug => ({
            id: ug.grupo.id,
            nombre: ug.grupo.nombre,
            campos: ug.grupo.campos
          }))
        }),
        createdAt: new Date()
      },
      create: {
        telefono,
        data: JSON.stringify({
          tipo: 'CAMBIAR_GRUPO',
          grupos: usuarioGrupos.map(ug => ({
            id: ug.grupo.id,
            nombre: ug.grupo.nombre,
            campos: ug.grupo.campos
          }))
        })
      }
    })

    await sendWhatsAppMessage(telefono, mensaje)

  } catch (error) {
    console.error("❌ Error en handleCambiarCampo:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al obtener tus campos. Intentá de nuevo."
    )
  }
}

/**
 * Procesa la selección de grupo (cuando el usuario escribe un número)
 */
export async function handleSeleccionGrupo(telefono: string, numeroGrupo: number, grupos: any[]) {
  try {
    if (numeroGrupo < 1 || numeroGrupo > grupos.length) {
      await sendWhatsAppMessage(
        telefono,
        `❌ Número inválido. Escribí un número del 1 al ${grupos.length}.`
      )
      return
    }

    const grupoSeleccionado = grupos[numeroGrupo - 1]
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!usuario) return

    // Si el grupo tiene solo 1 campo, seleccionarlo directamente
    if (grupoSeleccionado.campos.length === 1) {
      const campo = grupoSeleccionado.campos[0]
      await cambiarCampoActivo(telefono, usuario.id, campo.id, campo.nombre)
      
      // Limpiar estado
      await prisma.pendingConfirmation.delete({ where: { telefono } }).catch(() => {})
      return
    }

    // Si tiene múltiples campos, mostrar botones
    const camposParaMostrar = grupoSeleccionado.campos.slice(0, 3)
    
    const buttons = camposParaMostrar.map((campo: any) => ({
      id: `campo_${campo.id}`,
      title: campo.id === usuario.campoId 
        ? `✓ ${campo.nombre}`.substring(0, 20)
        : campo.nombre.substring(0, 20)
    }))

    await sendWhatsAppButtons(
      telefono,
      `🏡 *${grupoSeleccionado.nombre}*\n\nSeleccioná el campo:`,
      buttons
    )

    // Limpiar estado
    await prisma.pendingConfirmation.delete({ where: { telefono } }).catch(() => {})

  } catch (error) {
    console.error("❌ Error en handleSeleccionGrupo:", error)
    await sendWhatsAppMessage(telefono, "❌ Error al seleccionar grupo.")
  }
}

/**
 * Procesa la selección de campo (cuando el usuario clickea un botón)
 */
export async function handleCambiarCampoSeleccion(telefono: string, buttonId: string) {
  try {
    const campoId = buttonId.replace('campo_', '')

    const usuario = await prisma.user.findUnique({
      where: { telefono },
      select: { id: true, campoId: true }
    })

    if (!usuario) {
      await sendWhatsAppMessage(telefono, "❌ Usuario no encontrado.")
      return
    }

    // Verificar acceso y obtener nombre
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

    if (usuario.campoId === campoId) {
      await sendWhatsAppMessage(
        telefono,
        `✅ Ya estás trabajando en *${usuarioCampo.campo.nombre}*.`
      )
      return
    }

    await cambiarCampoActivo(telefono, usuario.id, campoId, usuarioCampo.campo.nombre)

  } catch (error) {
    console.error("❌ Error en handleCambiarCampoSeleccion:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Error al cambiar de campo. Intentá de nuevo."
    )
  }
}

/**
 * Función auxiliar para cambiar el campo activo
 */
async function cambiarCampoActivo(telefono: string, userId: string, campoId: string, campoNombre: string) {
  // Desactivar todos los campos del usuario
  await prisma.usuarioCampo.updateMany({
    where: { userId },
    data: { esActivo: false },
  })

  // Activar el campo seleccionado
  await prisma.usuarioCampo.updateMany({
    where: { userId, campoId },
    data: { esActivo: true },
  })

  // Actualizar User.campoId
  await prisma.user.update({
    where: { id: userId },
    data: { campoId },
  })

  // También actualizar el grupo activo
  const campo = await prisma.campo.findUnique({
    where: { id: campoId },
    select: { grupoId: true }
  })

  if (campo?.grupoId) {
    await prisma.usuarioGrupo.updateMany({
      where: { userId },
      data: { esActivo: false }
    })

    await prisma.usuarioGrupo.updateMany({
      where: { userId, grupoId: campo.grupoId },
      data: { esActivo: true }
    })
  }

  await sendWhatsAppMessage(
    telefono,
    `✅ Cambiaste al campo *${campoNombre}*.\n\nTodos los datos que cargues ahora irán a este campo.`
  )

  console.log(`✅ Usuario ${telefono} cambió al campo: ${campoNombre}`)
}