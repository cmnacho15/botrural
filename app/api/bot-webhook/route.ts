import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = body?.message?.text?.trim() || ""
    console.log("📩 Mensaje recibido:", message)

    // Buscar token en el mensaje (ej: RODAZO-ABC123)
    const tokenMatch = message.match(/[A-Z0-9]{6,}/)
    if (!tokenMatch) {
      return NextResponse.json({
        reply: "No reconozco un código de invitación válido 😅.",
      })
    }

    const token = tokenMatch[0]

    // Buscar invitación por token
    const invitacion = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitacion) {
      return NextResponse.json({
        reply: "El enlace de invitación no es válido o ha expirado ❌.",
      })
    }

    // Diferenciar por rol
    if (invitacion.role === "USUARIO") {
      return NextResponse.json({
        reply: `👋 Hola! Sos parte del campo ${invitacion.campo.nombre}. 
Por favor escribime tu *nombre y apellido* para registrarte.`,
        nextAction: "pedir_nombre",
        token,
      })
    }

    if (invitacion.role === "ADMIN") {
      const url = `https://fielddata.app/registrarse?token=${token}`
      return NextResponse.json({
        reply: `👋 Bienvenido! Vas a registrarte como *Administrador* del campo ${invitacion.campo.nombre}.
Por seguridad, completá tu registro en este enlace seguro:
${url}`,
        nextAction: "abrir_web",
      })
    }

    return NextResponse.json({ reply: "Algo salió mal al procesar tu invitación 😕" })
  } catch (error) {
    console.error("💥 Error en bot-webhook:", error)
    return NextResponse.json({ reply: "Ocurrió un error al procesar tu mensaje 😔" })
  }
}