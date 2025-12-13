import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// ==========================================
// PUT - Editar firma
// ==========================================
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { rut, razonSocial, esPrincipal } = body

    // Verificar que la firma pertenece al campo del usuario
    const firma = await prisma.firma.findUnique({
      where: { id: params.id }
    })

    if (!firma || firma.campoId !== session.user.campoId) {
      return NextResponse.json(
        { error: 'Firma no encontrada' },
        { status: 404 }
      )
    }

    // Si se marca como principal, quitar el flag de las demás
    if (esPrincipal && !firma.esPrincipal) {
      await prisma.firma.updateMany({
        where: { 
          campoId: session.user.campoId,
          id: { not: params.id }
        },
        data: { esPrincipal: false }
      })
    }

    // Actualizar la firma
    const firmaActualizada = await prisma.firma.update({
      where: { id: params.id },
      data: {
        rut,
        razonSocial,
        esPrincipal
      }
    })

    return NextResponse.json(firmaActualizada)
  } catch (error) {
    console.error('❌ Error al actualizar firma:', error)
    return NextResponse.json(
      { error: 'Error al actualizar firma' },
      { status: 500 }
    )
  }
}

// ==========================================
// DELETE - Eliminar firma
// ==========================================
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que la firma pertenece al campo del usuario
    const firma = await prisma.firma.findUnique({
      where: { id: params.id }
    })

    if (!firma || firma.campoId !== session.user.campoId) {
      return NextResponse.json(
        { error: 'Firma no encontrada' },
        { status: 404 }
      )
    }

    // Verificar si tiene ventas asociadas
    const ventasAsociadas = await prisma.venta.count({
      where: { firmaId: params.id }
    })

    if (ventasAsociadas > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar. Esta firma tiene ${ventasAsociadas} venta(s) asociada(s)` },
        { status: 400 }
      )
    }

    // Verificar si tiene compras asociadas
    const comprasAsociadas = await prisma.compra.count({
      where: { firmaId: params.id }
    })

    if (comprasAsociadas > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar. Esta firma tiene ${comprasAsociadas} compra(s) asociada(s)` },
        { status: 400 }
      )
    }

    // Eliminar la firma
    await prisma.firma.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error al eliminar firma:', error)
    return NextResponse.json(
      { error: 'Error al eliminar firma' },
      { status: 500 }
    )
  }
}