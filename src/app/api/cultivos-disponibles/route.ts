import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

export async function GET() {
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

    // Obtener todos los cultivos únicos del campo
    const cultivos = await prisma.cultivo.findMany({
      where: {
        lote: {
          campoId: usuario.campoId,
        },
      },
      select: {
        tipoCultivo: true,
      },
      distinct: ['tipoCultivo'],
      orderBy: {
        tipoCultivo: 'asc',
      },
    })

    return NextResponse.json(cultivos)
  } catch (error) {
    console.error('Error obteniendo cultivos:', error)
    return NextResponse.json(
      { error: 'Error al obtener cultivos' },
      { status: 500 }
    )
  }
}