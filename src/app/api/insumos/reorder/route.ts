// app/api/insumos/reorder/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { orderedIds } = await req.json()

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de IDs' },
        { status: 400 }
      )
    }

    console.log('📝 Reordenando insumos:', orderedIds)

    // Verificar que el usuario tenga acceso al campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
    }

    // Verificar que todos los insumos pertenecen al campo del usuario
    const insumos = await prisma.insumo.findMany({
      where: {
        id: { in: orderedIds },
        campoId: usuario.campoId
      }
    })

    if (insumos.length !== orderedIds.length) {
      return NextResponse.json(
        { error: 'Algunos insumos no pertenecen a tu campo' },
        { status: 403 }
      )
    }

    // Actualizar el orden de cada insumo
    // Usamos una transacción para garantizar consistencia
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.insumo.update({
          where: { id },
          data: { orden: index }
        })
      )
    )

    console.log('✅ Orden de insumos actualizado')

    return NextResponse.json({ 
      success: true,
      message: 'Orden actualizado correctamente' 
    })

  } catch (error) {
    console.error('❌ Error reordenando insumos:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}