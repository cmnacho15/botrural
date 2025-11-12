import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json([], { status: 200 })
    }

    // Obtener lista única de proveedores
    const proveedores = await prisma.gasto.findMany({
      where: { campoId: usuario.campoId, proveedor: { not: null } },
      distinct: ['proveedor'],
      select: { proveedor: true },
    })

    return NextResponse.json(proveedores.map(p => p.proveedor))
  } catch (error) {
    console.error('Error obteniendo proveedores:', error)
    return NextResponse.json({ error: 'Error obteniendo proveedores' }, { status: 500 })
  }
}