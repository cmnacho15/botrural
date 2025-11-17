import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

/**
 * 🎫 POST - Registro mediante invitación
 * 
 * Maneja 3 tipos de registro:
 * 1. COLABORADOR: Requiere email + password → Acceso web + bot
 * 2. EMPLEADO: Solo nombre + apellido → Solo bot (sin email)
 * 3. CONTADOR: Requiere email + password → Solo lectura finanzas
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, name, apellido, email, password, telefono } = body

    console.log("📝 Registro con token:", token)

    // 🔍 Validar invitación
    const invitacion = await prisma.invitation.findUnique({
      where: { token },
      include: { campo: true },
    })

    if (!invitacion) {
      return NextResponse.json(
        { error: "Invitación no encontrada" },
        { status: 404 }
      )
    }

    if (invitacion.usedAt) {
      return NextResponse.json(
        { error: "Esta invitación ya fue utilizada" },
        { status: 400 }
      )
    }

    if (invitacion.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "La invitación ha expirado" },
        { status: 400 }
      )
    }

    // 🎯 Validaciones según tipo de invitación
    let hashedPassword: string | null = null
    let userData: any = {}

    switch (invitacion.role) {
      case "COLABORADOR":
        // Requiere: name, email, password
        if (!name || !email || !password) {
          return NextResponse.json(
            { error: "Colaborador requiere nombre, email y contraseña" },
            { status: 400 }
          )
        }

        // Verificar email único
        const existingColaborador = await prisma.user.findUnique({
          where: { email },
        })
        if (existingColaborador) {
          return NextResponse.json(
            { error: "El email ya está registrado" },
            { status: 400 }
          )
        }

        hashedPassword = await bcrypt.hash(password, 10)
        userData = {
          name,
          email,
          password: hashedPassword,
          role: "COLABORADOR",
          accesoFinanzas: false, // Por defecto sin finanzas
          campoId: invitacion.campoId, // ✅ Se une al campo del admin
        }
        break

      case "EMPLEADO":
        // Requiere: name, apellido, telefono (sin email ni password)
        if (!name || !apellido) {
          return NextResponse.json(
            { error: "Empleado requiere nombre y apellido" },
            { status: 400 }
          )
        }

        // Si viene teléfono, verificar que sea único
        if (telefono) {
          const existingPhone = await prisma.user.findUnique({
            where: { telefono },
          })
          if (existingPhone) {
            return NextResponse.json(
              { error: "El teléfono ya está registrado" },
              { status: 400 }
            )
          }
        }

        userData = {
          name,
          apellido,
          telefono: telefono || null,
          email: null, // ✅ Sin email
          password: null, // ✅ Sin password
          role: "EMPLEADO",
          accesoFinanzas: false,
          campoId: invitacion.campoId, // ✅ Se une al campo del admin
        }
        break

      case "CONTADOR":
        // Requiere: name, email, password
        if (!name || !email || !password) {
          return NextResponse.json(
            { error: "Contador requiere nombre, email y contraseña" },
            { status: 400 }
          )
        }

        // Verificar email único
        const existingContador = await prisma.user.findUnique({
          where: { email },
        })
        if (existingContador) {
          return NextResponse.json(
            { error: "El email ya está registrado" },
            { status: 400 }
          )
        }

        hashedPassword = await bcrypt.hash(password, 10)
        userData = {
          name,
          email,
          password: hashedPassword,
          role: "CONTADOR",
          accesoFinanzas: true, // ✅ Contador siempre accede a finanzas (lectura)
          campoId: invitacion.campoId, // ✅ Se une al campo del admin
        }
        break

      default:
        return NextResponse.json(
          { error: "Tipo de invitación inválido" },
          { status: 400 }
        )
    }

    // 🏗️ Crear usuario y marcar invitación como usada (transacción)
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const user = await tx.user.create({
        data: userData,
      })

      // Marcar invitación como usada
      await tx.invitation.update({
        where: { token },
        data: {
          usedAt: new Date(),
          usedById: user.id,
        },
      })

      return user
    })

    console.log(`✅ Usuario registrado: ${result.name} - Rol: ${result.role}`)
    console.log(`✅ Asignado al campo: ${invitacion.campo.nombre}`)

    return NextResponse.json(
      {
        message: "Registro exitoso",
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("💥 Error en /api/registro:", error)
    return NextResponse.json(
      { error: "Error interno al registrar usuario" },
      { status: 500 }
    )
  }
}