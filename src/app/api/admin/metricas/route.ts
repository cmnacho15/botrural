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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Usuarios por estado de suscripción
    const usuariosPorEstado = await prisma.user.groupBy({
      by: ['subscriptionStatus'],
      where: { role: { not: 'MEGA_ADMIN' } },
      _count: true
    })

    // Usuarios en trial que expiran pronto (próximos 7 días)
    const trialsPorExpirar = await prisma.user.count({
      where: {
        subscriptionStatus: 'TRIAL',
        trialEndsAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    })

    // Conversiones trial → pago (usuarios con subscriptionStatus = ACTIVE que alguna vez fueron TRIAL)
    // Por ahora simulamos basado en ADMIN_GENERAL con campo
    const totalAdminsConCampo = await prisma.user.count({
      where: {
        role: 'ADMIN_GENERAL',
        campoId: { not: null }
      }
    })

    // Nuevos usuarios por mes (últimos 6 meses)
    const usuariosPorMes = await prisma.$queryRaw<Array<{ mes: Date, total: bigint, activos: bigint }>>`
      SELECT
        DATE_TRUNC('month', "createdAt") as mes,
        COUNT(*) as total,
        COUNT(CASE WHEN "lastMessageAt" > NOW() - INTERVAL '30 days' THEN 1 END) as activos
      FROM "User"
      WHERE "createdAt" > NOW() - INTERVAL '6 months'
        AND "role" != 'MEGA_ADMIN'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY mes ASC
    `

    // Retención: usuarios que siguen activos después de 30 días de registro
    const usuariosRegistradosHace30_60Dias = await prisma.user.count({
      where: {
        role: { not: 'MEGA_ADMIN' },
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo
        }
      }
    })

    const usuariosRetenidosHace30_60Dias = await prisma.user.count({
      where: {
        role: { not: 'MEGA_ADMIN' },
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo
        },
        lastMessageAt: { gte: thirtyDaysAgo }
      }
    })

    const tasaRetencion = usuariosRegistradosHace30_60Dias > 0
      ? ((usuariosRetenidosHace30_60Dias / usuariosRegistradosHace30_60Dias) * 100).toFixed(1)
      : '0'

    // Campos por tamaño (hectáreas)
    const camposPorTamano = await prisma.$queryRaw<Array<{ rango: string, cantidad: bigint }>>`
      SELECT
        CASE
          WHEN total_ha < 100 THEN '< 100 ha'
          WHEN total_ha < 500 THEN '100-500 ha'
          WHEN total_ha < 1000 THEN '500-1000 ha'
          WHEN total_ha < 5000 THEN '1000-5000 ha'
          ELSE '> 5000 ha'
        END as rango,
        COUNT(*) as cantidad
      FROM (
        SELECT c.id, COALESCE(SUM(l."hectareas"), 0) as total_ha
        FROM "Campo" c
        LEFT JOIN "Lote" l ON l."campoId" = c.id
        GROUP BY c.id
      ) campos_con_ha
      GROUP BY rango
      ORDER BY
        CASE rango
          WHEN '< 100 ha' THEN 1
          WHEN '100-500 ha' THEN 2
          WHEN '500-1000 ha' THEN 3
          WHEN '1000-5000 ha' THEN 4
          ELSE 5
        END
    `

    // Top campos por actividad
    const topCampos = await prisma.campo.findMany({
      select: {
        id: true,
        nombre: true,
        createdAt: true,
        grupo: { select: { nombre: true } },
        _count: {
          select: {
            usuarios: true,
            eventos: true,
            ventas: true,
            gastos: true,
            lotes: true
          }
        }
      },
      orderBy: { eventos: { _count: 'desc' } },
      take: 15
    })

    // Calcular superficie total por campo
    const superficiePorCampo = await prisma.lote.groupBy({
      by: ['campoId'],
      _sum: { hectareas: true }
    })
    const superficieMap = new Map(superficiePorCampo.map(s => [s.campoId, s._sum.hectareas || 0]))

    return NextResponse.json({
      resumen: {
        totalUsuarios: usuariosPorEstado.reduce((sum, e) => sum + e._count, 0),
        usuariosActivos: await prisma.user.count({
          where: {
            role: { not: 'MEGA_ADMIN' },
            lastMessageAt: { gte: thirtyDaysAgo }
          }
        }),
        totalCampos: await prisma.campo.count(),
        totalGrupos: await prisma.grupo.count(),
        trialsPorExpirar,
        tasaRetencion: parseFloat(tasaRetencion)
      },
      usuariosPorEstado: usuariosPorEstado.map(e => ({
        estado: e.subscriptionStatus || 'SIN_ESTADO',
        cantidad: e._count
      })),
      usuariosPorMes: usuariosPorMes.map(m => ({
        mes: m.mes,
        total: Number(m.total),
        activos: Number(m.activos)
      })),
      camposPorTamano: camposPorTamano.map(c => ({
        rango: c.rango,
        cantidad: Number(c.cantidad)
      })),
      topCampos: topCampos.map(c => ({
        id: c.id,
        nombre: c.nombre,
        grupo: c.grupo?.nombre || null,
        createdAt: c.createdAt,
        usuarios: c._count.usuarios,
        eventos: c._count.eventos,
        ventas: c._count.ventas,
        gastos: c._count.gastos,
        lotes: c._count.lotes,
        hectareas: superficieMap.get(c.id) || 0
      }))
    })
  } catch (error) {
    console.error('Error fetching business metrics:', error)
    return NextResponse.json(
      { error: 'Error obteniendo métricas de negocio' },
      { status: 500 }
    )
  }
}
