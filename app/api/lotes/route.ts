import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ✅ Nuevo método GET: obtiene todos los lotes existentes
export async function GET() {
  try {
    const lotes = await prisma.lote.findMany({
      include: {
        campo: true,
        cultivos: true,
        animalesLote: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(lotes, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo lotes:', error)
    return NextResponse.json(
      { error: 'Error obteniendo los lotes' },
      { status: 500 }
    )
  }
}

// Método POST existente: crear un nuevo lote
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, hectareas, campoId } = body

    // Por ahora usamos un campoId temporal
    // Después lo obtenemos del usuario logueado
    const tempCampoId = 'temp-campo-id'

    // Crear o buscar el campo
    let campo = await prisma.campo.findFirst()
    
    if (!campo) {
      campo = await prisma.campo.create({
        data: {
          nombre: 'El Porvenir',
        },
      })
    }

    // Crear el lote
    const lote = await prisma.lote.create({
      data: {
        nombre,
        hectareas: parseFloat(hectareas),
        campoId: campo.id,
      },
    })

    return NextResponse.json(lote, { status: 201 })
  } catch (error) {
    console.error('Error creando lote:', error)
    return NextResponse.json(
      { error: 'Error creando el lote' },
      { status: 500 }
    )
  }
}
