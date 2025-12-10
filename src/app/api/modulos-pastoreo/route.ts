// src/app/api/modulos-pastoreo/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// 📋 GET - Obtener todos los módulos del campo del usuario
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const modulos = await prisma.moduloPastoreo.findMany({
      where: { campoId: usuario.campoId },
      include: {
        _count: {
          select: { lotes: true } // Contar cuántos potreros tiene cada módulo
        }
      },
      orderBy: { createdAt: 'asc' }, // Los más antiguos primero
    })

    return NextResponse.json(modulos)
  } catch (error) {
    console.error('Error al obtener módulos:', error)
    return NextResponse.json(
      { error: 'Error al obtener módulos' },
      { status: 500 }
    )
  }
}

// 🧩 POST - Crear nuevo módulo
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: 'El usuario no tiene un campo asignado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { nombre, descripcion } = body

    if (!nombre || nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Verificar que no exista ya un módulo con ese nombre en el campo
    const moduloExistente = await prisma.moduloPastoreo.findFirst({
      where: {
        nombre: nombre.trim(),
        campoId: usuario.campoId,
      },
    })

    if (moduloExistente) {
      return NextResponse.json(
        { error: 'Ya existe un módulo con ese nombre' },
        { status: 400 }
      )
    }

    const modulo = await prisma.moduloPastoreo.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        campoId: usuario.campoId,
      },
    })

    console.log(`✅ Módulo creado: ${nombre}`)
    return NextResponse.json(modulo, { status: 201 })
  } catch (error) {
    console.error('💥 Error creando módulo:', error)
    return NextResponse.json(
      { error: 'Error creando el módulo' },
      { status: 500 }
    )
  }
}