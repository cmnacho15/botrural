import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * Verificar si el usuario actual es MEGA_ADMIN
 */
export async function isMegaAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  return user?.role === 'MEGA_ADMIN'
}

/**
 * Middleware para rutas de API admin
 * Retorna el usuario si es MEGA_ADMIN, o un error 403
 */
export async function requireMegaAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      ),
      user: null
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })

  if (user?.role !== 'MEGA_ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol MEGA_ADMIN' },
        { status: 403 }
      ),
      user: null
    }
  }

  return { error: null, user }
}

/**
 * Crear un token de impersonación
 */
export async function createImpersonationToken(targetUserId: string, adminId: string): Promise<string> {
  // Por ahora usamos un token simple. En producción deberías usar JWT con expiración
  const token = Buffer.from(JSON.stringify({
    targetUserId,
    adminId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutos
  })).toString('base64')

  return token
}

/**
 * Log de actividad del admin
 */
export async function logAdminActivity(
  adminId: string,
  action: string,
  details?: Record<string, any>
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action,
        details: details || {},
        createdAt: new Date()
      }
    })
  } catch (error) {
    console.error('Error logging admin activity:', error)
  }
}
