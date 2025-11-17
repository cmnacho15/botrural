import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, canAccessFinanzas, canWriteFinanzas } from "@/lib/auth-helpers"


/**
 * 📊 GET – listar mano de obra solo del campo del usuario
 */
export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canAccessFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes acceso a mano de obra" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mes = searchParams.get("mes")
    const anio = searchParams.get("anio")

    const registros = await prisma.manoObra.findMany({
      where: {
        campoId: user!.campoId!,   // ⭐ YA NO MARCA ERROR
        ...(mes ? { mes: Number(mes) } : {}),
        ...(anio ? { anio: Number(anio) } : {})
      },
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
    })

    return NextResponse.json(registros)
  } catch (error) {
    console.error("💥 Error GET mano de obra:", error)
    return NextResponse.json({ error: "Error obteniendo datos" }, { status: 500 })
  }
}



/**
 * ➕ POST – crear registro
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear registros" },
        { status: 403 }
      )
    }

    const body = await request.json()

    const nuevo = await prisma.manoObra.create({
      data: {
        ...body,
        horas_trabajadas: Number(body.horas_trabajadas) || 0,
        dias_trabajados: Number(body.dias_trabajados) || 0,
        dias_no_trabajados: Number(body.dias_no_trabajados) || 0,
        feriados_trabajados: Number(body.feriados_trabajados) || 0,
        dias_descanso_trabajados: Number(body.dias_descanso_trabajados) || 0,
        faltas: Number(body.faltas) || 0,
        horas_extras: Number(body.horas_extras) || 0,
        licencias: Number(body.licencias) || 0,
        trabajo_feriado: !!body.trabajo_feriado,
        campoId: user!.campoId!,   // ⭐ AHORA EXISTE EN EL MODELO
      },
    })

    return NextResponse.json(nuevo, { status: 201 })
  } catch (error) {
    console.error("💥 Error POST mano de obra:", error)
    return NextResponse.json({ error: "Error creando registro" }, { status: 500 })
  }
}



/**
 * ✏️ PUT – actualizar
 */
export async function PUT(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para editar registros" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, ...resto } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    // Verificar que el registro pertenece al campo
    const existente = await prisma.manoObra.findUnique({
      where: { id },
    })

    if (!existente || existente.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    const actualizado = await prisma.manoObra.update({
      where: { id },
      data: {
        ...resto,
        horas_trabajadas: Number(resto.horas_trabajadas) || 0,
        dias_trabajados: Number(resto.dias_trabajados) || 0,
        dias_no_trabajados: Number(resto.dias_no_trabajados) || 0,
        feriados_trabajados: Number(resto.feriados_trabajados) || 0,
        dias_descanso_trabajados: Number(resto.dias_descanso_trabajados) || 0,
        faltas: Number(resto.faltas) || 0,
        horas_extras: Number(resto.horas_extras) || 0,
        licencias: Number(resto.licencias) || 0,
        trabajo_feriado: !!resto.trabajo_feriado,
      },
    })

    return NextResponse.json(actualizado)
  } catch (error) {
    console.error("💥 Error PUT mano de obra:", error)
    return NextResponse.json({ error: "Error actualizando" }, { status: 500 })
  }
}



/**
 * ❌ DELETE – eliminar
 */
export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    if (!canWriteFinanzas(user!)) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar registros" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const existente = await prisma.manoObra.findUnique({
      where: { id },
    })

    if (!existente || existente.campoId !== user!.campoId) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      )
    }

    await prisma.manoObra.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("💥 Error DELETE mano de obra:", error)
    return NextResponse.json({ error: "Error eliminando" }, { status: 500 })
  }
}