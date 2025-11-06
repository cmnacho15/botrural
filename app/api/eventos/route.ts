import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

// ==============================================
// POST: Crear un nuevo evento
// ==============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Buscar el usuario por email
    const usuario = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const usuarioId = usuario.id
    const campo = await prisma.campo.findFirst()

    if (!campo) {
      return NextResponse.json(
        { error: "No hay campo configurado" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { tipo, fecha, descripcion, loteId, cantidad, categoria } = body

    const evento = await prisma.evento.create({
      data: {
        tipo,
        fecha: new Date(fecha),
        descripcion,
        loteId: loteId || null,
        cantidad: cantidad || null,
        categoria: categoria || null,
        usuarioId,
        campoId: campo.id,
      },
    })

    return NextResponse.json(evento, { status: 201 })
  } catch (error) {
    console.error("Error al crear evento:", error)
    return NextResponse.json(
      {
        error: "Error al crear el evento",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// ==============================================
// GET: Listar eventos
// ==============================================
export async function GET() {
  try {
    const eventos = await prisma.evento.findMany({
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json(eventos)
  } catch (error) {
    console.error("Error al obtener eventos:", error)
    return NextResponse.json(
      { error: "Error al obtener eventos" },
      { status: 500 }
    )
  }
}