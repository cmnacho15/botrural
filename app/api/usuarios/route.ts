// Updated: 2025-11-07
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// =======================================
// GET: Listar usuarios del campo actual
// =======================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Buscar el usuario actual con su campo asociado
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      )
    }

    // Traer todos los usuarios del mismo campo
    const usuarios = await prisma.user.findMany({
      where: { campoId: usuario.campoId },
      include: {
        _count: { select: { eventos: true } },
        campo: { select: { nombre: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    // Formatear respuesta
    const data = usuarios.map((u) => ({
      id: u.id,
      nombre: u.name || "Sin nombre",
      email: u.email || "Sin email",
      rol: u.role === "ADMIN"
        ? "Administrador con Datos Finanzas"
        : "Usuario",
      datosIngresados: u._count.eventos,
      fechaRegistro: new Date(u.createdAt).toLocaleDateString("es-UY"),
      campoNombre: u.campo?.nombre || "Campo",
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error("💥 Error al obtener usuarios:", error)
    return NextResponse.json(
      { error: "Error al obtener usuarios", details: String(error) },
      { status: 500 }
    )
  }
}