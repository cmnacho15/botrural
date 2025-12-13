import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canWriteFinanzas } from "@/lib/auth-helpers"

/**
 * DELETE /api/ventas/[id]
 * Eliminar venta y revertir stock
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar ventas" },
        { status: 403 }
      )
    }

    const ventaId = params.id

    // Verificar que la venta pertenece al campo del usuario
    const venta = await prisma.venta.findUnique({
  where: { id: ventaId },
  include: {
    renglones: {
      include: {
        animalLote: {
          include: {
            lote: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    }
  }
})

    if (!venta) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      )
    }

    if (venta.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar esta venta" },
        { status: 403 }
      )
    }

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      // 1. REVERTIR STOCK - Devolver animales a los potreros
      for (const renglon of venta.renglones) {
        if (renglon.descontadoDeStock && renglon.animalLoteId) {
          // Buscar si existe el animalLote
          const animalLote = await tx.animalLote.findUnique({
            where: { id: renglon.animalLoteId }
          })

          if (animalLote) {
            // Si existe, sumar la cantidad
            await tx.animalLote.update({
              where: { id: renglon.animalLoteId },
              data: {
                cantidad: animalLote.cantidad + renglon.cantidad
              }
            })
          } else {
            // Si fue eliminado, recrearlo
            // Necesitamos el loteId del animalLote original
            const animalLoteOriginal = renglon.animalLote
            if (animalLoteOriginal) {
              await tx.animalLote.create({
                data: {
                  loteId: animalLoteOriginal.loteId,
                  categoria: renglon.categoria,
                  cantidad: renglon.cantidad,
                  peso: renglon.pesoPromedio
                }
              })
            }
          }
        }
      }

      // 2. ELIMINAR EVENTO asociado
      await tx.evento.deleteMany({
        where: {
          tipo: 'VENTA',
          campoId: venta.campoId,
          comprador: venta.comprador,
          fecha: venta.fecha,
          monto: venta.totalNetoUSD
        }
      })

      // 3. ELIMINAR RENGLONES
      await tx.ventaRenglon.deleteMany({
        where: { ventaId }
      })

      // 4. ELIMINAR VENTA
      await tx.venta.delete({
        where: { id: ventaId }
      })
    })

    // TODO: Si hay imagen en storage, eliminarla también
    // if (venta.imageUrl) {
    //   await deleteFromStorage(venta.imageUrl)
    // }

    return NextResponse.json({ success: true, message: "Venta eliminada correctamente" })

  } catch (error: any) {
    console.error("Error eliminando venta:", error)
    return NextResponse.json(
      { error: error.message || "Error eliminando venta" },
      { status: 500 }
    )
  }
}