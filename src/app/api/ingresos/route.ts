import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ GET - Obtener solo INGRESOS del usuario autenticado
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
    const categoria = searchParams.get('categoria')
    const comprador = searchParams.get('comprador')

    const where: any = {
      campoId: usuario.campoId,
      tipo: 'INGRESO',
    }

    if (categoria) where.categoria = categoria
    if (comprador) where.comprador = comprador.toLowerCase().trim()

    const ingresos = await prisma.gasto.findMany({
      where,
      include: { lote: { select: { nombre: true } } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(ingresos)
  } catch (error) {
    console.error('💥 Error obteniendo ingresos:', error)
    return NextResponse.json(
      { error: 'Error obteniendo ingresos' },
      { status: 500 }
    )
  }
}

// ✅ POST - Crear nuevo INGRESO
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
      return NextResponse.json(
        { error: 'El usuario no tiene un campo asignado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    console.log('📥 Body recibido:', body)

    const {
      monto,
      fecha,
      descripcion,
      categoria,
      comprador,
      metodoPago,
      iva,
      diasPlazo,
      pagado,
      loteId,
      animalLoteId, // ✅ NUEVO
      cantidadVendida, // ✅ NUEVO
    } = body

    // ✅ VALIDAR SI ES VENTA DE ANIMAL
    if (animalLoteId && cantidadVendida) {
      const animalLote = await prisma.animalLote.findUnique({
        where: { id: animalLoteId },
      })

      if (!animalLote) {
        return NextResponse.json(
          { error: 'Animal no encontrado' },
          { status: 404 }
        )
      }

      if (animalLote.cantidad < cantidadVendida) {
        return NextResponse.json(
          {
            error: `Stock insuficiente. Disponible: ${animalLote.cantidad}, Solicitado: ${cantidadVendida}`,
          },
          { status: 400 }
        )
      }

      // ✅ ACTUALIZAR STOCK
      await prisma.animalLote.update({
        where: { id: animalLoteId },
        data: {
          cantidad: animalLote.cantidad - cantidadVendida,
        },
      })

      console.log(
        `✅ Stock actualizado: ${animalLote.categoria} - Nuevo stock: ${
          animalLote.cantidad - cantidadVendida
        }`
      )
    }

    const compradorNormalizado = comprador
      ? comprador.trim().toLowerCase()
      : null

    const dataToCreate = {
  tipo: 'INGRESO',
  monto: parseFloat(monto),
  fecha: new Date(fecha),
  descripcion,
  categoria: categoria || 'Otros',
  comprador: compradorNormalizado,
  proveedor: null,
  metodoPago: metodoPago || 'Contado',
  diasPlazo: diasPlazo ? parseInt(diasPlazo) : null,
  pagado: pagado ?? (metodoPago === 'Contado' ? true : false),
  iva: iva ? parseFloat(iva) : null,
  campoId: usuario.campoId,
  loteId: loteId || null,
  // ✅ AGREGAR ESTAS 2 LÍNEAS:
  animalLoteId: animalLoteId || null,
  cantidadVendida: cantidadVendida || null,
}

    console.log('📤 Data a crear:', dataToCreate)

    const ingreso = await prisma.gasto.create({
      data: dataToCreate,
      include: { lote: true },
    })

    console.log('✅ Ingreso creado:', ingreso.id)

    return NextResponse.json(ingreso, { status: 201 })
  } catch (error) {
    console.error('💥 Error completo:', error)
    console.error('💥 Stack trace:', (error as Error).stack)
    return NextResponse.json(
      {
        error: 'Error creando ingreso',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}