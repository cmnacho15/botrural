import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

// DELETE - Eliminar categoría personalizada
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // No permitir eliminar predeterminadas
    if (id.startsWith('pred-')) {
      return NextResponse.json(
        { error: 'No puedes eliminar categorías predeterminadas' },
        { status: 400 }
      )
    }

    // Verificar que la categoría pertenece al campo del usuario
    const categoria = await prisma.categoriaAnimal.findFirst({
      where: {
        id,
        campoId: usuario.campoId,
      },
    })

    if (!categoria) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar si la categoría está siendo usada
    const animalesEnUso = await prisma.animalLote.findFirst({
      where: {
        categoria: categoria.nombreSingular,
        lote: {
          campoId: usuario.campoId,
        },
      },
    })

    if (animalesEnUso) {
      return NextResponse.json(
        { error: 'No puedes eliminar una categoría que está siendo usada en tus potreros' },
        { status: 400 }
      )
    }

    // Eliminar categoría
    await prisma.categoriaAnimal.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando categoría de animal:', error)
    return NextResponse.json(
      { error: 'Error al eliminar categoría' },
      { status: 500 }
    )
  }
}