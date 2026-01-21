import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canWriteFinanzas } from "@/lib/auth-helpers"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const { cultivo, precioTonelada, asignaciones } = await request.json()
    const ventaId = params.id

    // Eliminar asignaciones anteriores si existen
    await prisma.servicioGrano.deleteMany({
      where: { ventaId }
    })

    // Crear nuevas asignaciones
    for (const asig of asignaciones) {
      const lote = await prisma.lote.findUnique({
        where: { id: asig.loteId },
        select: { nombre: true, hectareas: true }
      })

      if (!lote) continue

      await prisma.servicioGrano.create({
        data: {
          ventaId,
          cultivo,
          loteId: asig.loteId,
          loteNombre: lote.nombre,
          hectareas: lote.hectareas,
          toneladas: asig.toneladas,
          precioTonelada,
          precioTotalUSD: asig.toneladas * precioTonelada,
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Error guardando" }, { status: 500 })
  }
}