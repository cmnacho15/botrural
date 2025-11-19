import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

// DELETE - Eliminar tipo de cultivo personalizado
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

    // No permitir eliminar predeterminados
    if (id.startsWith('pred-')) {
      return NextResponse.json(
        { error: 'No puedes eliminar cultivos predeterminados' },
        { status: 400 }
      )
    }

    // Verificar que el cultivo pertenece al campo del usuario
    const cultivo = await prisma.tipoCultivo.findFirst({
      where: {
        id,
        campoId: usuario.campoId,
      },
    })

    if (!cultivo) {
      return NextResponse.json(
        { error: 'Cultivo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si el cultivo está siendo usado
    const cultivosEnUso = await prisma.cultivo.findFirst({
      where: {
        tipoCultivo: cultivo.nombre,
        lote: {
          campoId: usuario.campoId,
        },
      },
    })

    if (cultivosEnUso) {
      return NextResponse.json(
        { error: 'No puedes eliminar un cultivo que está siendo usado en tus potreros' },
        { status: 400 }
      )
    }

    // Eliminar cultivo
    await prisma.tipoCultivo.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando tipo de cultivo:', error)
    return NextResponse.json(
      { error: 'Error al eliminar cultivo' },
      { status: 500 }
    )
  }
}