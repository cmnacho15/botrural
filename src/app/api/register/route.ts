import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { name, email, password, campoNombre } = await request.json()

    if (!name || !email || !password || !campoNombre) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      )
    }

    // Verificar email duplicado
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      )
    }

    // Hash
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear campo + usuario admin
    const result = await prisma.$transaction(async (tx) => {
      const campo = await tx.campo.create({
        data: { nombre: campoNombre },
      })

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "ADMIN_GENERAL",
          accesoFinanzas: true,
          campoId: campo.id,
        },
      })

      return { user, campo }
    })

    return NextResponse.json(
      {
        message: "Registro exitoso",
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("💥 Error en /api/register:", error)
    return NextResponse.json(
      { error: "Error interno al registrar usuario" },
      { status: 500 }
    )
  }
}