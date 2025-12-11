// 📁 src/app/api/calendario/[id]/route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

/**
 * PATCH - Marcar actividad como realizada/pendiente
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
    const { realizada } = body

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

    // Actualizar
    const updated = await prisma.actividadCalendario.update({
      where: { id },
      data: {
        realizada: realizada === true,
        fechaRealizacion: realizada === true ? new Date() : null
      }
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