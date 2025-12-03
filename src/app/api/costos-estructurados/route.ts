import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { CATEGORIAS_COSTOS_ESTRUCTURADOS, getAllSubcategorias } from '@/lib/costos-estructurados'

/**
 * GET - Listar todos los meses de costos estructurados del campo
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const anio = searchParams.get('anio')

    const where: any = {
      campoId: session.user.campoId,
    }

    if (anio) {
      where.anio = parseInt(anio)
    }

    const costosMensuales = await prisma.costoMensual.findMany({
      where,
      include: {
        renglones: {
          orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
        },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    })

    return NextResponse.json(costosMensuales)
  } catch (error) {
    console.error('Error al obtener costos mensuales:', error)
    return NextResponse.json(
      { error: 'Error al obtener costos mensuales' },
      { status: 500 }
    )
  }
}

/**
 * POST - Crear nuevo mes de costos estructurados
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.campoId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      mes,
      anio,
      hectareasVacuno = 0,
      hectareasOvino = 0,
      hectareasEquino = 0,
      hectareasDesperdicios = 0,
    } = body

    // Validaciones
    if (!mes || !anio) {
      return NextResponse.json(
        { error: 'Mes y año son requeridos' },
        { status: 400 }
      )
    }

    if (mes < 1 || mes > 12) {
      return NextResponse.json(
        { error: 'El mes debe estar entre 1 y 12' },
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existente = await prisma.costoMensual.findUnique({
      where: {
        campoId_mes_anio: {
          campoId: session.user.campoId,
          mes,
          anio,
        },
      },
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un registro para este mes y año' },
        { status: 400 }
      )
    }

    // Calcular hectáreas total
    const hectareasTotal =
      hectareasVacuno + hectareasOvino + hectareasEquino + hectareasDesperdicios

    // Crear el mes con estructura vacía
    const costoMensual = await prisma.costoMensual.create({
      data: {
        campoId: session.user.campoId,
        mes,
        anio,
        hectareasVacuno,
        hectareasOvino,
        hectareasEquino,
        hectareasDesperdicios,
        hectareasTotal,
      },
    })

    // Crear todos los renglones vacíos basados en la estructura
    const subcategorias = getAllSubcategorias()
    const renglonesData = subcategorias.map((sub) => ({
      costoMensualId: costoMensual.id,
      categoria: sub.categoria,
      subcategoria: sub.subcategoria,
      orden: sub.orden,
      montoTotalUSD: 0,
      montoVacunoUSD: 0,
      montoOvinoUSD: 0,
      montoEquinoUSD: 0,
      montoDesperdiciosUSD: 0,
      esTotal: false,
      editable: true,
    }))

    // Agregar renglones de TOTAL por cada categoría
    Object.keys(CATEGORIAS_COSTOS_ESTRUCTURADOS).forEach((catKey) => {
      renglonesData.push({
        costoMensualId: costoMensual.id,
        categoria: catKey,
        subcategoria: 'TOTAL',
        orden: 9999,
        montoTotalUSD: 0,
        montoVacunoUSD: 0,
        montoOvinoUSD: 0,
        montoEquinoUSD: 0,
        montoDesperdiciosUSD: 0,
        esTotal: true,
        editable: false,
      })
    })

    await prisma.costoRenglon.createMany({
      data: renglonesData,
    })

    // Obtener el resultado completo
    const resultado = await prisma.costoMensual.findUnique({
      where: { id: costoMensual.id },
      include: {
        renglones: {
          orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
        },
      },
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    console.error('Error al crear costo mensual:', error)
    return NextResponse.json(
      { error: 'Error al crear costo mensual' },
      { status: 500 }
    )
  }
}