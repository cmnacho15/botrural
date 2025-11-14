import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // ✅ Promise agregada
) {
  try {
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

    const { id: loteId } = await params  // ✅ await params

    // Verificar que el lote pertenece al campo del usuario
    const lote = await prisma.lote.findFirst({
      where: { id: loteId, campoId: usuario.campoId },
    })

    if (!lote) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
    }

    // Obtener animales del lote
    const animales = await prisma.animalLote.findMany({
      where: { loteId },
      orderBy: { categoria: 'asc' },
    })

    return NextResponse.json(animales)
  } catch (error) {
    console.error('Error al obtener animales:', error)
    return NextResponse.json(
      { error: 'Error al obtener animales' },
      { status: 500 }
    )
  }
}