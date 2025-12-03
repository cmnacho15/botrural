import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { convertirAUYU, obtenerTasaCambio } from '@/lib/currency'

// ===========================================================
// GET - Obtener INGRESOS del usuario autenticado
// ===========================================================
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

// ===========================================================
// POST - Crear nuevo INGRESO
// ===========================================================
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
      animalLoteId,
      cantidadVendida,
      moneda,
    } = body

    // -----------------------------------------------------
    // 💰 CONVERSIÓN DE MONEDA
    // -----------------------------------------------------
    const montoFloat = parseFloat(monto)
    const monedaIngreso = moneda || 'UYU'

    const montoEnUYU = await convertirAUYU(montoFloat, monedaIngreso)
    const tasaCambio = await obtenerTasaCambio(monedaIngreso)

    // -----------------------------------------------------
    // 🐄 VALIDAR Y ACTUALIZAR STOCK ANIMAL
    // -----------------------------------------------------
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

      await prisma.animalLote.update({
        where: { id: animalLoteId },
        data: {
          cantidad: animalLote.cantidad - cantidadVendida,
        },
      })
    }

    const compradorNormalizado = comprador
      ? comprador.trim().toLowerCase()
      : null

    // -----------------------------------------------------
// 💰 MONTOS CORRECTOS
// -----------------------------------------------------
const montoOriginalFinal = montoFloat
const montoEnUYUFinal = montoEnUYU
const montoPrincipal = montoEnUYUFinal

// -----------------------------------------------------
// 📅 CORREGIR FECHA (evitar cambio de día por zona horaria)
// -----------------------------------------------------
const fechaISO = fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`

// -----------------------------------------------------
// 🧱 DATA FINAL PARA CREAR INGRESO
// -----------------------------------------------------

// ✅ Calcular montoEnUSD
const montoEnUSD = monedaIngreso === "USD" 
  ? montoOriginalFinal 
  : montoOriginalFinal / (tasaCambio || 40)

const dataToCreate = {
  tipo: 'INGRESO',

  // 💰 MONTOS CORREGIDOS
  monto: montoPrincipal,
  montoOriginal: montoOriginalFinal,
  moneda: monedaIngreso,
  montoEnUYU: montoEnUYUFinal,
  montoEnUSD: montoEnUSD,  // ✅ NUEVO
  tasaCambio: tasaCambio,
  especie: null,  // ✅ NUEVO (ingresos no se asignan a especies)

  fecha: new Date(fechaISO),
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

  animalLoteId: animalLoteId || null,
  cantidadVendida: cantidadVendida || null,
}

    console.log('📤 Data a crear:', dataToCreate)

    // -----------------------------------------------------
    // 📌 CREAR INGRESO EN BD
    // -----------------------------------------------------
    const ingreso = await prisma.gasto.create({
      data: dataToCreate,
      include: { lote: true },
    })

    console.log('✅ Ingreso creado:', ingreso.id)
    return NextResponse.json(ingreso, { status: 201 })
  } catch (error) {
    console.error('💥 Error completo:', error)
    return NextResponse.json(
      {
        error: 'Error creando ingreso',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}