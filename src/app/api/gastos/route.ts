import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ GET - Obtener gastos del usuario autenticado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json([], { status: 200 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const categoria = searchParams.get('categoria')
    const proveedor = searchParams.get('proveedor')
    const comprador = searchParams.get('comprador')

    const where: any = { campoId: usuario.campoId }
    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria
    if (proveedor) where.proveedor = proveedor.toLowerCase().trim()
    if (comprador) where.comprador = comprador.toLowerCase().trim()

    const gastos = await prisma.gasto.findMany({
      where,
      include: { lote: { select: { nombre: true } } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(gastos)
  } catch (error) {
    console.error('💥 Error obteniendo gastos:', error)
    return NextResponse.json({ error: 'Error obteniendo gastos' }, { status: 500 })
  }
}

// ✅ POST - Crear nuevo gasto o ingreso
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'El usuario no tiene un campo asignado' }, { status: 400 })
    }

    const body = await request.json()
    const {
      tipo,
      monto,
      fecha,
      descripcion,
      categoria,
      proveedor,
      comprador, // ✅ NUEVO CAMPO
      metodoPago,
      iva,
      diasPlazo,
      pagado,
      loteId,
    } = body

    // ✅ Normalizar proveedor y comprador
    const proveedorNormalizado = proveedor ? proveedor.trim().toLowerCase() : null
    const compradorNormalizado = comprador ? comprador.trim().toLowerCase() : null

    // ✅ Si es contado → marcar pagado automáticamente y setear fechaPago
    const esPagado = pagado ?? (metodoPago === 'Contado' ? true : false)
    const fechaPago = esPagado ? new Date() : null

    // ✅ Crear gasto o ingreso según tipo
    const gasto = await prisma.gasto.create({
      data: {
        tipo,
        monto: parseFloat(monto),
        fecha: new Date(fecha),
        descripcion,
        categoria,
        proveedor: tipo === 'GASTO' ? proveedorNormalizado : null,
        comprador: tipo === 'INGRESO' ? compradorNormalizado : null,
        metodoPago: metodoPago || 'Contado',
        diasPlazo: diasPlazo ? parseInt(diasPlazo) : null,
        pagado: esPagado,
        fechaPago,
        iva: iva ? parseFloat(iva) : null,
        campoId: usuario.campoId,
        loteId: loteId || null,
      },
      include: { lote: true },
    })

    return NextResponse.json(gasto, { status: 201 })
  } catch (error) {
    console.error('💥 Error creando gasto:', error)
    return NextResponse.json({ error: 'Error creando gasto' }, { status: 500 })
  }
}

// ✅ DELETE - Eliminar gasto solo si pertenece al campo del usuario
export async function DELETE(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const gasto = await prisma.gasto.findUnique({ where: { id } })
    if (!gasto || gasto.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar este gasto' },
        { status: 403 }
      )
    }

    await prisma.gasto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💥 Error eliminando gasto:', error)
    return NextResponse.json({ error: 'Error eliminando gasto' }, { status: 500 })
  }
}