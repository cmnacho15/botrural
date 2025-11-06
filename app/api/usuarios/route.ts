import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

// =======================================
// GET: Listar usuarios del campo actual
// =======================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Buscar el usuario actual y su campo asociado
    const usuario = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { campo: true },
    })

    if (!usuario || !usuario.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    // Traer todos los usuarios del mismo campo
    const usuarios = await prisma.user.findMany({
      where: { campoId: usuario.campoId },
      include: {
        _count: { select: { eventos: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const data = usuarios.map((u) => ({
      id: u.id,
      nombre: u.name,
      email: u.email,
      rol: u.role === "ADMIN"
        ? "Administrador con Datos Finanzas"
        : "Usuario",
      datosIngresados: u._count.eventos,
      fechaRegistro: new Date(u.createdAt).toLocaleDateString("es-UY"),
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error al obtener usuarios:", error)
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    )
  }
}