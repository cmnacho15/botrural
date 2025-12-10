// src/app/api/modulos-pastoreo/[id]/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// 📝 PUT - Actualizar módulo
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    // Verificar que el módulo existe y pertenece al campo del usuario
    const modulo = await prisma.moduloPastoreo.findUnique({
      where: { id },
    })

    if (!modulo) {
      return NextResponse.json(
        { error: 'Módulo no encontrado' },
        { status: 404 }
      )
    }

    if (modulo.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { nombre, descripcion } = body

    if (!nombre || nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Verificar que no exista otro módulo con ese nombre
    const moduloConMismoNombre = await prisma.moduloPastoreo.findFirst({
      where: {
        nombre: nombre.trim(),
        campoId: usuario!.campoId!,
        id: { not: id }, // Excluir el módulo actual
      },
    })

    if (moduloConMismoNombre) {
      return NextResponse.json(
        { error: 'Ya existe otro módulo con ese nombre' },
        { status: 400 }
      )
    }

    const moduloActualizado = await prisma.moduloPastoreo.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
      },
    })

    console.log(`✅ Módulo actualizado: ${nombre}`)
    return NextResponse.json(moduloActualizado, { status: 200 })
  } catch (error: any) {
    console.error('💥 ERROR PUT /api/modulos-pastoreo/[id]:', error)
    return NextResponse.json(
      { error: 'Error actualizando el módulo', message: error.message },
      { status: 500 }
    )
  }
}

// 🗑️ DELETE - Eliminar módulo
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    const modulo = await prisma.moduloPastoreo.findUnique({
      where: { id },
      include: {
        lotes: true, // Incluir potreros para contar
      },
    })

    if (!modulo) {
      return NextResponse.json(
        { error: 'Módulo no encontrado' },
        { status: 404 }
      )
    }

    if (modulo.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // 🔥 LOS POTREROS NO SE BORRAN, QUEDAN SIN MÓDULO AUTOMÁTICAMENTE
    // Gracias a ON DELETE SET NULL en la base de datos

    await prisma.moduloPastoreo.delete({ where: { id } })

    console.log(
      `🗑️ Módulo eliminado: ${modulo.nombre} (${modulo.lotes.length} potreros ahora sin módulo)`
    )

    return NextResponse.json({
      success: true,
      message: 'Módulo eliminado correctamente',
      potrerosLiberados: modulo.lotes.length,
    })
  } catch (error: any) {
    console.error('💥 ERROR DELETE /api/modulos-pastoreo/[id]:', error)
    return NextResponse.json(
      { error: 'Error eliminando el módulo', message: error.message },
      { status: 500 }
    )
  }
}