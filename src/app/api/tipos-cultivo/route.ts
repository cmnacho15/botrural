import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

// Cultivos predeterminados
const CULTIVOS_PREDETERMINADOS = [
  'Maíz',
  'Soja',
  'Trigo',
  'Girasol',
  'Sorgo',
  'Cebada',
  'Avena',
  'Arroz',
  'Alfalfa',
  'Raigrás',
  'Trébol',
  'Festuca',
  'Lotus',
  'Pradera natural'
]

// GET - Obtener todos los tipos de cultivo (predeterminados + personalizados)
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

    // Obtener cultivos personalizados del usuario
    const cultivosPersonalizados = await prisma.tipoCultivo.findMany({
      where: {
        campoId: usuario.campoId,
      },
      select: {
        id: true,
        nombre: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    })

    // Combinar predeterminados + personalizados
    const cultivosPredefinidos = CULTIVOS_PREDETERMINADOS.map((nombre) => ({
      id: `pred-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
      nombre,
    }))

    const todosCultivos = [...cultivosPredefinidos, ...cultivosPersonalizados].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    )

    return NextResponse.json(todosCultivos)
  } catch (error) {
    console.error('Error obteniendo tipos de cultivo:', error)
    return NextResponse.json(
      { error: 'Error al obtener cultivos' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo tipo de cultivo personalizado
export async function POST(request: Request) {
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

    const { nombre } = await request.json()

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Verificar si ya existe (predeterminado o personalizado)
    const nombreLower = nombre.trim().toLowerCase()
    const esPredeterminado = CULTIVOS_PREDETERMINADOS.some(
      (c) => c.toLowerCase() === nombreLower
    )

    if (esPredeterminado) {
      return NextResponse.json(
        { error: 'Este cultivo ya existe como predeterminado' },
        { status: 400 }
      )
    }

    const existePersonalizado = await prisma.tipoCultivo.findFirst({
      where: {
        nombre: {
          equals: nombre.trim(),
          mode: 'insensitive',
        },
        campoId: usuario.campoId,
      },
    })

    if (existePersonalizado) {
      return NextResponse.json(
        { error: 'Este cultivo ya existe' },
        { status: 400 }
      )
    }

    // Crear cultivo personalizado
    const nuevoCultivo = await prisma.tipoCultivo.create({
      data: {
        nombre: nombre.trim(),
        campoId: usuario.campoId,
      },
    })

    return NextResponse.json(nuevoCultivo, { status: 201 })
  } catch (error) {
    console.error('Error creando tipo de cultivo:', error)
    return NextResponse.json(
      { error: 'Error al crear cultivo' },
      { status: 500 }
    )
  }
}