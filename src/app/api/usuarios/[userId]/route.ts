import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

/**
 * DELETE - Eliminar usuario del campo
 */
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
    console.log("🗑️ DELETE request recibido para userId:", params.userId)
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Verificar que el usuario actual es ADMIN_GENERAL
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, campoId: true },
    })

    if (adminUser?.role !== "ADMIN_GENERAL") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Buscar el usuario a eliminar
    const userToDelete = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { 
        id: true, 
        name: true, 
        campoId: true, 
        role: true,
        telefono: true,
      },
    })

    if (!userToDelete) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Verificar que el usuario pertenece al mismo campo
    if (userToDelete.campoId !== adminUser.campoId) {
      return NextResponse.json({ error: "No puedes eliminar usuarios de otro campo" }, { status: 403 })
    }

    // No permitir que se elimine a sí mismo
    if (userToDelete.id === session.user.id) {
      return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
    }

    // Eliminar todo relacionado al usuario (excepto eventos)
    await prisma.$transaction(async (tx) => {
      // 1. NO eliminar eventos - solo desvincular el usuario
      await tx.evento.updateMany({
        where: { usuarioId: userToDelete.id },
        data: { usuarioId: null },
      })

      // 2. Eliminar confirmaciones pendientes (si usa WhatsApp)
      if (userToDelete.telefono) {
        await tx.pendingConfirmation.deleteMany({
          where: { telefono: userToDelete.telefono },
        })

        await tx.pendingRegistration.deleteMany({
          where: { telefono: userToDelete.telefono },
        })
      }

      // 3. Marcar invitaciones como no usadas
      await tx.invitation.updateMany({
        where: { usedById: userToDelete.id },
        data: { 
          usedAt: null,
          usedById: null,
        },
      })

      // 4. Eliminar el usuario
      await tx.user.delete({
        where: { id: userToDelete.id },
      })
    })

    console.log(`✅ Usuario eliminado: ${userToDelete.name} (${userToDelete.role})`)

    return NextResponse.json({
      success: true,
      message: `Usuario ${userToDelete.name} eliminado correctamente`,
    })

  } catch (error) {
    console.error("💥 Error eliminando usuario:", error)
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    )
  }
}