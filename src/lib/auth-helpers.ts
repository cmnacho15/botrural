//src/lib/auth-helpers.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { NextResponse } from "next/server"


// ✅ AGREGAR ESTA LÍNEA
export { authOptions }

/**
 * 🔐 requireAuth()
 * Obtiene la sesión y devuelve el usuario completo desde Prisma
 */
export async function requireAuth() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return {
        error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
        user: null,
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return {
        error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 }),
        user: null,
      }
    }

    return { error: null, user }
  } catch (err) {
    console.error("Error en requireAuth:", err)
    return {
      error: NextResponse.json({ error: "Error de autenticación" }, { status: 500 }),
      user: null,
    }
  }
}

/**
 * 📘 Puede acceder a finanzas:
 * ADMIN_GENERAL
 * COLABORADOR (si accesoFinanzas = true)
 * CONTADOR
 */
export function canAccessFinanzas(user: any) {
  if (!user) return false

  if (user.role === Role.ADMIN_GENERAL) return true
  if (user.role === Role.CONTADOR) return true
  if (user.role === Role.COLABORADOR && user.accesoFinanzas === true) return true

  return false
}

/**
 * ✏️ Puede escribir finanzas:
 * ADMIN_GENERAL
 * COLABORADOR con accesoFinanzas=true
 */
export function canWriteFinanzas(user: any) {
  if (!user) return false

  if (user.role === Role.ADMIN_GENERAL) return true
  if (user.role === Role.COLABORADOR && user.accesoFinanzas === true) return true

  return false
}