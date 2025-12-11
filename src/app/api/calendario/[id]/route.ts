// 📁 src/app/api/calendario/[id]/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

/**
 * PATCH - Actualizar actividad (marcar realizada O editar datos)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!user?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { realizada, titulo, fechaProgramada, notas } = body

    // Verificar que la actividad existe y pertenece al campo
    const actividad = await prisma.actividadCalendario.findFirst({
      where: {
        id,
        campoId: user.campoId
      }
    })

    if (!actividad) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      )
    }

    // 🆕 Construir objeto de actualización dinámicamente
    const dataToUpdate: any = {}

    // Caso 1: Marcar como realizada/pendiente
    if (realizada !== undefined) {
      dataToUpdate.realizada = realizada === true
      dataToUpdate.fechaRealizacion = realizada === true ? new Date() : null
    }

    // Caso 2: Editar título, fecha o notas
    if (titulo !== undefined) {
      if (!titulo.trim()) {
        return NextResponse.json(
          { error: "El título no puede estar vacío" },
          { status: 400 }
        )
      }
      dataToUpdate.titulo = titulo.trim()
    }

    if (fechaProgramada !== undefined) {
      const fecha = new Date(fechaProgramada)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      if (fecha < hoy) {
        return NextResponse.json(
          { error: "No podés agendar actividades en el pasado" },
          { status: 400 }
        )
      }

      dataToUpdate.fechaProgramada = fecha
    }

    if (notas !== undefined) {
      dataToUpdate.notas = notas?.trim() || null
    }

    // Actualizar
    const updated = await prisma.actividadCalendario.update({
      where: { id },
      data: dataToUpdate
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error("Error actualizando actividad:", error)
    return NextResponse.json(
      { error: "Error actualizando actividad" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Eliminar actividad
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!user?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    const { id } = await params

    // Verificar que la actividad existe y pertenece al campo
    const actividad = await prisma.actividadCalendario.findFirst({
      where: {
        id,
        campoId: user.campoId
      }
    })

    if (!actividad) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      )
    }

    await prisma.actividadCalendario.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error eliminando actividad:", error)
    return NextResponse.json(
      { error: "Error eliminando actividad" },
      { status: 500 }
    )
  }
}