import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error } = await requireMegaAdmin()
  if (error) return error

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Totales de usuarios (excluyendo MEGA_ADMIN)
    const [
      totalUsers,
      usersWithCampo,
      usersThisMonth,
      usersLast7Days,
      totalCampos,
      totalGrupos,
      totalEventos,
      totalVentas,
      totalGastos,
      eventosThisMonth,
      usersActiveToday,
      usersActiveLast7Days,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: { not: 'MEGA_ADMIN' } }
      }),
      prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          campoId: { not: null }
        }
      }),
      prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      prisma.campo.count(),
      prisma.grupo.count(),
      prisma.evento.count(),
      prisma.venta.count(),
      prisma.gasto.count(),
      prisma.evento.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          lastMessageAt: { gte: new Date(now.setHours(0, 0, 0, 0)) }
        }
      }),
      prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          lastMessageAt: { gte: sevenDaysAgo }
        }
      }),
    ])

    // Usuarios por rol
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      where: { role: { not: 'MEGA_ADMIN' } },
      _count: true
    })

    // Usuarios activos por día (últimos 30 días) - basado en lastMessageAt
    const userActivityByDay = await prisma.$queryRaw<Array<{ date: Date, count: bigint }>>`
      SELECT DATE("lastMessageAt") as date, COUNT(DISTINCT id) as count
      FROM "User"
      WHERE "lastMessageAt" >= ${thirtyDaysAgo}
        AND role != 'MEGA_ADMIN'
      GROUP BY DATE("lastMessageAt")
      ORDER BY date ASC
    `

    // Nuevos usuarios por día (últimos 30 días)
    const newUsersByDay = await prisma.$queryRaw<Array<{ date: Date, count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND role != 'MEGA_ADMIN'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    // Top 10 campos por eventos
    const topCamposByEvents = await prisma.campo.findMany({
      select: {
        id: true,
        nombre: true,
        _count: {
          select: {
            eventos: true,
            ventas: true,
            gastos: true,
            usuarios: true
          }
        }
      },
      orderBy: {
        eventos: { _count: 'desc' }
      },
      take: 10
    })

    // Eventos por tipo (últimos 30 días)
    const eventsByType = await prisma.evento.groupBy({
      by: ['tipo'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { tipo: 'desc' } },
      take: 10
    })

    // Calcular crecimiento
    const usersLastMonth = await prisma.user.count({
      where: {
        role: { not: 'MEGA_ADMIN' },
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth
        }
      }
    })

    const growthRate = usersLastMonth > 0
      ? ((usersThisMonth - usersLastMonth) / usersLastMonth * 100).toFixed(1)
      : '100'

    return NextResponse.json({
      overview: {
        totalUsers,
        usersWithCampo,
        usersWithoutCampo: totalUsers - usersWithCampo,
        usersThisMonth,
        usersLast7Days,
        usersActiveToday,
        usersActiveLast7Days,
        growthRate: parseFloat(growthRate),
        totalCampos,
        totalGrupos,
        totalEventos,
        totalVentas,
        totalGastos,
        eventosThisMonth
      },
      usersByRole: usersByRole.map(r => ({
        role: r.role,
        count: r._count
      })),
      userActivityByDay: userActivityByDay.map(d => ({
        date: d.date,
        count: Number(d.count)
      })),
      newUsersByDay: newUsersByDay.map(d => ({
        date: d.date,
        count: Number(d.count)
      })),
      topCamposByEvents: topCamposByEvents.map(c => ({
        id: c.id,
        nombre: c.nombre,
        eventos: c._count.eventos,
        ventas: c._count.ventas,
        gastos: c._count.gastos,
        usuarios: c._count.usuarios
      })),
      eventsByType: eventsByType.map(e => ({
        tipo: e.tipo,
        count: e._count
      }))
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Error obteniendo estadísticas' },
      { status: 500 }
    )
  }
}
