// src/lib/whatsapp/handlers/registrationHandler.ts

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "../services/messageService"

/**
 * Verifica si un mensaje es un token de invitación
 */
export async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}

/**
 * Maneja el registro inicial con token de invitación
 */
export async function handleTokenRegistration(phone: string, token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitation) {
      await sendWhatsAppMessage(phone, "Token inválido o expirado.")
      return
    }

    if (invitation.usedAt) {
      await sendWhatsAppMessage(phone, "Este token ya fue utilizado.")
      return
    }

    if (invitation.expiresAt < new Date()) {
      await sendWhatsAppMessage(phone, "Este token expiró.")
      return
    }

    // COLABORADOR - Redirigir a web
    if (invitation.role === "COLABORADOR") {
      const existingUser = await prisma.user.findUnique({
        where: { telefono: phone },
      })

      if (existingUser) {
        await sendWhatsAppMessage(
          phone,
          "Ya estás registrado con este número."
        )
        return
      }

      await prisma.pendingRegistration.upsert({
        where: { telefono: phone },
        create: { telefono: phone, token },
        update: { token },
      })

      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`

      await sendWhatsAppMessage(
        phone,
        `¡Hola!\n\n` +
          `Bienvenido a *${invitation.campo.nombre}*\n\n` +
          `Para completar tu registro como *Colaborador*, ingresá acá:\n` +
          `${registerLink}\n\n` +
          `Una vez registrado, podrás cargar datos desde WhatsApp también!`
      )
      return
    }

    // CONTADOR - Redirigir a web
    if (invitation.role === "CONTADOR") {
      const webUrl = process.env.NEXTAUTH_URL || "https://botrural.vercel.app"
      const registerLink = `${webUrl}/register?token=${token}`
      await sendWhatsAppMessage(
        phone,
        `Hola! Para completar tu registro como Contador, ingresá acá:\n${registerLink}`
      )
      return
    }

    // EMPLEADO - Registro por WhatsApp
    if (invitation.role === "EMPLEADO") {
      const existingUser = await prisma.user.findUnique({
        where: { telefono: phone },
      })

      if (existingUser) {
        await sendWhatsAppMessage(
          phone,
          "Ya estás registrado con este número."
        )
        return
      }

      await sendWhatsAppMessage(
        phone,
        `¡Bienvenido a ${invitation.campo.nombre}!\n\n` +
          "Para completar tu registro, enviame tu nombre y apellido.\n" +
          "Ejemplo: Juan Pérez"
      )

      await prisma.pendingRegistration.upsert({
        where: { telefono: phone },
        create: { telefono: phone, token },
        update: { token },
      })
    }
  } catch (error) {
    console.error("Error en registro:", error)
    await sendWhatsAppMessage(phone, "Error al procesar el registro.")
  }
}

/**
 * Maneja el segundo paso: captura de nombre completo
 */
export async function handleNombreRegistro(
  phone: string,
  nombreCompleto: string,
  token: string
) {
  try {
    const partes = nombreCompleto.trim().split(" ")

    if (partes.length < 2) {
      await sendWhatsAppMessage(
        phone,
        "Por favor envía tu nombre y apellido completos.\nEjemplo: Juan Pérez"
      )
      return
    }

    const resultado = await registrarEmpleadoBot(
      phone,
      nombreCompleto.trim(),
      token
    )

    await sendWhatsAppMessage(
      phone,
      `¡Bienvenido ${resultado.usuario.name}!\n\n` +
        `Ya estás registrado en *${resultado.campo.nombre}*.\n\n` +
        `Ahora podés enviarme datos del campo. Por ejemplo:\n` +
        `• nacieron 3 terneros en potrero norte\n` +
        `• llovieron 25mm\n` +
        `• gasté $5000 en alimento\n` +
        `• moví 10 vacas del potrero norte al sur\n` +
        `• foto de factura`
    )
  } catch (error) {
    console.error("Error procesando nombre:", error)
    await sendWhatsAppMessage(phone, "Error al procesar el registro.")
  }
}

/**
 * Registra un empleado directamente desde el bot
 */
async function registrarEmpleadoBot(
  telefono: string,
  nombreCompleto: string,
  token: string
) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { campo: true },
  })

  if (!invitation) {
    throw new Error("Invitación no encontrada")
  }

  const timestamp = Date.now()
  const email = `empleado_${timestamp}@botrural.temp`

  const nuevoUsuario = await prisma.user.create({
    data: {
      name: nombreCompleto,
      email,
      telefono,
      role: "EMPLEADO",
      campoId: invitation.campoId,
      accesoFinanzas: false,
    },
  })

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      usedAt: new Date(),
      usedById: nuevoUsuario.id,
    },
  })

  await prisma.pendingRegistration
    .delete({
      where: { telefono },
    })
    .catch(() => {})

  return {
    usuario: nuevoUsuario,
    campo: invitation.campo,
  }
}