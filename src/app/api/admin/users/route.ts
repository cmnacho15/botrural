import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { error } = await requireMegaAdmin()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const hasCampo = searchParams.get('hasCampo')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Construir filtros
    const where: any = {
      role: { not: 'MEGA_ADMIN' }
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } }
      ]
    }

    if (role && role !== 'all') {
      where.role = role
    }

    if (hasCampo === 'true') {
      where.campoId = { not: null }
    } else if (hasCampo === 'false') {
      where.campoId = null
    }

    // Ordenamiento
    const orderBy: any = {}
    if (sortBy === 'eventos') {
      orderBy.eventos = { _count: sortOrder }
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder
    } else if (sortBy === 'email') {
      orderBy.email = sortOrder
    } else if (sortBy === 'lastMessageAt') {
      orderBy.lastMessageAt = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          apellido: true,
          telefono: true,
          role: true,
          campoId: true,
          createdAt: true,
          lastMessageAt: true,
          lastLoginAt: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          trialEndsAt: true,
          campo: {
            select: {
              id: true,
              nombre: true,
              grupo: {
                select: { nombre: true }
              }
            }
          },
          _count: {
            select: {
              eventos: true,
              createdInvitations: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        apellido: u.apellido,
        telefono: u.telefono,
        role: u.role,
        campoId: u.campoId,
        campoNombre: u.campo?.nombre || null,
        grupoNombre: u.campo?.grupo?.nombre || null,
        createdAt: u.createdAt,
        lastMessageAt: u.lastMessageAt,
        lastLoginAt: u.lastLoginAt,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionPlan: u.subscriptionPlan,
        trialEndsAt: u.trialEndsAt,
        eventosCount: u._count.eventos,
        invitacionesCount: u._count.createdInvitations
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Error obteniendo usuarios' },
      { status: 500 }
    )
  }
}
