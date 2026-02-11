// src/app/api/admin/logs/route.ts
// API para ver y gestionar logs de errores (solo admin)

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Verificar que sea admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "MEGA_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Obtener parámetros de filtro
    const { searchParams } = new URL(request.url)
    const source = searchParams.get("source")
    const level = searchParams.get("level")
    const resolved = searchParams.get("resolved")
    const userId = searchParams.get("userId")
    const dateRange = searchParams.get("dateRange") // "24h", "7d", "30d", "all"
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Construir filtro
    const where: any = {}
    if (source) where.source = source
    if (level) where.level = level
    if (resolved !== null && resolved !== "") {
      where.resolved = resolved === "true"
    }
    if (userId) where.userId = userId

    // Filtro de fecha
    if (dateRange && dateRange !== "all") {
      const now = new Date()
      let since = new Date()
      if (dateRange === "24h") since.setHours(now.getHours() - 24)
      else if (dateRange === "7d") since.setDate(now.getDate() - 7)
      else if (dateRange === "30d") since.setDate(now.getDate() - 30)
      where.createdAt = { gte: since }
    }

    // Obtener logs
    const [logs, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { name: true, email: true, telefono: true }
          }
        }
      }),
      prisma.errorLog.count({ where })
    ])

    // Estadísticas por nivel
    const stats = await prisma.errorLog.groupBy({
      by: ["level"],
      _count: { id: true },
      where: { resolved: false }
    })

    const statsMap: Record<string, number> = {}
    stats.forEach(s => {
      statsMap[s.level] = s._count.id
    })

    // Lista de usuarios con errores (para el filtro)
    const usersWithErrors = await prisma.errorLog.groupBy({
      by: ["userId"],
      _count: { id: true },
      where: { userId: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 50
    })

    // Obtener nombres de esos usuarios
    const userIds = usersWithErrors.map(u => u.userId).filter(Boolean) as string[]
    const usersInfo = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, telefono: true, campo: { select: { nombre: true } } }
    }) : []

    const usersMap = usersInfo.map(u => ({
      id: u.id,
      label: u.name || u.email || u.telefono || "Usuario",
      campo: u.campo?.nombre || "Sin campo",
      count: usersWithErrors.find(ue => ue.userId === u.id)?._count.id || 0
    }))

    return NextResponse.json({
      logs,
      total,
      stats: statsMap,
      users: usersMap,
      pagination: {
        limit,
        offset,
        hasMore: offset + logs.length < total
      }
    })

  } catch (error) {
    console.error("Error obteniendo logs:", error)
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    )
  }
}

// PATCH para marcar como resuelto o agregar notas
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !["ADMIN", "MEGA_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { id, resolved, notes } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const updateData: any = {}
    if (resolved !== undefined) {
      updateData.resolved = resolved
      updateData.resolvedAt = resolved ? new Date() : null
      updateData.resolvedBy = resolved ? session.user.id : null
    }
    if (notes !== undefined) {
      updateData.notes = notes
    }

    const updatedLog = await prisma.errorLog.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, log: updatedLog })

  } catch (error) {
    console.error("Error actualizando log:", error)
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    )
  }
}

// DELETE para eliminar logs antiguos (solo MEGA_ADMIN)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || user.role !== "MEGA_ADMIN") {
      return NextResponse.json({ error: "Solo MEGA_ADMIN" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const olderThanDays = parseInt(searchParams.get("olderThan") || "30")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const deleted = await prisma.errorLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        resolved: true
      }
    })

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      message: `Eliminados ${deleted.count} logs resueltos de más de ${olderThanDays} días`
    })

  } catch (error) {
    console.error("Error eliminando logs:", error)
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    )
  }
}
