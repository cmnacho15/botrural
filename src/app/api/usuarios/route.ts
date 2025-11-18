import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * 👥 GET - Listar usuarios del campo
 * 
 * Devuelve roles humanizados y permisos
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId || usuario.role !== "ADMIN_GENERAL") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const usuarios = await prisma.user.findMany({
      where: { campoId: usuario.campoId },
      select: {
        id: true,
        name: true,
        email: true,
        telefono: true,
        role: true,
        accesoFinanzas: true,
        createdAt: true,
        _count: {
          select: { eventos: true },
        },
        campo: {
          select: { nombre: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const formateados = usuarios.map((u) => ({
      id: u.id,
      nombre: u.name?.split(" ")[0] || "Sin nombre",
      apellido: u.name?.split(" ").slice(1).join(" ") || "",
      email: u.email || "",
      telefono: u.telefono,
      roleCode: u.role,
      rol: getRoleName(u.role),
      accesoFinanzas: u.accesoFinanzas,
      datosIngresados: u._count.eventos,
      fechaRegistro: new Date(u.createdAt).toLocaleDateString("es-UY"),
      campoNombre: u.campo.nombre,
    }))

    return NextResponse.json(formateados)
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

function getRoleName(roleCode: string): string {
  const roles: Record<string, string> = {
    ADMIN_GENERAL: "Administrador",
    COLABORADOR: "Colaborador",
    EMPLEADO: "Empleado",
    CONTADOR: "Contador",
  }
  return roles[roleCode] || "Usuario"
}

/**
 * 🔧 PATCH - Actualizar permisos de usuario
 * 
 * Permite al ADMIN_GENERAL habilitar/deshabilitar accesoFinanzas de colaboradores
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    // 🔒 Solo ADMIN_GENERAL puede modificar permisos
    if (admin?.role !== "ADMIN_GENERAL") {
      return NextResponse.json(
        { error: "Solo el administrador puede modificar permisos" },
        { status: 403 }
      )
    }

    const { userId, accesoFinanzas } = await request.json()

    if (!userId || typeof accesoFinanzas !== "boolean") {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 }
      )
    }

    // Verificar que el usuario a modificar pertenece al mismo campo
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!targetUser || targetUser.campoId !== admin.campoId) {
      return NextResponse.json(
        { error: "Usuario no encontrado o no pertenece al campo" },
        { status: 404 }
      )
    }

    // Solo COLABORADOR puede tener su acceso modificado
    if (targetUser.role !== "COLABORADOR") {
      return NextResponse.json(
        { error: "Solo se puede modificar el acceso de colaboradores" },
        { status: 400 }
      )
    }

    // Actualizar permiso
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accesoFinanzas },
    })

    console.log(`✅ Permiso actualizado: ${updated.name} → accesoFinanzas: ${accesoFinanzas}`)

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        accesoFinanzas: updated.accesoFinanzas,
      },
    })
  } catch (error) {
    console.error("💥 Error actualizando permisos:", error)
    return NextResponse.json(
      { error: "Error actualizando permisos" },
      { status: 500 }
    )
  }
}