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

    // ✅ Obtener proveedores directamente del campo "proveedor"
    const gastos = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
        tipo: 'GASTO',
        proveedor: {
          not: null
        }
      },
      select: {
        proveedor: true
      },
      distinct: ['proveedor'], // ✅ Obtener solo valores únicos
    })

    // ✅ Extraer y limpiar proveedores
    const proveedores = gastos
      .map(g => g.proveedor?.trim())
      .filter((p): p is string => !!p && p.length > 0)

    console.log('✅ Proveedores encontrados:', proveedores) // Debug

    return NextResponse.json(proveedores)
  } catch (error) {
    console.error('❌ Error obteniendo proveedores:', error)
    return NextResponse.json({ error: 'Error obteniendo proveedores' }, { status: 500 })
  }
}