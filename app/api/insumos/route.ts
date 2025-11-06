import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ✅ GET - Obtener todos los insumos (con relaciones completas)
export async function GET() {
  try {
    const insumos = await prisma.insumo.findMany({
      include: {
        movimientos: {
          orderBy: { fecha: 'desc' },
        },
        campo: {
          select: { nombre: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 🔹 Aseguramos que siempre sea un array
    return NextResponse.json(insumos ?? [])
  } catch (error) {
    console.error('Error obteniendo insumos:', error)
    return NextResponse.json({ error: 'Error obteniendo insumos' }, { status: 500 })
  }
}

// ✅ POST - Crear nuevo insumo
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, unidad } = body

    if (!nombre || !unidad) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Obtener o crear campo base
    let campo = await prisma.campo.findFirst()
    if (!campo) {
      campo = await prisma.campo.create({
        data: { nombre: 'Mi Campo' },
      })
    }

    // Crear insumo nuevo
    const insumo = await prisma.insumo.create({
      data: {
        nombre,
        unidad,
        campoId: campo.id,
      },
    })

    // 🔹 Retornar insumo recién creado con movimientos vacíos
    return NextResponse.json(
      { ...insumo, movimientos: [] },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creando insumo:', error)
    return NextResponse.json({ error: 'Error creando insumo' }, { status: 500 })
  }
}