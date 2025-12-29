import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * POST - Cambiar el grupo activo del usuario
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { grupoId } = await request.json()

    if (!grupoId) {
      return NextResponse.json({ error: "grupoId es requerido" }, { status: 400 })
    }

    // Verificar que el usuario tiene acceso a ese grupo
    const usuarioGrupo = await prisma.usuarioGrupo.findFirst({
      where: {
        userId: session.user.id,
        grupoId: grupoId
      },
      include: {
        grupo: {
          include: {
            campos: {
              take: 1,
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    })

    if (!usuarioGrupo) {
      return NextResponse.json({ error: "No tenés acceso a ese grupo" }, { status: 403 })
    }

    // Transacción para cambiar grupo y campo activo
    await prisma.$transaction(async (tx) => {
      // Desactivar todos los grupos del usuario
      await tx.usuarioGrupo.updateMany({
        where: { userId: session.user.id },
        data: { esActivo: false }
      })

      // Activar el grupo seleccionado
      await tx.usuarioGrupo.updateMany({
        where: {
          userId: session.user.id,
          grupoId: grupoId
        },
        data: { esActivo: true }
      })

      // Si el grupo tiene campos, activar el primero
      if (usuarioGrupo.grupo.campos.length > 0) {
        const primerCampo = usuarioGrupo.grupo.campos[0]

        // Desactivar todos los campos del usuario
        await tx.usuarioCampo.updateMany({
          where: { userId: session.user.id },
          data: { esActivo: false }
        })

        // Activar el primer campo del grupo (si el usuario tiene acceso)
        await tx.usuarioCampo.updateMany({
          where: {
            userId: session.user.id,
            campoId: primerCampo.id
          },
          data: { esActivo: true }
        })

        // Actualizar User.campoId
        await tx.user.update({
          where: { id: session.user.id },
          data: { campoId: primerCampo.id }
        })
      }
    })

    console.log(`✅ Grupo activo cambiado a: ${usuarioGrupo.grupo.nombre}`)

    return NextResponse.json({
      success: true,
      grupo: {
        id: usuarioGrupo.grupo.id,
        nombre: usuarioGrupo.grupo.nombre
      }
    })
  } catch (error) {
    console.error("Error cambiando grupo activo:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}