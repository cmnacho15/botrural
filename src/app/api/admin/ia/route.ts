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

    // Resumen general
    const [
      totalRequests,
      requestsHoy,
      requests7d,
      requests30d,
      totalTokens,
      tokensHoy,
      tokens7d,
      tokens30d,
      totalCost,
      costHoy,
      cost7d,
      cost30d
    ] = await Promise.all([
      prisma.aIUsage.count(),
      prisma.aIUsage.count({ where: { createdAt: { gte: today } } }),
      prisma.aIUsage.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.aIUsage.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.aIUsage.aggregate({ _sum: { totalTokens: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: today } }, _sum: { totalTokens: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: sevenDaysAgo } }, _sum: { totalTokens: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: thirtyDaysAgo } }, _sum: { totalTokens: true } }),
      prisma.aIUsage.aggregate({ _sum: { costUSD: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: today } }, _sum: { costUSD: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: sevenDaysAgo } }, _sum: { costUSD: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: thirtyDaysAgo } }, _sum: { costUSD: true } })
    ])

    // Por proveedor
    const porProveedor = await prisma.aIUsage.groupBy({
      by: ['provider'],
      _count: true,
      _sum: {
        totalTokens: true,
        costUSD: true
      }
    })

    // Por feature
    const porFeature = await prisma.aIUsage.groupBy({
      by: ['feature'],
      _count: true,
      _sum: {
        totalTokens: true,
        costUSD: true
      },
      orderBy: { _count: { feature: 'desc' } }
    })

    // Por modelo
    const porModelo = await prisma.aIUsage.groupBy({
      by: ['model'],
      _count: true,
      _sum: {
        totalTokens: true,
        costUSD: true
      },
      orderBy: { _sum: { totalTokens: 'desc' } }
    })

    // Top usuarios por consumo (ultimos 30 dias)
    const topUsuarios = await prisma.aIUsage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      _sum: {
        totalTokens: true,
        costUSD: true
      },
      orderBy: { _sum: { totalTokens: 'desc' } },
      take: 10
    })

    // Obtener nombres de usuarios
    const userIds = topUsuarios.map(u => u.userId)
    const usuarios = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, campo: { select: { nombre: true } } }
    })
    const usuarioMap = new Map(usuarios.map(u => [u.id, u]))

    // Consumo por dia (ultimos 30 dias)
    const consumoPorDia = await prisma.$queryRaw<Array<{ fecha: Date, requests: bigint, tokens: bigint, costo: number }>>`
      SELECT
        DATE("createdAt") as fecha,
        COUNT(*) as requests,
        COALESCE(SUM("totalTokens"), 0) as tokens,
        COALESCE(SUM("costUSD"), 0) as costo
      FROM "AIUsage"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY fecha ASC
    `

    // Feature labels
    const featureLabels: Record<string, string> = {
      FACTURA_PARSER: 'Parser de Facturas',
      BOT_RESPONSE: 'Respuestas Bot',
      VENTA_PARSER: 'Parser de Ventas',
      GASTO_PARSER: 'Parser de Gastos',
      CHAT_ASSISTANT: 'Asistente Chat',
      DOCUMENT_OCR: 'OCR Documentos',
      DATA_ANALYSIS: 'Analisis de Datos',
      IMPORTACION_GASTOS_ANALISIS: 'Importación de Gastos (Análisis)',
      IMPORTACION_GASTOS_CLASIFICACION: 'Importación de Gastos (Clasificación)'
    }

    return NextResponse.json({
      resumen: {
        totalRequests,
        requestsHoy,
        requests7d,
        requests30d,
        totalTokens: totalTokens._sum.totalTokens || 0,
        tokensHoy: tokensHoy._sum.totalTokens || 0,
        tokens7d: tokens7d._sum.totalTokens || 0,
        tokens30d: tokens30d._sum.totalTokens || 0,
        totalCostUSD: totalCost._sum.costUSD || 0,
        costHoyUSD: costHoy._sum.costUSD || 0,
        cost7dUSD: cost7d._sum.costUSD || 0,
        cost30dUSD: cost30d._sum.costUSD || 0
      },
      porProveedor: porProveedor.map(p => ({
        provider: p.provider,
        requests: p._count,
        tokens: p._sum.totalTokens || 0,
        costUSD: p._sum.costUSD || 0
      })),
      porFeature: porFeature.map(f => ({
        feature: f.feature,
        label: featureLabels[f.feature] || f.feature,
        requests: f._count,
        tokens: f._sum.totalTokens || 0,
        costUSD: f._sum.costUSD || 0
      })),
      porModelo: porModelo.map(m => ({
        model: m.model,
        requests: m._count,
        tokens: m._sum.totalTokens || 0,
        costUSD: m._sum.costUSD || 0
      })),
      topUsuarios: topUsuarios.map(u => {
        const usuario = usuarioMap.get(u.userId)
        return {
          id: u.userId,
          nombre: usuario?.name || 'Usuario',
          email: usuario?.email || '',
          campo: usuario?.campo?.nombre || 'Sin campo',
          requests: u._count,
          tokens: u._sum.totalTokens || 0,
          costUSD: u._sum.costUSD || 0
        }
      }),
      consumoPorDia: consumoPorDia.map(d => ({
        fecha: d.fecha,
        requests: Number(d.requests),
        tokens: Number(d.tokens),
        costoUSD: Number(d.costo)
      }))
    })
  } catch (error) {
    console.error('Error fetching IA stats:', error)
    return NextResponse.json(
      { error: 'Error obteniendo estadisticas de IA' },
      { status: 500 }
    )
  }
}
