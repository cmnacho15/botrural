import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { campoId: true }
  })

  if (!usuario?.campoId) return NextResponse.json({ error: 'Sin campo' }, { status: 400 })

  const rodeos = await prisma.rodeo.findMany({
    where: { campoId: usuario.campoId },
    orderBy: { nombre: 'asc' }
  })

  return NextResponse.json(rodeos)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { campoId: true }
  })

  if (!usuario?.campoId) return NextResponse.json({ error: 'Sin campo' }, { status: 400 })

  const { nombre } = await request.json()

  const rodeo = await prisma.rodeo.create({
    data: {
      nombre,
      campoId: usuario.campoId
    }
  })

  return NextResponse.json(rodeo)
}