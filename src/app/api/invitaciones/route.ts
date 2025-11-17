import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto"; // ✅ necesario para generar token único

// 📋 GET → Listar invitaciones del campo del usuario autenticado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener usuario con su campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      );
    }

    // Obtener todas las invitaciones del campo
    const invitaciones = await prisma.invitation.findMany({
      where: { campoId: usuario.campoId },
      include: {
        createdBy: { select: { name: true, email: true } },
        usedBy: { select: { name: true, telefono: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitaciones, { status: 200 });
  } catch (error) {
    console.error("💥 Error obteniendo invitaciones:", error);
    return NextResponse.json(
      { error: "Error obteniendo invitaciones" },
      { status: 500 }
    );
  }
}

// 🧩 POST → Crear invitación nueva
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "No se encontró campo asociado" },
        { status: 400 }
      );
    }

    const { role } = await req.json();

    if (!["COLABORADOR", "EMPLEADO", "CONTADOR"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Generar token y fecha de expiración
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Crear invitación
    const invitacion = await prisma.invitation.create({
      data: {
        token,
        role,
        campoId: usuario.campoId,
        createdById: usuario.id,
        expiresAt,
      },
    });

    // Generar link de WhatsApp con token
    const botNumber = process.env.WHATSAPP_BOT_NUMBER || "59899465242";
    const message = encodeURIComponent(invitacion.token);
    const whatsappLink = `https://wa.me/${botNumber}?text=${message}`;

    console.log(`✅ Invitación creada para campo ${usuario.campoId}`);
    console.log(`🔗 Link: ${whatsappLink}`);

    return NextResponse.json(
      {
        success: true,
        invitacion,
        whatsappLink,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("💥 Error creando invitación:", error);
    return NextResponse.json(
      { error: "Error interno al crear invitación", details: String(error) },
      { status: 500 }
    );
  }
}

// ❌ DELETE → Eliminar una invitación específica
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

    // Verificar que la invitación pertenece al campo del usuario
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      );
    }

    const invitacion = await prisma.invitation.findUnique({ where: { id } });
    if (!invitacion || invitacion.campoId !== usuario.campoId) {
      return NextResponse.json(
        { error: "No autorizado para eliminar esta invitación" },
        { status: 403 }
      );
    }

    await prisma.invitation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("💥 Error eliminando invitación:", error);
    return NextResponse.json(
      { error: "Error eliminando invitación" },
      { status: 500 }
    );
  }
}