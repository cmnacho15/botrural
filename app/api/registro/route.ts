import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { token, name, email, password } = await request.json()

    // Validar invitación
    const invitacion = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitacion || invitacion.usedAt || invitacion.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitación inválida o expirada" }, { status: 400 })
    }

    // Crear usuario según rol
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null
    const user = await prisma.user.create({
      data: {
        name,
        email: email || null,
        password: hashedPassword,
        role: invitacion.role,
        campoId: invitacion.campoId,
      },
    })

    // Marcar invitación como usada
    await prisma.invitation.update({
      where: { token },
      data: { usedAt: new Date(), usedById: user.id },
    })

    return NextResponse.json({ message: "Registro exitoso ✅", user })
  } catch (error) {
    console.error("💥 Error en /api/registro:", error)
    return NextResponse.json({ error: "Error interno al registrar usuario" }, { status: 500 })
  }
}
