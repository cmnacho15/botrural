import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * POST - Vaciar todos los datos de un campo (mantiene el campo y categorías)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { campoId, confirmacion } = await request.json()

    if (!campoId) {
      return NextResponse.json({ error: "campoId es requerido" }, { status: 400 })
    }

    if (confirmacion !== "VACIAR") {
      return NextResponse.json({ error: "Confirmación incorrecta" }, { status: 400 })
    }

    // Verificar que el usuario es ADMIN_GENERAL del campo
    const usuarioCampo = await prisma.usuarioCampo.findFirst({
      where: {
        userId: session.user.id,
        campoId: campoId,
        rol: "ADMIN_GENERAL"
      }
    })

    if (!usuarioCampo) {
      return NextResponse.json({ error: "No tenés permiso para vaciar este campo" }, { status: 403 })
    }

    // Obtener nombre del campo para el log
    const campo = await prisma.campo.findUnique({
      where: { id: campoId },
      select: { nombre: true }
    })

    // Vaciar en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Borrar traslados (origen o destino)
      await tx.traslado.deleteMany({
        where: {
          OR: [
            { campoOrigenId: campoId },
            { campoDestinoId: campoId }
          ]
        }
      })

      // 2. Borrar eventos
      await tx.evento.deleteMany({
        where: { campoId }
      })

      // 3. Borrar gastos
      await tx.gasto.deleteMany({
        where: { campoId }
      })

      // 4. Borrar ventas y sus renglones
      const ventas = await tx.venta.findMany({
        where: { campoId },
        select: { id: true }
      })
      
      if (ventas.length > 0) {
        await tx.ventaRenglon.deleteMany({
          where: { ventaId: { in: ventas.map(v => v.id) } }
        })
        await tx.venta.deleteMany({
          where: { campoId }
        })
      }

      // 5. Borrar compras y sus renglones
      const compras = await tx.compra.findMany({
        where: { campoId },
        select: { id: true }
      })
      
      if (compras.length > 0) {
        await tx.compraRenglon.deleteMany({
          where: { compraId: { in: compras.map(c => c.id) } }
        })
        await tx.compra.deleteMany({
          where: { campoId }
        })
      }

      // 6. Borrar animales de lotes
      const lotes = await tx.lote.findMany({
        where: { campoId },
        select: { id: true }
      })

      if (lotes.length > 0) {
        await tx.animalLote.deleteMany({
          where: { loteId: { in: lotes.map(l => l.id) } }
        })

        // 7. Borrar cultivos de lotes
        await tx.cultivo.deleteMany({
          where: { loteId: { in: lotes.map(l => l.id) } }
        })
      }

      // 8. Borrar lotes (potreros)
      await tx.lote.deleteMany({
        where: { campoId }
      })

      // 9. Borrar módulos de pastoreo
      await tx.moduloPastoreo.deleteMany({
        where: { campoId }
      })

      // 10. Borrar rodeos
      await tx.rodeo.deleteMany({
        where: { campoId }
      })

      // 11. Borrar insumos
      await tx.insumo.deleteMany({
        where: { campoId }
      })

      // 12. Borrar firmas
      await tx.firma.deleteMany({
        where: { campoId }
      })

      // 13. Borrar invitaciones pendientes
      await tx.invitation.deleteMany({
        where: { campoId }
      })
    })

    console.log(`🗑️ Campo vaciado: ${campo?.nombre} por usuario ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: "Campo vaciado correctamente"
    })

  } catch (error) {
    console.error("Error vaciando campo:", error)
    return NextResponse.json({ error: "Error interno al vaciar campo" }, { status: 500 })
  }
}