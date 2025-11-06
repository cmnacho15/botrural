import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import crypto from "crypto"

export async function POST(req: Request) {
  console.log("=== INICIO POST /api/invitaciones ===")
  try {
    const session = await getServerSession(authOptions)
    console.log("1. Session:", session)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    if (!usuario?.campo) {
      return NextResponse.json({ error: "No se encontró campo asociado" }, { status: 400 })
    }

    const { role } = await req.json()
    const token = crypto.randomBytes(16).toString("hex")

    const invitacion = await prisma.invitation.create({
      data: {
        token,
        role,
        campoId: usuario.campo.id,
        createdById: usuario.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 días
      },
    })

    // ✅ Nuevo bloque: envío de WhatsApp automático
    const phoneId = process.env.WHATSAPP_PHONE_ID
    const tokenWhatsapp = process.env.WHATSAPP_TOKEN

    const whatsappLink = `https://wa.me/59899465242?text=${encodeURIComponent(
      `Nueva invitación para unirte al campo ${usuario.campo.nombre}. Ingresá aquí: http://localhost:3000/registrarse?token=${token}`
    )}`

    const apiUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`
    const payload = {
      messaging_product: "whatsapp",
      to: "59899465242", // acá podés cambiarlo al número destino real
      type: "text",
      text: { body: `🌾 Invitación creada: ${whatsappLink}` },
    }

    await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenWhatsapp}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log("✅ Mensaje de invitación enviado por WhatsApp")

    return NextResponse.json({
      success: true,
      invitacion,
      whatsappLink,
    })
  } catch (error) {
    console.error("💥 ERROR COMPLETO:", error)
    return NextResponse.json({ error: "Error interno", details: error }, { status: 500 })
  }
}