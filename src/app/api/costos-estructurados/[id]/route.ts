import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * GET - Obtener detalle de un mes específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params

    const costoMensual = await prisma.costoMensual.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
      include: {
        renglones: {
          orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
        },
      },
    })

    if (!costoMensual) {
      return NextResponse.json(
        { error: 'Costo mensual no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(costoMensual)
  } catch (error) {
    console.error('Error al obtener costo mensual:', error)
    return NextResponse.json(
      { error: 'Error al obtener costo mensual' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Editar hectáreas u otras propiedades del mes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Verificar que existe y pertenece al usuario
    const costoExistente = await prisma.costoMensual.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!costoExistente) {
      return NextResponse.json(
        { error: 'Costo mensual no encontrado' },
        { status: 404 }
      )
    }

    if (costoExistente.bloqueado) {
      return NextResponse.json(
        { error: 'Este mes está bloqueado y no se puede editar' },
        { status: 400 }
      )
    }

    const {
      hectareasVacuno,
      hectareasOvino,
      hectareasEquino,
      hectareasDesperdicios,
      notas,
      bloqueado,
    } = body

    // Calcular nuevo total si se modifican hectáreas
    let hectareasTotal = costoExistente.hectareasTotal
    if (
      hectareasVacuno !== undefined ||
      hectareasOvino !== undefined ||
      hectareasEquino !== undefined ||
      hectareasDesperdicios !== undefined
    ) {
      hectareasTotal =
        (hectareasVacuno ?? costoExistente.hectareasVacuno) +
        (hectareasOvino ?? costoExistente.hectareasOvino) +
        (hectareasEquino ?? costoExistente.hectareasEquino) +
        (hectareasDesperdicios ?? costoExistente.hectareasDesperdicios)
    }

    const costoActualizado = await prisma.costoMensual.update({
      where: { id },
      data: {
        hectareasVacuno: hectareasVacuno ?? costoExistente.hectareasVacuno,
        hectareasOvino: hectareasOvino ?? costoExistente.hectareasOvino,
        hectareasEquino: hectareasEquino ?? costoExistente.hectareasEquino,
        hectareasDesperdicios: hectareasDesperdicios ?? costoExistente.hectareasDesperdicios,
        hectareasTotal,
        notas: notas ?? costoExistente.notas,
        bloqueado: bloqueado ?? costoExistente.bloqueado,
      },
      include: {
        renglones: {
          orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
        },
      },
    })

    return NextResponse.json(costoActualizado)
  } catch (error) {
    console.error('Error al actualizar costo mensual:', error)
    return NextResponse.json(
      { error: 'Error al actualizar costo mensual' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Eliminar un mes completo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params

    const costoExistente = await prisma.costoMensual.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!costoExistente) {
      return NextResponse.json(
        { error: 'Costo mensual no encontrado' },
        { status: 404 }
      )
    }

    if (costoExistente.bloqueado) {
      return NextResponse.json(
        { error: 'Este mes está bloqueado y no se puede eliminar' },
        { status: 400 }
      )
    }

    // Eliminar (los renglones se eliminan en cascada)
    await prisma.costoMensual.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Costo mensual eliminado exitosamente',
    })
  } catch (error) {
    console.error('Error al eliminar costo mensual:', error)
    return NextResponse.json(
      { error: 'Error al eliminar costo mensual' },
      { status: 500 }
    )
  }
}