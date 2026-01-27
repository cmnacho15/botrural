import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error } = await requireMegaAdmin()
  if (error) return error

  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Usuarios activos en el bot (por lastMessageAt)
    const [
      usuariosActivosHoy,
      usuariosActivos7d,
      usuariosActivos30d,
      totalUsuariosConTelefono,
      usuariosPorEstadoBot
    ] = await Promise.all([
      prisma.user.count({
        where: {
          telefono: { not: null },
          lastMessageAt: { gte: today }
        }
      }),
      prisma.user.count({
        where: {
          telefono: { not: null },
          lastMessageAt: { gte: sevenDaysAgo }
        }
      }),
      prisma.user.count({
        where: {
          telefono: { not: null },
          lastMessageAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.user.count({
        where: { telefono: { not: null } }
      }),
      prisma.user.groupBy({
        by: ['whatsappState'],
        where: { telefono: { not: null } },
        _count: true
      })
    ])

    // Top 10 usuarios más activos (por eventos creados en últimos 30 días)
    const topUsuarios = await prisma.user.findMany({
      where: {
        telefono: { not: null },
        lastMessageAt: { gte: thirtyDaysAgo }
      },
      select: {
        id: true,
        name: true,
        telefono: true,
        lastMessageAt: true,
        whatsappState: true,
        campo: { select: { nombre: true } },
        _count: {
          select: { eventos: true }
        }
      },
      orderBy: {
        eventos: { _count: 'desc' }
      },
      take: 10
    })

    // Actividad por día (últimos 30 días) - usuarios únicos que enviaron mensaje
    const actividadPorDia = await prisma.$queryRaw<Array<{ date: Date, count: bigint }>>`
      SELECT DATE("lastMessageAt") as date, COUNT(DISTINCT id) as count
      FROM "User"
      WHERE "lastMessageAt" >= ${thirtyDaysAgo}
        AND "telefono" IS NOT NULL
      GROUP BY DATE("lastMessageAt")
      ORDER BY date ASC
    `

    // Eventos creados vía bot (últimos 30 días) - asumiendo que tienen usuarioId con teléfono
    const eventosPorTipo = await prisma.evento.groupBy({
      by: ['tipo'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        usuario: { telefono: { not: null } }
      },
      _count: true,
      orderBy: { _count: { tipo: 'desc' } },
      take: 10
    })

    // Usuarios recientes con actividad
    const usuariosRecientes = await prisma.user.findMany({
      where: {
        telefono: { not: null },
        lastMessageAt: { not: null }
      },
      select: {
        id: true,
        name: true,
        telefono: true,
        lastMessageAt: true,
        whatsappState: true,
        campo: { select: { nombre: true } }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 20
    })

    return NextResponse.json({
      resumen: {
        usuariosActivosHoy,
        usuariosActivos7d,
        usuariosActivos30d,
        totalUsuariosConTelefono,
        tasaActivacion7d: totalUsuariosConTelefono > 0
          ? ((usuariosActivos7d / totalUsuariosConTelefono) * 100).toFixed(1)
          : '0'
      },
      estadosBot: usuariosPorEstadoBot.map(e => ({
        estado: e.whatsappState || 'IDLE',
        cantidad: e._count
      })),
      topUsuarios: topUsuarios.map(u => ({
        id: u.id,
        nombre: u.name || 'Sin nombre',
        telefono: u.telefono,
        campo: u.campo?.nombre || 'Sin campo',
        eventos: u._count.eventos,
        ultimaActividad: u.lastMessageAt,
        estado: u.whatsappState
      })),
      actividadPorDia: actividadPorDia.map(d => ({
        fecha: d.date,
        usuarios: Number(d.count)
      })),
      eventosPorTipo: eventosPorTipo.map(e => ({
        tipo: e.tipo,
        cantidad: e._count
      })),
      usuariosRecientes: usuariosRecientes.map(u => ({
        id: u.id,
        nombre: u.name || 'Sin nombre',
        telefono: u.telefono,
        campo: u.campo?.nombre || 'Sin campo',
        ultimaActividad: u.lastMessageAt,
        estado: u.whatsappState
      }))
    })
  } catch (error) {
    console.error('Error fetching WhatsApp stats:', error)
    return NextResponse.json(
      { error: 'Error obteniendo estadísticas de WhatsApp' },
      { status: 500 }
    )
  }
}
