// 📁 src/app/api/calendario/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

/**
 * GET - Obtener actividades del calendario
 */
export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!user?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mostrarRealizadas = searchParams.get("realizadas") === "true"

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const inicioVencidas = new Date(hoy)
    inicioVencidas.setDate(inicioVencidas.getDate() - 7)

    const where: any = {
      campoId: user.campoId,
      fechaProgramada: {
        gte: inicioVencidas
      }
    }

    if (!mostrarRealizadas) {
      where.realizada = false
    }

    const actividades = await prisma.actividadCalendario.findMany({
      where,
      orderBy: {
        fechaProgramada: 'asc'
      },
      select: {
        id: true,
        titulo: true,
        fechaProgramada: true,
        realizada: true,
        fechaRealizacion: true,
        origen: true,
        notas: true,
        createdAt: true
      }
    })

    const actividadesConEstado = actividades.map(act => {
      const fecha = new Date(act.fechaProgramada)
      let estado: "pendiente" | "realizada" | "vencida" | "hoy" = "pendiente"
      
      if (act.realizada) {
        estado = "realizada"
      } else if (fecha < hoy) {
        estado = "vencida"
      } else if (fecha.toDateString() === hoy.toDateString()) {
        estado = "hoy"
      }

      return {
        ...act,
        estado
      }
    })

    return NextResponse.json(actividadesConEstado)

  } catch (error) {
    console.error("Error obteniendo calendario:", error)
    return NextResponse.json(
      { error: "Error obteniendo actividades" },
      { status: 500 }
    )
  }
}

/**
 * POST - Crear nueva actividad
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!user?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { titulo, fechaProgramada, notas } = body

    if (!titulo || !fechaProgramada) {
      return NextResponse.json(
        { error: "Título y fecha son requeridos" },
        { status: 400 }
      )
    }

    const fecha = new Date(fechaProgramada)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    if (fecha < hoy) {
      return NextResponse.json(
        { error: "No podés agendar actividades en el pasado" },
        { status: 400 }
      )
    }

    const actividad = await prisma.actividadCalendario.create({
      data: {
        campoId: user.campoId,
        usuarioId: user.id,
        titulo: titulo.trim(),
        fechaProgramada: fecha,
        origen: "WEB",
        notas: notas?.trim() || null
      }
    })

    return NextResponse.json(actividad, { status: 201 })

  } catch (error) {
    console.error("Error creando actividad:", error)
    return NextResponse.json(
      { error: "Error creando actividad" },
      { status: 500 }
    )
  }
}