import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// PATCH - Editar nombre de categoría
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { nombre } = body

    if (!nombre || nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Verificar que la categoría existe y pertenece al usuario
    const categoriaExistente = await prisma.categoriaGasto.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!categoriaExistente) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no exista otra categoría con el mismo nombre
    const categoriaConMismoNombre = await prisma.categoriaGasto.findFirst({
      where: {
        nombre: nombre.trim(),
        campoId: session.user.campoId,
        NOT: {
          id,
        },
      },
    })

    if (categoriaConMismoNombre) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      )
    }

    // Actualizar la categoría
    const categoriaActualizada = await prisma.categoriaGasto.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
      },
    })

    return NextResponse.json(categoriaActualizada)
  } catch (error) {
    console.error('Error al actualizar categoría:', error)
    return NextResponse.json(
      { error: 'Error al actualizar categoría' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar categoría
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params

    // Verificar que la categoría existe y pertenece al usuario
    const categoria = await prisma.categoriaGasto.findFirst({
      where: {
        id,
        campoId: session.user.campoId,
      },
    })

    if (!categoria) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar si hay gastos usando esta categoría
    const gastosConCategoria = await prisma.gasto.findFirst({
      where: {
        categoria: categoria.nombre,
        campoId: session.user.campoId,
      },
    })

    if (gastosConCategoria) {
      return NextResponse.json(
        { 
          error: 'No se puede eliminar esta categoría porque hay gastos registrados con ella. Primero elimine o reasigne esos gastos.' 
        },
        { status: 400 }
      )
    }

    // Eliminar la categoría
    await prisma.categoriaGasto.delete({
      where: { id },
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Categoría eliminada exitosamente' 
    })
  } catch (error) {
    console.error('Error al eliminar categoría:', error)
    return NextResponse.json(
      { error: 'Error al eliminar categoría' },
      { status: 500 }
    )
  }
}