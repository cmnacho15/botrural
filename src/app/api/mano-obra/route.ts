import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ========================================================
// GET → obtener registros por mes y año
// ========================================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mes = searchParams.get('mes')
    const anio = searchParams.get('anio')

    if (!mes || !anio) {
      return NextResponse.json(
        { error: 'Parámetros mes y anio son requeridos' },
        { status: 400 }
      )
    }

    const mesNum = Number(mes)
    const anioNum = Number(anio)

    if (isNaN(mesNum) || isNaN(anioNum)) {
      return NextResponse.json(
        { error: 'Mes o año inválido' },
        { status: 400 }
      )
    }

    console.log('📊 Buscando registros para:', { mes: mesNum, anio: anioNum })

    const data = await prisma.manoObra.findMany({
      where: { 
        mes: mesNum, 
        anio: anioNum 
      },
      orderBy: { nombre: 'asc' }
    })

    console.log('✅ Registros encontrados:', data.length)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('❌ Error GET mano_obra:', error)
    return NextResponse.json({ 
      error: 'Error al obtener datos',
      details: error.message 
    }, { status: 500 })
  }
}

// ========================================================
// POST → crear un nuevo registro
// ========================================================
export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log('📝 Creando registro:', body)

    if (!body.nombre || body.mes === undefined || body.anio === undefined) {
      return NextResponse.json(
        { error: 'Nombre, mes y año son obligatorios' },
        { status: 400 }
      )
    }

    const nuevo = await prisma.manoObra.create({
      data: {
        nombre: body.nombre,
        horas_trabajadas: Number(body.horas_trabajadas) || 0,
        dias_trabajados: Number(body.dias_trabajados) || 0,
        dias_no_trabajados: Number(body.dias_no_trabajados) || 0,
        feriados_trabajados: Number(body.feriados_trabajados) || 0,
        dias_descanso_trabajados: Number(body.dias_descanso_trabajados) || 0,
        faltas: Number(body.faltas) || 0,
        horas_extras: Number(body.horas_extras) || 0,
        licencias: Number(body.licencias) || 0,
        trabajo_feriado: body.trabajo_feriado === true || body.trabajo_feriado === 1, // ✅ AGREGADO
        mes: Number(body.mes),
        anio: Number(body.anio),
      }
    })

    console.log('✅ Registro creado:', nuevo.id)

    return NextResponse.json(nuevo)
  } catch (error: any) {
    console.error('❌ Error POST mano_obra:', error)
    return NextResponse.json({ 
      error: 'Error al crear registro',
      details: error.message 
    }, { status: 500 })
  }
}

// ========================================================
// PUT → actualizar un registro existente
// ========================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id, ...resto } = body

    console.log('✏️ Actualizando registro:', id, resto)

    if (!id) {
      return NextResponse.json(
        { error: 'ID es obligatorio para actualizar' },
        { status: 400 }
      )
    }

    // Preparar datos para actualización
    const dataToUpdate: any = {}
    
    if (resto.nombre) dataToUpdate.nombre = resto.nombre
    if (resto.horas_trabajadas !== undefined) dataToUpdate.horas_trabajadas = Number(resto.horas_trabajadas)
    if (resto.dias_trabajados !== undefined) dataToUpdate.dias_trabajados = Number(resto.dias_trabajados)
    if (resto.dias_no_trabajados !== undefined) dataToUpdate.dias_no_trabajados = Number(resto.dias_no_trabajados)
    if (resto.feriados_trabajados !== undefined) dataToUpdate.feriados_trabajados = Number(resto.feriados_trabajados)
    if (resto.dias_descanso_trabajados !== undefined) dataToUpdate.dias_descanso_trabajados = Number(resto.dias_descanso_trabajados)
    if (resto.faltas !== undefined) dataToUpdate.faltas = Number(resto.faltas)
    if (resto.horas_extras !== undefined) dataToUpdate.horas_extras = Number(resto.horas_extras)
    if (resto.licencias !== undefined) dataToUpdate.licencias = Number(resto.licencias)
    
    // ✅ AGREGADO: guardar trabajo_feriado
    if (resto.trabajo_feriado !== undefined) {
      dataToUpdate.trabajo_feriado = resto.trabajo_feriado === true || resto.trabajo_feriado === 1
    }

    console.log('📦 Datos a actualizar:', dataToUpdate)

    const actualizado = await prisma.manoObra.update({
      where: { id: String(id) },
      data: dataToUpdate
    })

    console.log('✅ Registro actualizado')

    return NextResponse.json(actualizado)
  } catch (error: any) {
    console.error('❌ Error PUT mano_obra:', error)
    return NextResponse.json({ 
      error: 'Error al actualizar registro',
      details: error.message 
    }, { status: 500 })
  }
}

// ========================================================
// DELETE → eliminar un registro por ID
// ========================================================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    console.log('🗑️ Eliminando registro:', id)

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido para eliminar' },
        { status: 400 }
      )
    }

    const eliminado = await prisma.manoObra.delete({
      where: { id: String(id) }
    })

    console.log('✅ Registro eliminado')

    return NextResponse.json(eliminado)
  } catch (error: any) {
    console.error('❌ Error DELETE mano_obra:', error)
    return NextResponse.json({ 
      error: 'Error al eliminar registro',
      details: error.message 
    }, { status: 500 })
  }
}