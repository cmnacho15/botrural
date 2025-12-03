import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * PATCH - Configurar mapeo de una categoría de gastos a costos estructurados
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

    // Verificar que la categoría existe y pertenece al usuario
    const categoria = await prisma.categoriaGasto.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!categoria) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const {
      mapeadaACostos,
      categoriaCostoEstructurado,
      subcategoriaCosto,
      porcentajeVacuno,
      porcentajeOvino,
      porcentajeEquino,
      porcentajeDesperdicios,
    } = body

    // Validar porcentajes (deben sumar 100)
    if (mapeadaACostos) {
      const sumaTotal =
        (porcentajeVacuno || 0) +
        (porcentajeOvino || 0) +
        (porcentajeEquino || 0) +
        (porcentajeDesperdicios || 0)

      if (Math.abs(sumaTotal - 100) > 0.01) {
        return NextResponse.json(
          { error: 'Los porcentajes deben sumar 100%' },
          { status: 400 }
        )
      }

      if (!categoriaCostoEstructurado || !subcategoriaCosto) {
        return NextResponse.json(
          { error: 'Debe especificar categoría y subcategoría de destino' },
          { status: 400 }
        )
      }
    }

    // Actualizar la categoría
    const categoriaActualizada = await prisma.categoriaGasto.update({
      where: { id },
      data: {
        mapeadaACostos: mapeadaACostos ?? categoria.mapeadaACostos,
        categoriaCostoEstructurado: categoriaCostoEstructurado ?? categoria.categoriaCostoEstructurado,
        subcategoriaCosto: subcategoriaCosto ?? categoria.subcategoriaCosto,
        porcentajeVacuno: porcentajeVacuno ?? categoria.porcentajeVacuno,
        porcentajeOvino: porcentajeOvino ?? categoria.porcentajeOvino,
        porcentajeEquino: porcentajeEquino ?? categoria.porcentajeEquino,
        porcentajeDesperdicios: porcentajeDesperdicios ?? categoria.porcentajeDesperdicios,
      },
    })

    return NextResponse.json(categoriaActualizada)
  } catch (error) {
    console.error('Error al actualizar mapeo:', error)
    return NextResponse.json(
      { error: 'Error al actualizar mapeo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Eliminar mapeo de una categoría
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

    const categoria = await prisma.categoriaGasto.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!categoria) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Resetear mapeo
    const categoriaActualizada = await prisma.categoriaGasto.update({
      where: { id },
      data: {
        mapeadaACostos: false,
        categoriaCostoEstructurado: null,
        subcategoriaCosto: null,
        porcentajeVacuno: 100,
        porcentajeOvino: 0,
        porcentajeEquino: 0,
        porcentajeDesperdicios: 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Mapeo eliminado',
      data: categoriaActualizada,
    })
  } catch (error) {
    console.error('Error al eliminar mapeo:', error)
    return NextResponse.json(
      { error: 'Error al eliminar mapeo' },
      { status: 500 }
    )
  }
}