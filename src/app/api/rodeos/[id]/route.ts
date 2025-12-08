import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

// EDITAR RODEO
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { campoId: true }
  })

  if (!usuario?.campoId) return NextResponse.json({ error: 'Sin campo' }, { status: 400 })

  const { nombre } = await request.json()

  try {
    const rodeo = await prisma.rodeo.update({
      where: {
        id: params.id,
        campoId: usuario.campoId // Verificar que pertenece al campo
      },
      data: { nombre }
    })

    return NextResponse.json(rodeo)
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar rodeo' }, { status: 500 })
  }
}

// ELIMINAR RODEO
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { campoId: true }
  })

  if (!usuario?.campoId) return NextResponse.json({ error: 'Sin campo' }, { status: 400 })

  try {
    // Verificar si el rodeo está en uso
    const eventosConRodeo = await prisma.evento.count({
      where: { rodeoId: params.id }
    })

    if (eventosConRodeo > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: hay eventos asociados a este rodeo' },
        { status: 400 }
      )
    }

    await prisma.rodeo.delete({
      where: {
        id: params.id,
        campoId: usuario.campoId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar rodeo' }, { status: 500 })
  }
}