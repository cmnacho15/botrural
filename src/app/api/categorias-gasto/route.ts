import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Obtener categorías
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const categorias = await prisma.categoriaGasto.findMany({
      where: {
        campoId: session.user.campoId,
        activo: true,
      },
      orderBy: { orden: 'asc' },
    })

    return NextResponse.json(categorias)
  } catch (error) {
    console.error('Error al obtener categorías:', error)
    return NextResponse.json(
      { error: 'Error al obtener categorías' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva categoría
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { nombre, color } = body

    if (!nombre || !color) {
      return NextResponse.json(
        { error: 'Nombre y color son requeridos' },
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existente = await prisma.categoriaGasto.findFirst({
      where: {
        nombre: nombre.trim(),
        campoId: session.user.campoId,
      },
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      )
    }

    // Obtener el orden más alto actual
    const ultimaCategoria = await prisma.categoriaGasto.findFirst({
      where: { campoId: session.user.campoId },
      orderBy: { orden: 'desc' },
    })

    const nuevaCategoria = await prisma.categoriaGasto.create({
      data: {
        nombre: nombre.trim(),
        color,
        campoId: session.user.campoId,
        orden: (ultimaCategoria?.orden || 0) + 1,
      },
    })

    return NextResponse.json(nuevaCategoria, { status: 201 })
  } catch (error) {
    console.error('Error al crear categoría:', error)
    return NextResponse.json(
      { error: 'Error al crear categoría' },
      { status: 500 }
    )
  }
}