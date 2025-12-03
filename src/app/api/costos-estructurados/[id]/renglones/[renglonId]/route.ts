import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * PATCH - Editar una celda individual del renglón
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; renglonId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, renglonId } = params
    const body = await request.json()

    // Verificar que el costo mensual existe y pertenece al usuario
    const costoMensual = await prisma.costoMensual.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!costoMensual) {
      return NextResponse.json(
        { error: 'Costo mensual no encontrado' },
        { status: 404 }
      )
    }

    if (costoMensual.bloqueado) {
      return NextResponse.json(
        { error: 'Este mes está bloqueado y no se puede editar' },
        { status: 400 }
      )
    }

    // Verificar que el renglón existe
    const renglon = await prisma.costoRenglon.findFirst({
      where: {
        id: renglonId,
        costoMensualId: id,
      },
    })

    if (!renglon) {
      return NextResponse.json(
        { error: 'Renglón no encontrado' },
        { status: 404 }
      )
    }

    if (!renglon.editable) {
      return NextResponse.json(
        { error: 'Este renglón no se puede editar manualmente (es calculado)' },
        { status: 400 }
      )
    }

    const {
      montoTotalUSD,
      montoVacunoUSD,
      montoOvinoUSD,
      montoEquinoUSD,
      montoDesperdiciosUSD,
    } = body

    // Actualizar el renglón
    const renglonActualizado = await prisma.costoRenglon.update({
      where: { id: renglonId },
      data: {
        montoTotalUSD: montoTotalUSD ?? renglon.montoTotalUSD,
        montoVacunoUSD: montoVacunoUSD ?? renglon.montoVacunoUSD,
        montoOvinoUSD: montoOvinoUSD ?? renglon.montoOvinoUSD,
        montoEquinoUSD: montoEquinoUSD ?? renglon.montoEquinoUSD,
        montoDesperdiciosUSD: montoDesperdiciosUSD ?? renglon.montoDesperdiciosUSD,
      },
    })

    // Recalcular total de la categoría
    await recalcularTotalCategoria(id, renglon.categoria)

    return NextResponse.json(renglonActualizado)
  } catch (error) {
    console.error('Error al actualizar renglón:', error)
    return NextResponse.json(
      { error: 'Error al actualizar renglón' },
      { status: 500 }
    )
  }
}

/**
 * Helper: Recalcular total de una categoría específica
 */
async function recalcularTotalCategoria(costoMensualId: string, categoria: string) {
  const renglones = await prisma.costoRenglon.findMany({
    where: {
      costoMensualId,
      categoria,
      esTotal: false,
    },
  })

  const totales = renglones.reduce(
    (acc, r) => ({
      total: acc.total + r.montoTotalUSD,
      vacuno: acc.vacuno + r.montoVacunoUSD,
      ovino: acc.ovino + r.montoOvinoUSD,
      equino: acc.equino + r.montoEquinoUSD,
      desperdicios: acc.desperdicios + r.montoDesperdiciosUSD,
    }),
    { total: 0, vacuno: 0, ovino: 0, equino: 0, desperdicios: 0 }
  )

  await prisma.costoRenglon.updateMany({
    where: {
      costoMensualId,
      categoria,
      subcategoria: 'TOTAL',
      esTotal: true,
    },
    data: {
      montoTotalUSD: totales.total,
      montoVacunoUSD: totales.vacuno,
      montoOvinoUSD: totales.ovino,
      montoEquinoUSD: totales.equino,
      montoDesperdiciosUSD: totales.desperdicios,
    },
  })
}