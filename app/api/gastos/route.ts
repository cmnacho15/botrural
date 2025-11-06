import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Obtener todos los gastos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // 'GASTO' o 'INGRESO'
    const categoria = searchParams.get('categoria')

    const where: any = {}
    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria

    const gastos = await prisma.gasto.findMany({
      where,
      include: {
        lote: true,
      },
      orderBy: {
        fecha: 'desc',
      },
    })

    return NextResponse.json(gastos)
  } catch (error) {
    console.error('Error obteniendo gastos:', error)
    return NextResponse.json(
      { error: 'Error obteniendo gastos' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo gasto
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tipo, monto, fecha, descripcion, categoria, metodoPago, loteId } = body

    // Obtener o crear el campo
    let campo = await prisma.campo.findFirst()
    if (!campo) {
      campo = await prisma.campo.create({
        data: { nombre: 'Mi Campo' },
      })
    }

    const gasto = await prisma.gasto.create({
      data: {
        tipo,
        monto: parseFloat(monto),
        fecha: new Date(fecha),
        descripcion,
        categoria,
        metodoPago,
        campoId: campo.id,
        loteId: loteId || null,
      },
      include: {
        lote: true,
      },
    })

    return NextResponse.json(gasto, { status: 201 })
  } catch (error) {
    console.error('Error creando gasto:', error)
    return NextResponse.json(
      { error: 'Error creando gasto' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar gasto
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      )
    }

    await prisma.gasto.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando gasto:', error)
    return NextResponse.json(
      { error: 'Error eliminando gasto' },
      { status: 500 }
    )
  }
}