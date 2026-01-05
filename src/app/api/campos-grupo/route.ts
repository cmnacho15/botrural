import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

/**
 * GET /api/campos-grupo
 * Retorna campos del mismo grupo con sus hectáreas
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!user?.campoId) {
      return NextResponse.json({ error: "Sin campo asignado" }, { status: 400 })
    }

    // Obtener campo actual
    const campoActual = await prisma.campo.findUnique({
      where: { id: user.campoId },
      select: { id: true, nombre: true, grupoId: true }
    })

    if (!campoActual?.grupoId) {
      // Usuario no tiene grupo (campo único)
      return NextResponse.json({
        grupoId: null,
        camposDelGrupo: []
      })
    }

    // Obtener TODOS los campos del mismo grupo
    const camposDelGrupo = await prisma.campo.findMany({
      where: { grupoId: campoActual.grupoId },
      select: {
        id: true,
        nombre: true,
        lotes: {
          select: { hectareas: true }
        }
      }
    })

    // Calcular hectáreas totales de cada campo
    const camposConHectareas = camposDelGrupo.map(campo => ({
      id: campo.id,
      nombre: campo.nombre,
      hectareas: campo.lotes.reduce((sum, l) => sum + l.hectareas, 0)
    }))

    return NextResponse.json({
      grupoId: campoActual.grupoId,
      camposDelGrupo: camposConHectareas
    })

  } catch (error) {
    console.error("Error en /api/campos-grupo:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}