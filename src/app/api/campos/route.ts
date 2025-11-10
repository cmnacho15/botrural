import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/app/api/auth/[...nextauth]/route";

// 🧱 POST → Crear un campo y asociarlo al usuario actual
export async function POST(req: Request) {
  try {
    // 🔐 Verificar sesión activa
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { nombre } = await req.json();

    // 🧩 Validar nombre
    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido" },
        { status: 400 }
      );
    }

    // 🧩 Buscar usuario actual
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    // Si ya tiene campo, no permitir duplicar
    if (usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario ya tiene un campo asociado" },
        { status: 400 }
      );
    }

    // 🚜 Crear campo y asociarlo al usuario
    const campo = await prisma.campo.create({
      data: {
        nombre: nombre.trim(),
        usuarios: {
          connect: { id: session.user.id },
        },
      },
    });

    // 👑 Asignar campoId al usuario y rol ADMIN
    await prisma.user.update({
      where: { id: session.user.id },
      data: { campoId: campo.id, role: "ADMIN" },
    });

    console.log(`✅ Campo creado: ${campo.nombre} (asociado a ${session.user.email})`);

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

// 📋 GET → Obtener campo del usuario autenticado
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Buscar el campo del usuario actual
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        campo: {
          include: {
            lotes: true,
            usuarios: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (!usuario?.campo) {
      return NextResponse.json(
        { message: "El usuario no tiene un campo asociado" },
        { status: 200 }
      );
    }

    return NextResponse.json(usuario.campo, { status: 200 });
  } catch (error) {
    console.error("💥 Error obteniendo campo:", error);
    return NextResponse.json(
      { error: "Error interno al obtener campo", details: String(error) },
      { status: 500 }
    );
  }
}