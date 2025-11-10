import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/app/api/auth/[...nextauth]/route";

// 📋 GET - Obtener lotes del campo del usuario autenticado
export async function GET() {
  try {
    // 🔐 Verificar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Buscar usuario y su campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json([], { status: 200 });
    }

    // Traer lotes asociados al campo del usuario
    const lotes = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        campo: true,
        cultivos: true,
        animalesLote: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(lotes, { status: 200 });
  } catch (error) {
    console.error("💥 Error obteniendo lotes:", error);
    return NextResponse.json(
      { error: "Error obteniendo los lotes" },
      { status: 500 }
    );
  }
}

// 🧩 POST - Crear nuevo lote asociado al campo del usuario autenticado
export async function POST(request: Request) {
  try {
    // 🔐 Validar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene un campo asignado" },
        { status: 400 }
      );
    }

    // Leer datos del body
    const body = await request.json();
    const { nombre, hectareas } = body;

    if (!nombre || !hectareas) {
      return NextResponse.json(
        { error: "Nombre y hectáreas son requeridos" },
        { status: 400 }
      );
    }

    // Crear el lote
    const lote = await prisma.lote.create({
      data: {
        nombre,
        hectareas: parseFloat(hectareas),
        campoId: usuario.campoId, // ✅ Asociado automáticamente
      },
    });

    console.log(`✅ Lote creado: ${nombre} (${hectareas} ha)`);

    return NextResponse.json(lote, { status: 201 });
  } catch (error) {
    console.error("💥 Error creando lote:", error);
    return NextResponse.json(
      { error: "Error creando el lote" },
      { status: 500 }
    );
  }
}