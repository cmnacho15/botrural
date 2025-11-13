import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ========================================================
// GET → obtener registros por mes y año
// ========================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes'))
    const anio = Number(searchParams.get('anio'))

    if (isNaN(mes) || isNaN(anio)) {
      return NextResponse.json(
        { error: 'Mes o año inválido' },
        { status: 400 }
      )
    }

    const data = await prisma.manoObra.findMany({
      where: { mes, anio },
      orderBy: { nombre: 'asc' }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error GET mano_obra:', error)
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 })
  }
}

// ========================================================
// POST → crear un nuevo registro
// ========================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const nuevo = await prisma.manoObra.create({
      data: {
        nombre: body.nombre,
        horas_trabajadas: body.horas_trabajadas ?? 0,
        dias_trabajados: body.dias_trabajados ?? 0,
        dias_no_trabajados: body.dias_no_trabajados ?? 0,
        feriados_trabajados: body.feriados_trabajados ?? 0,
        dias_descanso_trabajados: body.dias_descanso_trabajados ?? 0,
        faltas: body.faltas ?? 0,
        horas_extras: body.horas_extras ?? 0,
        licencias: body.licencias ?? 0,
        mes: body.mes,
        anio: body.anio,
      }
    })

    return NextResponse.json(nuevo)
  } catch (error) {
    console.error('❌ Error POST mano_obra:', error)
    return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
  }
}

// ========================================================
// PUT → actualizar un registro existente
// ========================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id, ...resto } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es obligatorio para actualizar' },
        { status: 400 }
      )
    }

    const actualizado = await prisma.manoObra.update({
      where: { id: String(id) },
      data: resto
    })

    return NextResponse.json(actualizado)
  } catch (error) {
    console.error('❌ Error PUT mano_obra:', error)
    return NextResponse.json({ error: 'Error al actualizar registro' }, { status: 500 })
  }
}

// ========================================================
// DELETE → eliminar un registro por ID
// ========================================================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido para eliminar' },
        { status: 400 }
      )
    }

    const eliminado = await prisma.manoObra.delete({
      where: { id: String(id) }
    })

    return NextResponse.json(eliminado)
  } catch (error) {
    console.error('❌ Error DELETE mano_obra:', error)
    return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 })
  }
}