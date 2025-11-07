import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📋 GET - Listar invitaciones del campo
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (!usuario?.campo) {
      return NextResponse.json({ error: "No se encontró campo" }, { status: 400 });
    }

    const invitations = await prisma.invitation.findMany({
      where: { campoId: usuario.campo.id },
      include: {
        createdBy: { select: { name: true, email: true } },
        usedBy: { select: { name: true, telefono: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("💥 Error obteniendo invitaciones:", error);
    return NextResponse.json({ error: "Error obteniendo invitaciones" }, { status: 500 });
  }
}

// 🧩 POST - Crear invitación
export async function POST(req: Request) {
  console.log("=== INICIO POST /api/invitaciones ===");
  try {
    const session = await getServerSession(authOptions);
    console.log("1️⃣ Session:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (!usuario?.campo) {
      return NextResponse.json({ error: "No se encontró campo asociado" }, { status: 400 });
    }

    const { role } = await req.json();

    if (!["ADMIN", "USUARIO"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitacion = await prisma.invitation.create({
      data: {
        role,
        campoId: usuario.campo.id,
        createdById: usuario.id,
        expiresAt,
      },
    });

    console.log("✅ Invitación creada:", invitacion.id);

    // 🔗 Generar link de WhatsApp con el TOKEN
    const botNumber = process.env.WHATSAPP_BOT_NUMBER || "59899465242";
    const message = encodeURIComponent(invitacion.token);
    const whatsappLink = `https://wa.me/${botNumber}?text=${message}`;

    console.log("🔗 Link generado:", whatsappLink);

    return NextResponse.json({
      success: true,
      invitacion,
      whatsappLink,
    });
  } catch (error) {
    console.error("💥 ERROR COMPLETO:", error);
    return NextResponse.json(
      { error: "Error interno", details: String(error) },
      { status: 500 }
    );
  }
}

// ❌ DELETE - Eliminar invitación
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.invitation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("💥 Error eliminando invitación:", error);
    return NextResponse.json({ error: "Error eliminando invitación" }, { status: 500 });
  }
}