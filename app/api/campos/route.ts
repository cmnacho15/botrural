import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 🧱 POST → Crear campo y asociarlo al usuario actual
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { nombre } = await req.json();

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido" },
        { status: 400 }
      );
    }

    // Verificar si el usuario ya tiene un campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario ya tiene un campo asociado" },
        { status: 400 }
      );
    }

    // Crear campo nuevo
    const campo = await prisma.campo.create({
      data: {
        nombre: nombre.trim(),
        usuarios: {
          connect: { id: session.user.id },
        },
      },
    });

    // Actualizar usuario para asociarlo al campo y hacerlo ADMIN
    await prisma.user.update({
      where: { id: session.user.id },
      data: { campoId: campo.id, role: "ADMIN" },
    });

    return NextResponse.json({
      success: true,
      message: "Campo creado y usuario asociado correctamente ✅",
      campo,
    });
  } catch (error) {
    console.error("💥 Error creando campo:", error);
    return NextResponse.json(
      { error: "Error interno al crear campo", details: String(error) },
      { status: 500 }
    );
  }
}