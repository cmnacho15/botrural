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

    // Obtener todos los eventos de tipo GASTO con descripción
    const gastos = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
        tipo: 'GASTO',
        descripcion: {
          not: null
        }
      },
      select: {
        descripcion: true
      }
    })

    // Extraer proveedores de las descripciones
    // Formato: "Item - Proveedor - Notas"
    const proveedores = gastos
      .map(g => {
        if (!g.descripcion) return null
        const partes = g.descripcion.split(' - ')
        // El proveedor está en la segunda posición
        return partes.length >= 2 ? partes[1].trim() : null
      })
      .filter((p): p is string => p !== null && p !== '')

    // Devolver lista única de proveedores
    const proveedoresUnicos = Array.from(new Set(proveedores))

    console.log('Proveedores encontrados:', proveedoresUnicos) // Debug

    return NextResponse.json(proveedoresUnicos)
  } catch (error) {
    console.error('Error obteniendo proveedores:', error)
    return NextResponse.json({ error: 'Error obteniendo proveedores' }, { status: 500 })
  }
}