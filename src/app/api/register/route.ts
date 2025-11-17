import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

/**
 * 🚀 POST - Registro del primer usuario (ADMIN_GENERAL)
 * 
 * Este endpoint solo debe usarse para crear el PRIMER usuario del sistema.
 * Verifica que no existan usuarios previos antes de crear.
 */
export async function POST(request: Request) {
  try {
    const { name, email, password, campoNombre } = await request.json()

    // 🔒 Validaciones
    if (!name || !email || !password || !campoNombre) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      )
    }

    // 🔍 Verificar que no exista ningún usuario en el sistema
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: "El sistema ya tiene usuarios registrados. Use el sistema de invitaciones." },
        { status: 403 }
      )
    }

    // 🔍 Verificar que el email no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      )
    }

    // 🔐 Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // 🏗️ Crear campo y usuario ADMIN_GENERAL en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear campo
      const campo = await tx.campo.create({
        data: { nombre: campoNombre },
      })

      // Crear usuario ADMIN_GENERAL
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "ADMIN_GENERAL",
          accesoFinanzas: true, // ✅ Admin siempre tiene acceso a finanzas
          campoId: campo.id,
        },
      })

      return { user, campo }
    })

    console.log(`✅ Primer usuario creado: ${result.user.email} (ADMIN_GENERAL)`)
    console.log(`✅ Campo creado: ${result.campo.nombre}`)

    return NextResponse.json(
      {
        message: "Registro exitoso como Administrador General",
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