import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { registrarEmpleadoBot, generarMensajeBienvenidaEmpleado } from "@/lib/bot-helpers"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { telefono, mensaje } = body

    if (!telefono || !mensaje) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 })
    }

    const msg = mensaje.trim()

    // =======================================================
    // 1) Buscar usuario por teléfono
    // =======================================================
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      include: { campo: true },
    })

    // =======================================================
    // 2) Intentar interpretar mensaje como TOKEN de invitación
    // =======================================================
    const invitacion = await prisma.invitation.findUnique({
      where: { token: msg },
      include: { campo: true },
    })

    if (invitacion && !invitacion.usedAt && invitacion.expiresAt > new Date()) {

      // ❌ Si el número ya pertenece a un usuario → error
      if (usuario) {
        return NextResponse.json({
          success: false,
          respuesta: `⚠️ Este número ya está registrado.`,
        })
      }

      // COLABORADOR → Registro web
      if (invitacion.role === "COLABORADOR") {
        const url = `${process.env.NEXTAUTH_URL}/register?token=${msg}`

        return NextResponse.json({
          success: true,
          respuesta: `✅ ¡Invitación válida!

Bienvenido a *${invitacion.campo.nombre}*

Completá tu registro como *Colaborador* aquí:
🔗 ${url}`,
        })
      }

      // EMPLEADO → inicia flujo de nombre
      if (invitacion.role === "EMPLEADO") {
        // Guardamos estado temporal del token para este teléfono
        await prisma.pendingRegistration.upsert({
          where: { telefono },
          create: { telefono, token: msg },
          update: { token: msg },
        })

        return NextResponse.json({
          success: true,
          respuesta: `👋 Bienvenido a *${invitacion.campo.nombre}*

Para completar tu registro como *Empleado*, enviame tu *nombre y apellido*:

Ejemplo: Juan Pérez`,
        })
      }

      // CONTADOR → no va por bot
      return NextResponse.json({
        success: false,
        respuesta: `⚠️ Los contadores deben registrarse usando el link web.`,
      })
    }

    // =======================================================
    // 3) Si el teléfono está en proceso de registro de empleado
    // =======================================================
    const pendiente = await prisma.pendingRegistration.findUnique({
      where: { telefono },
    })

    if (pendiente) {
      // Validar nombre y apellido
const partes = msg.trim().split(" ")

if (partes.length < 2) {
  return NextResponse.json({
    success: false,
    respuesta: `⚠️ Debes enviar nombre y apellido. Ej: Juan Pérez`,
  })
}

// Primer palabra = nombre
const nombre = partes.shift()!
// El resto = apellido
const apellido = partes.join(" ")

const nuevoEmpleado = await registrarEmpleadoBot({
  token: pendiente.token,
  nombreCompleto: `${nombre} ${apellido}`,
  telefono,
})

      const invit = await prisma.invitation.findUnique({
        where: { token: pendiente.token },
        include: { campo: true },
      })

      // Borrar registro temporal
      await prisma.pendingRegistration.delete({
        where: { telefono },
      })

      return NextResponse.json({
        success: true,
        respuesta: generarMensajeBienvenidaEmpleado(
          nuevoEmpleado.name,
          invit?.campo.nombre || ""
        ),
      })
    }

    // =======================================================
    // 4) Usuario ya registrado
    // =======================================================
    if (usuario) {
      return NextResponse.json({
        success: true,
        respuesta: `Hola ${usuario.name}! ¿En qué puedo ayudarte hoy?`,
      })
    }

    // =======================================================
    // 5) Número desconocido
    // =======================================================
    return NextResponse.json({
      success: false,
      respuesta: `⚠️ No estás registrado.

Pedile a tu administrador un *código de invitación* y enviámelo por aquí.`,
    })

  } catch (err) {
    console.error("💥 Error en bot-webhook:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}