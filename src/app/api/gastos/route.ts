import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// Roles con permisos
const allowedRead = ["ADMIN_GENERAL", "ADMIN_CON_FINANZAS", "CONTADOR"]
const allowedWrite = ["ADMIN_GENERAL", "ADMIN_CON_FINANZAS"]

// ------------------------------------------
// GET - Obtener gastos del usuario
// ------------------------------------------
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // ❗ Control de acceso
    if (!allowedRead.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes acceso a información financiera' },
        { status: 403 }
      )
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

// ------------------------------------------
// POST - Crear gasto o ingreso
// ------------------------------------------
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // ❗ Control de acceso
    if (!allowedWrite.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear gastos' },
        { status: 403 }
      )
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
      comprador,
      metodoPago,
      iva,
      diasPlazo,
      pagado,
      loteId,
    } = body

    // Normalización
    const proveedorNormalizado = proveedor ? proveedor.trim().toLowerCase() : null
    const compradorNormalizado = comprador ? comprador.trim().toLowerCase() : null

    // Autopago si es contado
    const esPagado = pagado ?? (metodoPago === 'Contado')
    const fechaPago = esPagado ? new Date() : null

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

// ------------------------------------------
// DELETE - Eliminar gasto
// ------------------------------------------
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // ❗ Control de acceso
    if (!allowedWrite.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar gastos' },
        { status: 403 }
      )
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const gasto = await prisma.gasto.findUnique({ where: { id } })
    if (!gasto || gasto.campoId !== usuario?.campoId) {
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