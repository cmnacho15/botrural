import { prisma } from '@/lib/prisma' // HOLA
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ GET - Obtener gastos del campo del usuario autenticado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Buscar usuario con su campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json([], { status: 200 })
    }

    // Leer filtros de query params
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const categoria = searchParams.get('categoria')

    // ✅ Filtrar por campoId del usuario
    const where: any = { campoId: usuario.campoId }
    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria

    const gastos = await prisma.gasto.findMany({
      where,
      include: { lote: { select: { nombre: true } } },
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' }, // ✅ Ordenar también por fecha de creación
      ],
    })

    return NextResponse.json(gastos)
  } catch (error) {
    console.error('💥 Error obteniendo gastos:', error)
    return NextResponse.json({ error: 'Error obteniendo gastos' }, { status: 500 })
  }
}

// ✅ POST - Crear nuevo gasto asociado al campo del usuario
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
    // ✅ Incluimos iva aquí para evitar error
    const { tipo, monto, fecha, descripcion, categoria, metodoPago, loteId, iva } = body

    const gasto = await prisma.gasto.create({
      data: {
        tipo,
        monto: parseFloat(monto),
        fecha: new Date(fecha),
        descripcion,
        categoria,
        metodoPago,
        iva: iva ? parseFloat(iva) : null, // ✅ guarda el IVA si viene
        campoId: usuario.campoId, // ✅ asociar al campo del usuario
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

// ✅ DELETE - Eliminar gasto solo si pertenece al campo del usuario autenticado
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

    // ✅ Verificar que el gasto pertenece al mismo campo
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
