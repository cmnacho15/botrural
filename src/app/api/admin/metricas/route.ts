import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error } = await requireMegaAdmin()
  if (error) return error

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Usuarios por rol (más confiable que subscriptionStatus que puede no existir)
    let usuariosPorEstado: Array<{ estado: string, cantidad: number }> = []
    let trialsPorExpirar = 0

    try {
      // Intentar usar subscriptionStatus si existe
      const estadosResult = await prisma.user.groupBy({
        by: ['subscriptionStatus'],
        where: { role: { not: 'MEGA_ADMIN' } },
        _count: true
      })
      usuariosPorEstado = estadosResult.map(e => ({
        estado: e.subscriptionStatus || 'SIN_ESTADO',
        cantidad: e._count
      }))

      trialsPorExpirar = await prisma.user.count({
        where: {
          subscriptionStatus: 'TRIAL',
          trialEndsAt: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    } catch {
      // Si subscriptionStatus no existe, usar rol como fallback
      const porRol = await prisma.user.groupBy({
        by: ['role'],
        where: { role: { not: 'MEGA_ADMIN' } },
        _count: true
      })
      usuariosPorEstado = porRol.map(r => ({
        estado: r.role,
        cantidad: r._count
      }))
    }

    // Nuevos usuarios por mes (últimos 6 meses)
    let usuariosPorMes: Array<{ mes: Date, total: number, activos: number }> = []
    try {
      const rawResult = await prisma.$queryRaw<Array<{ mes: Date, total: bigint, activos: bigint }>>`
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
      usuariosPorMes = rawResult.map(m => ({
        mes: m.mes,
        total: Number(m.total),
        activos: Number(m.activos)
      }))
    } catch {
      // Si falla la query, devolver array vacio
      usuariosPorMes = []
    }

    // Retención: usuarios que siguen activos después de 30 días de registro
    let tasaRetencion = '0'
    try {
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

      tasaRetencion = usuariosRegistradosHace30_60Dias > 0
        ? ((usuariosRetenidosHace30_60Dias / usuariosRegistradosHace30_60Dias) * 100).toFixed(1)
        : '0'
    } catch {
      tasaRetencion = '0'
    }

    // Campos por tamaño (hectáreas)
    let camposPorTamano: Array<{ rango: string, cantidad: number }> = []
    try {
      const rawCampos = await prisma.$queryRaw<Array<{ rango: string, cantidad: bigint }>>`
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
        ) as campos_con_ha
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
      camposPorTamano = rawCampos.map(c => ({
        rango: c.rango,
        cantidad: Number(c.cantidad)
      }))
    } catch {
      camposPorTamano = []
    }

    // Top campos por actividad
    let topCampos: Array<{
      id: string
      nombre: string
      createdAt: Date
      grupo: { nombre: string } | null
      _count: { usuarios: number; eventos: number; ventas: number; gastos: number; lotes: number }
    }> = []
    try {
      topCampos = await prisma.campo.findMany({
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
    } catch {
      // Si falla (ej: relaciones no existen), intentar query más simple
      try {
        const camposSimples = await prisma.campo.findMany({
          select: {
            id: true,
            nombre: true,
            createdAt: true,
            grupo: { select: { nombre: true } }
          },
          take: 15
        })
        topCampos = camposSimples.map(c => ({
          ...c,
          _count: { usuarios: 0, eventos: 0, ventas: 0, gastos: 0, lotes: 0 }
        }))
      } catch {
        topCampos = []
      }
    }

    // Calcular superficie total por campo
    let superficieMap = new Map<string, number>()
    try {
      const superficiePorCampo = await prisma.lote.groupBy({
        by: ['campoId'],
        _sum: { hectareas: true }
      })
      superficieMap = new Map(superficiePorCampo.map(s => [s.campoId, s._sum.hectareas || 0]))
    } catch {
      // Si falla, dejar el mapa vacío
    }

    // Calcular total de usuarios
    const totalUsuarios = usuariosPorEstado.reduce((sum, e) => sum + e.cantidad, 0)

    // Calcular métricas del resumen con fallbacks
    let usuariosActivos = 0
    try {
      usuariosActivos = await prisma.user.count({
        where: {
          role: { not: 'MEGA_ADMIN' },
          lastMessageAt: { gte: thirtyDaysAgo }
        }
      })
    } catch {
      // Si lastMessageAt no existe, contar usuarios recientes por createdAt
      try {
        usuariosActivos = await prisma.user.count({
          where: {
            role: { not: 'MEGA_ADMIN' },
            createdAt: { gte: thirtyDaysAgo }
          }
        })
      } catch {
        usuariosActivos = 0
      }
    }

    let totalCampos = 0
    try {
      totalCampos = await prisma.campo.count()
    } catch {
      totalCampos = 0
    }

    let totalGrupos = 0
    try {
      totalGrupos = await prisma.grupo.count()
    } catch {
      totalGrupos = 0
    }

    return NextResponse.json({
      resumen: {
        totalUsuarios,
        usuariosActivos,
        totalCampos,
        totalGrupos,
        trialsPorExpirar,
        tasaRetencion: parseFloat(tasaRetencion)
      },
      usuariosPorEstado,
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
