import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * GET - Obtener grupos del usuario
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuarioGrupos = await prisma.usuarioGrupo.findMany({
      where: { userId: session.user.id },
      include: {
        grupo: {
          include: {
            campos: {
              select: { id: true, nombre: true }
            },
            _count: {
              select: { campos: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const grupos = usuarioGrupos.map(ug => ({
      id: ug.grupo.id,
      nombre: ug.grupo.nombre,
      rol: ug.rol,
      esActivo: ug.esActivo,
      cantidadCampos: ug.grupo._count.campos,
      campos: ug.grupo.campos
    }))

    return NextResponse.json(grupos)
  } catch (error) {
    console.error("Error obteniendo grupos:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * POST - Crear nuevo grupo
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { nombre } = await request.json()

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre debe tener al menos 2 caracteres" },
        { status: 400 }
      )
    }

    // Crear grupo y relación en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const grupo = await tx.grupo.create({
        data: { nombre: nombre.trim() }
      })

      // Desactivar otros grupos del usuario
      await tx.usuarioGrupo.updateMany({
        where: { userId: session.user.id },
        data: { esActivo: false }
      })

      // Crear relación
      await tx.usuarioGrupo.create({
        data: {
          userId: session.user.id,
          grupoId: grupo.id,
          rol: 'ADMIN_GENERAL',
          esActivo: true
        }
      })

      return grupo
    })

    console.log(`✅ Grupo creado: ${resultado.nombre}`)

    return NextResponse.json({
      success: true,
      grupo: resultado
    }, { status: 201 })
  } catch (error) {
    console.error("Error creando grupo:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}