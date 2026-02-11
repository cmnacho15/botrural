import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import crypto from "crypto"

/**
 * 📋 GET - Listar invitaciones del campo
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "Usuario sin campo asignado" },
        { status: 400 }
      )
    }

    // Solo ADMIN_GENERAL o MEGA_ADMIN pueden ver invitaciones
    if (!["ADMIN_GENERAL", "MEGA_ADMIN"].includes(usuario.role)) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const invitaciones = await prisma.invitation.findMany({
      where: { campoId: usuario.campoId },
      include: {
        createdBy: { select: { name: true, email: true } },
        usedBy: { select: { name: true, telefono: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(invitaciones, { status: 200 })
  } catch (error) {
    console.error("💥 Error obteniendo invitaciones:", error)
    return NextResponse.json(
      { error: "Error obteniendo invitaciones" },
      { status: 500 }
    )
  }
}

/**
 * 🎫 POST - Crear invitación
 * 
 * Tipos:
 * - COLABORADOR → Link WhatsApp
 * - EMPLEADO → Link WhatsApp
 * - CONTADOR → Link web directo
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "No se encontró campo asociado" },
        { status: 400 }
      )
    }

    // 🔒 Solo ADMIN_GENERAL o MEGA_ADMIN pueden crear invitaciones
    if (!["ADMIN_GENERAL", "MEGA_ADMIN"].includes(usuario.role)) {
      return NextResponse.json(
        { error: "Solo el administrador puede crear invitaciones" },
        { status: 403 }
      )
    }

    const { role, campoIds } = await req.json()

    // Validar tipo de invitación
    if (!["COLABORADOR", "EMPLEADO", "CONTADOR"].includes(role)) {
      return NextResponse.json(
        { error: "Tipo de invitación inválido" },
        { status: 400 }
      )
    }

    // Generar token único y fecha de expiración
    const token = crypto.randomBytes(16).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 días

    // Crear invitación
const invitacion = await prisma.invitation.create({
  data: {
    token,
    role,
    campoId: usuario.campoId,
    campoIds: Array.isArray(campoIds) && campoIds.length > 0 ? campoIds : [usuario.campoId],
    createdById: usuario.id,
    expiresAt,
  },
})

    // 🔗 Generar links según tipo
    const botNumber = process.env.WHATSAPP_BOT_NUMBER || "59899465242"
    const webUrl = process.env.NEXTAUTH_URL || "https://micampodata.com"

    let link = ""
    let linkType: "whatsapp" | "web" = "whatsapp"

    if (role === "CONTADOR") {
      // CONTADOR → Link web directo
      link = `${webUrl}/register?token=${token}`
      linkType = "web"
    } else {
      // COLABORADOR y EMPLEADO → Link WhatsApp
      const message = encodeURIComponent(token)
      link = `https://wa.me/${botNumber}?text=${message}`
      linkType = "whatsapp"
    }

    console.log(`✅ Invitación ${role} creada para campo ${usuario.campoId}`)
    console.log(`🔗 Link (${linkType}): ${link}`)

    return NextResponse.json(
  {
    success: true,
    invitacion: {
      id: invitacion.id,
      token: invitacion.token,
      role: invitacion.role,
      expiresAt: invitacion.expiresAt,
    },
    link,      // ✅ BIEN - usar "link"
    linkType,
  },
  { status: 201 }
)
  } catch (error) {
    console.error("💥 Error creando invitación:", error)
    return NextResponse.json(
      { error: "Error interno al crear invitación" },
      { status: 500 }
    )
  }
}

/**
 * ❌ DELETE - Eliminar invitación
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!usuario?.campoId || !["ADMIN_GENERAL", "MEGA_ADMIN"].includes(usuario.role)) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const invitacion = await prisma.invitation.findUnique({ where: { id } })
    if (!invitacion || invitacion.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: "No autorizado para eliminar esta invitación" },
        { status: 403 }
      )
    }

    await prisma.invitation.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("💥 Error eliminando invitación:", error)
    return NextResponse.json(
      { error: "Error eliminando invitación" },
      { status: 500 }
    )
  }
}