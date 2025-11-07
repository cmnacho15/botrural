import { prisma } from '@/lib/prisma'

type MessageData = {
  from: string
  text: string
  type: 'text' | 'audio' | 'image'
}

export async function handleIncomingMessage(data: MessageData) {
  const { from, text, type } = data

  if (type !== 'text') {
    return { reply: 'Por ahora solo proceso mensajes de texto 📝' }
  }

  let user = await prisma.user.findUnique({
    where: { telefono: from },
    include: { campo: true }
  })

  if (!user) {
    return await handleNewUser(from, text)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastMessageAt: new Date() }
  })

  switch (user.whatsappState) {
    case 'ONBOARDING_NAME':
      return await handleOnboardingName(user, text)
    case 'ONBOARDING_EMAIL':
      return await handleOnboardingEmail(user, text)
    case 'READY':
      return await handleCommand(user, text)
    default:
      return { reply: 'Estado desconocido. Escribí "ayuda".' }
  }
}

async function handleNewUser(telefono: string, text: string) {
  const token = text.trim().toUpperCase()

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { campo: true }
  })

  if (!invitation) {
    return { reply: '❌ Código inválido. Verificá el código de invitación.' }
  }

  if (invitation.usedAt) {
    return { reply: '❌ Este código ya fue utilizado.' }
  }

  if (new Date() > invitation.expiresAt) {
    return { reply: '❌ Este código expiró. Pedí uno nuevo.' }
  }

  const user = await prisma.user.create({
    data: {
      telefono,
      role: invitation.role === 'ADMIN' ? 'ADMIN' : 'USUARIO',
      campoId: invitation.campoId,
      whatsappState: invitation.role === 'ADMIN' ? 'ONBOARDING_EMAIL' : 'ONBOARDING_NAME',
      onboardingStartedAt: new Date()
    }
  })

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { usedById: user.id, usedAt: new Date() }
  })

  if (invitation.role === 'ADMIN') {
    return {
      reply: `✅ ¡Bienvenido como administrador al campo ${invitation.campo.nombre}! 👑\n\nDecime tu correo electrónico para completar el registro.`
    }
  } else {
    return {
      reply: `✅ ¡Bienvenido al campo ${invitation.campo.nombre}! 👋\n\nPara completar tu registro, decime tu nombre y apellido.`
    }
  }
}

async function handleOnboardingName(user: any, text: string) {
  const name = text.trim()

  if (name.length < 3) {
    return { reply: 'Por favor ingresá tu nombre completo (mínimo 3 caracteres).' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      whatsappState: 'READY',
      onboardingCompletedAt: new Date()
    }
  })

  return {
    reply: `✅ Perfecto ${name}! Ya estás registrado en el campo ${user.campo.nombre}.\n\n` +
           `Podés:\n• Registrar gastos\n• Reportar lluvias\n• Consultar información\n\n` +
           `Escribí "ayuda" para ver comandos.`
  }
}

async function handleOnboardingEmail(user: any, text: string) {
  const email = text.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return { reply: 'Por favor ingresá un correo electrónico válido.' }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { reply: '❌ Este correo ya está registrado. Usá otro.' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      whatsappState: 'READY',
      onboardingCompletedAt: new Date()
    }
  })

  const webUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://botrural.vercel.app'

  return {
    reply: `✅ Perfecto! Tu cuenta de administrador fue creada.\n\n` +
           `🌐 Accedé al panel web:\n${webUrl}/login\n\n` +
           `Email: ${email}\n` +
           `Creá tu contraseña en el primer acceso.\n\n` +
           `También podés usar este bot. Escribí "ayuda".`
  }
}

async function handleCommand(user: any, text: string) {
  const lower = text.toLowerCase().trim()

  if (lower === 'ayuda' || lower === '/ayuda') {
    return {
      reply: `📋 *Comandos disponibles:*\n\n` +
             `• *ayuda* - Muestra este mensaje\n` +
             `• *estado* - Tu información\n` +
             `• *lluvia <mm>* - Registra lluvia (ej: lluvia 15)\n` +
             (user.role === 'ADMIN' ? `• *gasto <monto>* - Registra gasto\n` : '') +
             `\n💬 También podés escribirme en lenguaje natural.`
    }
  }

  if (lower === 'estado' || lower === '/estado') {
    return {
      reply: `👤 *Tu información:*\n\n` +
             `Nombre: ${user.name || 'Sin configurar'}\n` +
             `Rol: ${user.role === 'ADMIN' ? '👑 Administrador' : '👨‍🌾 Usuario'}\n` +
             `Campo: ${user.campo.nombre}\n` +
             `Registrado: ${new Date(user.createdAt).toLocaleDateString('es-UY')}`
    }
  }

  if (lower.startsWith('lluvia')) {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return { reply: 'Formato: lluvia <mm>\nEjemplo: lluvia 15' }
    }
    
    const mm = parseFloat(match[1])
    
    await prisma.evento.create({
      data: {
        tipo: 'LLUVIA',
        descripcion: `Lluvia: ${mm}mm`,
        fecha: new Date(),
        campoId: user.campoId,
        usuarioId: user.id
      }
    })
    
    return { reply: `✅ Lluvia registrada: ${mm}mm` }
  }

  return { reply: `No entendí 🤔\n\nEscribí "ayuda" para ver comandos.` }
}