import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ PUT - Actualizar INGRESO
export async function PUT(
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
      return NextResponse.json(
        { error: 'Usuario sin campo asignado' },
        { status: 400 }
      )
    }

    // Verificar que el ingreso pertenece al mismo campo
    const ingresoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!ingresoExistente || ingresoExistente.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para editar este ingreso' },
        { status: 403 }
      )
    }

    // ✅ Verificar que sea un INGRESO
    if (ingresoExistente.tipo !== 'INGRESO') {
      return NextResponse.json(
        { error: 'Este registro no es un ingreso' },
        { status: 400 }
      )
    }

    // Parsear el body del request
    const body = await request.json()
    const {
      monto,
      fecha,
      descripcion,
      categoria,
      metodoPago,
      iva,
      pagado,
      diasPlazo,
      comprador,
    } = body

    // ⚠️ Las ediciones de ingresos con animales NO modifican el stock
    // (el stock ya se ajustó al crear el ingreso)

    const dataUpdate: any = {
      tipo: 'INGRESO',
      monto: parseFloat(monto),
      fecha: new Date(fecha),
      descripcion,
      categoria,
      metodoPago,
      iva: iva !== undefined ? parseFloat(String(iva)) : null,
      diasPlazo: diasPlazo ? parseInt(diasPlazo) : null,
      pagado: pagado ?? ingresoExistente.pagado,
      comprador:
        comprador !== undefined
          ? comprador
            ? comprador.trim().toLowerCase()
            : null
          : ingresoExistente.comprador,
      proveedor: null,
    }

    if (!ingresoExistente.pagado && pagado === true) {
      dataUpdate.fechaPago = new Date()
    }

    const ingresoActualizado = await prisma.gasto.update({
      where: { id: params.id },
      data: dataUpdate,
      include: { lote: true },
    })

    console.log(`✅ Ingreso actualizado: ${ingresoActualizado.id}`)
    return NextResponse.json(ingresoActualizado)
  } catch (error) {
    console.error('💥 Error actualizando ingreso:', error)
    return NextResponse.json(
      { error: 'Error actualizando ingreso' },
      { status: 500 }
    )
  }
}

// ✅ DELETE - Eliminar INGRESO con restauración de stock
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
      return NextResponse.json(
        { error: 'Usuario sin campo asignado' },
        { status: 400 }
      )
    }

    const ingreso = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!ingreso || ingreso.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar este ingreso' },
        { status: 403 }
      )
    }

    if (ingreso.tipo !== 'INGRESO') {
      return NextResponse.json(
        { error: 'Este registro no es un ingreso' },
        { status: 400 }
      )
    }

    // ✅ Restaurar stock si fue venta de animales
    if (ingreso.animalLoteId && ingreso.cantidadVendida) {
      await prisma.animalLote.update({
        where: { id: ingreso.animalLoteId },
        data: {
          cantidad: { increment: ingreso.cantidadVendida },
        },
      })
      console.log(`✅ Stock restaurado: +${ingreso.cantidadVendida} animales`)
    }

    await prisma.gasto.delete({ where: { id: params.id } })
    console.log(`🗑️ Ingreso eliminado: ${ingreso.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💥 Error eliminando ingreso:', error)
    return NextResponse.json(
      { error: 'Error eliminando ingreso' },
      { status: 500 }
    )
  }
}