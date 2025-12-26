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

    // ✅ Obtener proveedores de AMBAS tablas: evento Y gasto
    const proveedoresEvento = await prisma.evento.findMany({
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
      distinct: ['proveedor'],
    })

    const proveedoresGasto = await prisma.gasto.findMany({
      where: {
        campoId: usuario.campoId,
        proveedor: {
          not: null
        }
      },
      select: {
        proveedor: true
      },
      distinct: ['proveedor'],
    })

    // ✅ Combinar y eliminar duplicados
    const todosProveedores = [
      ...proveedoresEvento.map(g => g.proveedor?.trim()),
      ...proveedoresGasto.map(g => g.proveedor?.trim())
    ]
      .filter((p): p is string => !!p && p.length > 0)

    // ✅ Eliminar duplicados (case-insensitive)
    const proveedoresUnicos = Array.from(
      new Set(todosProveedores.map(p => p.toLowerCase()))
    ).map(lower => 
      todosProveedores.find(p => p.toLowerCase() === lower)!
    )

    console.log('✅ Proveedores encontrados:', proveedoresUnicos)

    return NextResponse.json(proveedoresUnicos)
  } catch (error) {
    console.error('❌ Error obteniendo proveedores:', error)
    return NextResponse.json({ error: 'Error obteniendo proveedores' }, { status: 500 })
  }
}