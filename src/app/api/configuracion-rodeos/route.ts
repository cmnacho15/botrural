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

  const campo = await prisma.campo.findUnique({
    where: { id: usuario.campoId },
    select: { modoRodeo: true }
  })

  return NextResponse.json({ modoRodeo: campo?.modoRodeo || 'OPCIONAL' })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const usuario = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { campoId: true }
  })

  if (!usuario?.campoId) return NextResponse.json({ error: 'Sin campo' }, { status: 400 })

  const { modoRodeo } = await request.json()

  await prisma.campo.update({
    where: { id: usuario.campoId },
    data: { modoRodeo }
  })

  return NextResponse.json({ success: true })
}