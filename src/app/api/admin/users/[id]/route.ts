import { NextResponse } from 'next/server'
import { requireMegaAdmin, logAdminActivity } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, user: admin } = await requireMegaAdmin()
  if (error) return error

  try {
    const userId = params.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        campo: {
          include: {
            grupo: { select: { id: true, nombre: true } },
            lotes: {
              select: {
                id: true,
                nombre: true,
                hectareas: true,
                _count: { select: { animalesLote: true } }
              }
            },
            _count: {
              select: {
                eventos: true,
                ventas: true,
                gastos: true,
                lotes: true,
                usuarios: true
              }
            }
          }
        },
        campos: {
          include: {
            campo: {
              select: {
                id: true,
                nombre: true,
                grupo: { select: { nombre: true } }
              }
            }
          }
        },
        grupos: {
          include: {
            grupo: { select: { id: true, nombre: true } }
          }
        },
        createdInvitations: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            usedAt: true,
            usedBy: {
              select: { email: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            eventos: true,
            createdInvitations: true,
            sessions: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Estadísticas de actividad
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      eventosLast30Days,
      eventosByType,
      recentEventos
    ] = await Promise.all([
      prisma.evento.count({
        where: {
          usuarioId: userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.evento.groupBy({
        by: ['tipo'],
        where: { usuarioId: userId },
        _count: true,
        orderBy: { _count: { tipo: 'desc' } },
        take: 10
      }),
      prisma.evento.findMany({
        where: { usuarioId: userId },
        select: {
          id: true,
          tipo: true,
          descripcion: true,
          fecha: true,
          createdAt: true,
          lote: { select: { nombre: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ])

    // Calcular hectáreas totales
    const totalHectareas = user.campo?.lotes.reduce((sum, l) => sum + l.hectareas, 0) || 0

    // Log de la acción
    await logAdminActivity(admin!.id, 'VIEW_USER_DETAIL', {
      targetUserId: userId,
      targetUserEmail: user.email
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        apellido: user.apellido,
        telefono: user.telefono,
        role: user.role,
        accesoFinanzas: user.accesoFinanzas,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastMessageAt: user.lastMessageAt,
        lastLoginAt: user.lastLoginAt,
        whatsappState: user.whatsappState,
        onboardingStartedAt: user.onboardingStartedAt,
        onboardingCompletedAt: user.onboardingCompletedAt,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt
      },
      campo: user.campo ? {
        id: user.campo.id,
        nombre: user.campo.nombre,
        tipoCampo: user.campo.tipoCampo,
        grupo: user.campo.grupo,
        stats: {
          eventos: user.campo._count.eventos,
          ventas: user.campo._count.ventas,
          gastos: user.campo._count.gastos,
          lotes: user.campo._count.lotes,
          usuarios: user.campo._count.usuarios,
          hectareas: totalHectareas
        },
        lotes: user.campo.lotes.map(l => ({
          id: l.id,
          nombre: l.nombre,
          hectareas: l.hectareas,
          animales: l._count.animalesLote
        }))
      } : null,
      otrosCampos: user.campos.map(uc => ({
        id: uc.campo.id,
        nombre: uc.campo.nombre,
        grupo: uc.campo.grupo?.nombre,
        rol: uc.rol,
        esActivo: uc.esActivo
      })),
      grupos: user.grupos.map(ug => ({
        id: ug.grupo.id,
        nombre: ug.grupo.nombre,
        rol: ug.rol,
        esActivo: ug.esActivo
      })),
      activity: {
        totalEventos: user._count.eventos,
        eventosLast30Days,
        invitacionesCreadas: user._count.createdInvitations,
        sesionesActivas: user._count.sessions,
        eventosByType: eventosByType.map(e => ({
          tipo: e.tipo,
          count: e._count
        })),
        recentEventos: recentEventos.map(e => ({
          id: e.id,
          tipo: e.tipo,
          descripcion: e.descripcion?.substring(0, 100),
          fecha: e.fecha,
          createdAt: e.createdAt,
          lote: e.lote?.nombre
        }))
      },
      invitaciones: user.createdInvitations.map(inv => ({
        id: inv.id,
        role: inv.role,
        createdAt: inv.createdAt,
        usedAt: inv.usedAt,
        usedBy: inv.usedBy ? {
          email: inv.usedBy.email,
          name: inv.usedBy.name
        } : null
      }))
    })
  } catch (error) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json(
      { error: 'Error obteniendo detalle del usuario' },
      { status: 500 }
    )
  }
}

// PATCH para actualizar usuario
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error, user: admin } = await requireMegaAdmin()
  if (error) return error

  try {
    const userId = params.id
    const body = await request.json()

    // Campos permitidos para actualizar
    const allowedFields = [
      'subscriptionStatus',
      'subscriptionPlan',
      'trialEndsAt',
      'subscriptionEndsAt',
      'role'
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field.includes('At') && body[field]) {
          updateData[field] = new Date(body[field])
        } else {
          updateData[field] = body[field]
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        trialEndsAt: true,
        role: true
      }
    })

    // Log de la acción
    await logAdminActivity(admin!.id, 'UPDATE_USER', {
      targetUserId: userId,
      changes: updateData
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Error actualizando usuario' },
      { status: 500 }
    )
  }
}
