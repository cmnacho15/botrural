import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { convertirAUYU, obtenerTasaCambio } from '@/lib/currency'

// ===========================================================
// PUT - Actualizar INGRESO
// ===========================================================
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

    // Verificar que el ingreso existe y pertenece al usuario
    const ingresoExistente = await prisma.gasto.findUnique({
      where: { id: params.id },
    })

    if (!ingresoExistente || ingresoExistente.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para editar este ingreso' },
        { status: 403 }
      )
    }

    // Debe ser un INGRESO
    if (ingresoExistente.tipo !== 'INGRESO') {
      return NextResponse.json(
        { error: 'Este registro no es un ingreso' },
        { status: 400 }
      )
    }

    // Body recibido del frontend
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
      moneda, // necesario para mantener USD si edita
    } = body

    // ---------------------------------------------------------
    // 🔥 Convertir a pesos siempre (igual que en POST)
    // ---------------------------------------------------------
    const montoFloat = parseFloat(monto)
    const monedaIngreso = moneda || ingresoExistente.moneda || 'UYU'

    const montoEnUYU = await convertirAUYU(montoFloat, monedaIngreso)
    const tasaCambio = await obtenerTasaCambio(monedaIngreso)

    const compradorNormalizado = comprador
      ? comprador.trim().toLowerCase()
      : null

    // ---------------------------------------------------------
    // 🧱 Armado de data final para actualizar
    // ---------------------------------------------------------
    const dataUpdate: any = {
      tipo: 'INGRESO',

      // Montos corregidos
      monto: montoEnUYU,            // SIEMPRE en pesos
      montoOriginal: montoFloat,    // el valor ingresado por el usuario
      moneda: monedaIngreso,
      montoEnUYU: montoEnUYU,
      tasaCambio: tasaCambio,

      fecha: new Date(fecha),
      descripcion,
      categoria,

      metodoPago,
      iva: iva !== undefined ? parseFloat(String(iva)) : null,
      diasPlazo: diasPlazo ? parseInt(diasPlazo) : null,
      pagado: pagado ?? ingresoExistente.pagado,

      comprador: comprador !== undefined ? compradorNormalizado : ingresoExistente.comprador,
      proveedor: null,
    }

    // Fecha de pago
    if (!ingresoExistente.pagado && pagado === true) {
      dataUpdate.fechaPago = new Date()
    }

    const ingresoActualizado = await prisma.gasto.update({
      where: { id: params.id },
      data: dataUpdate,
      include: { lote: true },
    })

    console.log(`✅ Ingreso actualizado correctamente: ${ingresoActualizado.id}`)
    return NextResponse.json(ingresoActualizado)
  } catch (error) {
    console.error('💥 Error actualizando ingreso:', error)
    return NextResponse.json(
      { error: 'Error actualizando ingreso' },
      { status: 500 }
    )
  }
}

// ===========================================================
// DELETE - Eliminar ingreso + restaurar stock animal
// ===========================================================
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

    // Restaurar stock si es venta de animales
    if (ingreso.animalLoteId && ingreso.cantidadVendida) {
      await prisma.animalLote.update({
        where: { id: ingreso.animalLoteId },
        data: {
          cantidad: { increment: ingreso.cantidadVendida },
        },
      })
      console.log(`🐄 Stock restaurado correctamente`)
    }

    await prisma.gasto.delete({ where: { id: params.id } })
    console.log(`🗑️ Ingreso eliminado correctamente`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💥 Error eliminando ingreso:', error)
    return NextResponse.json(
      { error: 'Error eliminando ingreso' },
      { status: 500 }
    )
  }
}