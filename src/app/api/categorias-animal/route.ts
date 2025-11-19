import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

// Categorías predeterminadas por tipo
const CATEGORIAS_PREDETERMINADAS = {
  BOVINO: [
    { singular: 'Toros', plural: 'Toros' },
    { singular: 'Vacas', plural: 'Vacas' },
    { singular: 'Novillos +3 años', plural: 'Novillos +3 años' },
    { singular: 'Novillos 2–3 años', plural: 'Novillos 2–3 años' },
    { singular: 'Novillos 1–2 años', plural: 'Novillos 1–2 años' },
    { singular: 'Vaquillonas +2 años', plural: 'Vaquillonas +2 años' },
    { singular: 'Vaquillonas 1–2 años', plural: 'Vaquillonas 1–2 años' },
    { singular: 'Terneros/as', plural: 'Terneros/as' },
  ],
  OVINO: [
    { singular: 'Carneros', plural: 'Carneros' },
    { singular: 'Ovejas', plural: 'Ovejas' },
    { singular: 'Capones', plural: 'Capones' },
    { singular: 'Borregas 2–4 dientes', plural: 'Borregas 2–4 dientes' },
    { singular: 'Corderas DL', plural: 'Corderas DL' },
    { singular: 'Corderos DL', plural: 'Corderos DL' },
    { singular: 'Corderos/as Mamones', plural: 'Corderos/as Mamones' },
  ],
  EQUINO: [
    { singular: 'Padrillos', plural: 'Padrillos' },
    { singular: 'Yeguas', plural: 'Yeguas' },
    { singular: 'Caballos', plural: 'Caballos' },
    { singular: 'Potrillos', plural: 'Potrillos' },
  ],
}

// GET - Obtener todas las categorías (predeterminadas + personalizadas)
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

    // Obtener categorías personalizadas del usuario
    const categoriasPersonalizadas = await prisma.categoriaAnimal.findMany({
      where: {
        campoId: usuario.campoId,
      },
      select: {
        id: true,
        nombreSingular: true,
        nombrePlural: true,
        tipoAnimal: true,
        activo: true,
        esPredeterminado: true,
      },
      orderBy: {
        nombreSingular: 'asc',
      },
    })

    // Crear categorías predeterminadas con ID ficticio
    const categoriasPredefinidas = Object.entries(CATEGORIAS_PREDETERMINADAS).flatMap(
      ([tipo, categorias]) =>
        categorias.map((cat) => ({
          id: `pred-${tipo.toLowerCase()}-${cat.singular.toLowerCase().replace(/\s+/g, '-')}`,
          nombreSingular: cat.singular,
          nombrePlural: cat.plural,
          tipoAnimal: tipo,
          activo: true, // Por defecto todas activas
          esPredeterminado: true,
        }))
    )

    // Combinar predeterminadas + personalizadas
    const todasCategorias = [...categoriasPredefinidas, ...categoriasPersonalizadas].sort((a, b) =>
      a.nombreSingular.localeCompare(b.nombreSingular)
    )

    return NextResponse.json(todasCategorias)
  } catch (error) {
    console.error('Error obteniendo categorías de animales:', error)
    return NextResponse.json(
      { error: 'Error al obtener categorías' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva categoría personalizada
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

    const { nombreSingular, nombrePlural, tipoAnimal } = await request.json()

    if (!nombreSingular || !nombrePlural || !tipoAnimal) {
      return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 })
    }

    // Verificar si ya existe
    const existePersonalizado = await prisma.categoriaAnimal.findFirst({
      where: {
        nombreSingular: {
          equals: nombreSingular.trim(),
          mode: 'insensitive',
        },
        campoId: usuario.campoId,
      },
    })

    if (existePersonalizado) {
      return NextResponse.json(
        { error: 'Esta categoría ya existe' },
        { status: 400 }
      )
    }

    // Crear categoría personalizada
    const nuevaCategoria = await prisma.categoriaAnimal.create({
      data: {
        nombreSingular: nombreSingular.trim(),
        nombrePlural: nombrePlural.trim(),
        tipoAnimal,
        campoId: usuario.campoId,
        activo: true,
        esPredeterminado: false,
      },
    })

    return NextResponse.json(nuevaCategoria, { status: 201 })
  } catch (error) {
    console.error('Error creando categoría de animal:', error)
    return NextResponse.json(
      { error: 'Error al crear categoría' },
      { status: 500 }
    )
  }
}

// PATCH - Actualizar estado activo de una categoría
export async function PATCH(request: Request) {
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

    const { id, activo } = await request.json()

    // No permitir actualizar predeterminadas (IDs ficticios)
    if (id.startsWith('pred-')) {
      return NextResponse.json(
        { error: 'No puedes modificar categorías predeterminadas' },
        { status: 400 }
      )
    }

    const categoriaActualizada = await prisma.categoriaAnimal.update({
      where: {
        id,
        campoId: usuario.campoId,
      },
      data: {
        activo,
      },
    })

    return NextResponse.json(categoriaActualizada)
  } catch (error) {
    console.error('Error actualizando categoría:', error)
    return NextResponse.json(
      { error: 'Error al actualizar categoría' },
      { status: 500 }
    )
  }
}