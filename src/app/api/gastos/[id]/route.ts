import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ PUT - Actualizar gasto o ingreso (incluye marcar como pagado)
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params // necesario en App Router
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo asignado' }, { status: 400 })
    }

    // Verificar que el gasto pertenece al mismo campo
    const gastoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gastoExistente || gastoExistente.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para editar este gasto' },
        { status: 403 }
      )
    }

    // ✅ Parsear el body del request
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
      proveedor, // 👈 Para GASTOS
      comprador, // 👈 Para INGRESOS
    } = body

    // ✅ Construir objeto de actualización
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

    // ✅ Si es GASTO → actualizar proveedor y limpiar comprador
    if (tipo === 'GASTO') {
      dataUpdate.proveedor =
        proveedor !== undefined
          ? proveedor
            ? proveedor.trim().toLowerCase()
            : null
          : gastoExistente.proveedor
      dataUpdate.comprador = null
    }

    // ✅ Si es INGRESO → actualizar comprador y limpiar proveedor
    if (tipo === 'INGRESO') {
      dataUpdate.comprador =
        comprador !== undefined
          ? comprador
            ? comprador.trim().toLowerCase()
            : null
          : gastoExistente.comprador
      dataUpdate.proveedor = null
    }

    // ✅ Si antes no estaba pagado y ahora sí → registrar fechaPago
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

// ✅ DELETE - Eliminar gasto
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo asignado' }, { status: 400 })
    }

    // ✅ Verificar que el gasto pertenece al mismo campo
    const gasto = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!gasto || gasto.campoId !== usuario.campoId) {
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