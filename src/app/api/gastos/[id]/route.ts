import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const allowedWrite = ["ADMIN_GENERAL", "ADMIN_CON_FINANZAS"]

// ------------------------------------------
// PUT - Actualizar gasto / ingreso
// ------------------------------------------
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id)
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!allowedWrite.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar gastos' },
        { status: 403 }
      )
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    const gastoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gastoExistente || gastoExistente.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const {
      tipo,
      monto,
      fecha,
      descripcion,
      categoria,
      metodoPago,
      iva,
      pagado,
      diasPlazo,
      proveedor,
      comprador,
    } = body

    const dataUpdate: any = {
      tipo,
      monto: parseFloat(monto),
      fecha: new Date(fecha),
      descripcion,
      categoria,
      metodoPago,
      iva: iva !== undefined ? parseFloat(String(iva)) : null,
      diasPlazo: diasPlazo ? parseInt(diasPlazo) : gastoExistente.diasPlazo,
      pagado: pagado ?? gastoExistente.pagado,
    }

    if (tipo === 'GASTO') {
      dataUpdate.proveedor = proveedor?.trim().toLowerCase() || null
      dataUpdate.comprador = null
    }

    if (tipo === 'INGRESO') {
      dataUpdate.comprador = comprador?.trim().toLowerCase() || null
      dataUpdate.proveedor = null
    }

    if (!gastoExistente.pagado && pagado === true) {
      dataUpdate.fechaPago = new Date()
    }

    const gastoActualizado = await prisma.gasto.update({
      where: { id: params.id },
      data: dataUpdate,
      include: { lote: true },
    })

    return NextResponse.json(gastoActualizado)
  } catch (error) {
    console.error('💥 Error actualizando gasto:', error)
    return NextResponse.json({ error: 'Error actualizando gasto' }, { status: 500 })
  }
}

// ------------------------------------------
// DELETE - Eliminar gasto
// ------------------------------------------
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id)
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!allowedWrite.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar gastos' },
        { status: 403 }
      )
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    const gasto = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gasto || gasto.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar este gasto' },
        { status: 403 }
      )
    }

    await prisma.gasto.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💥 Error eliminando gasto:', error)
    return NextResponse.json({ error: 'Error eliminando gasto' }, { status: 500 })
  }
}