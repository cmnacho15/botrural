import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tipo, cantidad, fecha, notas, insumoId, loteId } = body

    // Validación básica
    if (!tipo || !cantidad || !insumoId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Buscar el insumo antes de crear el movimiento
    const insumo = await prisma.insumo.findUnique({
      where: { id: insumoId },
    })

    if (!insumo) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      )
    }

    const cantidadFloat = parseFloat(cantidad)
    const fechaMovimiento = fecha ? new Date(fecha) : new Date()

    // Crear el movimiento
    await prisma.movimientoInsumo.create({
      data: {
        tipo,
        cantidad: cantidadFloat,
        fecha: fechaMovimiento,
        notas: notas || null,
        insumoId,
        loteId: loteId || null,
      },
    })

    // Actualizar el stock del insumo
    const nuevoStock =
      tipo === 'INGRESO'
        ? insumo.stock + cantidadFloat
        : insumo.stock - cantidadFloat

    const insumoActualizado = await prisma.insumo.update({
      where: { id: insumoId },
      data: {
        stock: Math.max(0, nuevoStock),
        updatedAt: new Date(),
      },
      include: {
        movimientos: {
          orderBy: { fecha: 'desc' },
        },
      },
    })

    // 🔹 Respuesta correcta al frontend
    return NextResponse.json(
      {
        message: 'Movimiento registrado correctamente',
        insumoActualizado,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creando movimiento:', error)
    return NextResponse.json(
      { error: 'Error creando movimiento' },
      { status: 500 }
    )
  }
}