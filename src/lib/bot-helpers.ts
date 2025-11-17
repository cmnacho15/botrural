import { prisma } from "@/lib/prisma"

/**
 * 🟢 Registrar empleado directamente desde el bot
 */
export async function registrarEmpleadoBot(params: {
  token: string
  nombreCompleto: string
  telefono: string
}) {
  const { token, nombreCompleto, telefono } = params

  // Separar nombre completo
  const partes = nombreCompleto.trim().split(" ")
  const nombre = partes[0]
  const apellido = partes.slice(1).join(" ") || ""

  // Verificar invitación
  const invitacion = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitacion || invitacion.usedAt || invitacion.expiresAt < new Date()) {
    throw new Error("Invitación inválida o expirada")
  }

  if (invitacion.role !== "EMPLEADO") {
    throw new Error("Esta invitación no es para empleado")
  }

  // Verificar que el teléfono no esté en uso
  const existing = await prisma.user.findUnique({
    where: { telefono },
  })

  if (existing) {
    throw new Error("El teléfono ya está registrado")
  }

  // Crear usuario y marcar invitación como usada
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: `${nombre} ${apellido}`.trim(),
        apellido,
        telefono,
        email: null,
        password: null,
        role: "EMPLEADO",
        accesoFinanzas: false,
        campoId: invitacion.campoId,
        whatsappState: "ACTIVO",
      },
    })

    await tx.invitation.update({
      where: { token },
      data: {
        usedAt: new Date(),
        usedById: user.id,
      },
    })

    return user
  })

  return result
}

/**
 * 📱 Mensaje de bienvenida
 */
export function generarMensajeBienvenidaEmpleado(
  nombre: string,
  campoNombre: string
) {
  return `✅ ¡Registro exitoso!

Hola *${nombre}*, bienvenido a *${campoNombre}*.

Ya puedes usar el bot para registrar información del campo.

🎤 Enviame audios o texto — yo los convierto en datos.
📝 Comandos útiles:
- "ayuda"
- "lotes"
- "animales"

¿En qué puedo ayudarte hoy?`
}