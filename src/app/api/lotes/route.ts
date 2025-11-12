import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

    // Traer lotes asociados al campo del usuario con cultivos y animales
    const lotes = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        campo: true,
        cultivos: true,
        animalesLote: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // ✅ MAPEAR poligono a coordenadas (para el mapa)
    const lotesFormateados = lotes.map((lote) => ({
      ...lote,
      coordenadas: lote.poligono || [],
    }));

    return NextResponse.json(lotesFormateados, { status: 200 });
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

    // 📦 Leer datos del body
    const body = await request.json();
    const { nombre, hectareas, poligono, cultivos = [], animales = [] } = body;

    if (!nombre || !hectareas) {
      return NextResponse.json(
        { error: "Nombre y hectáreas son requeridos" },
        { status: 400 }
      );
    }

    // ✅ Validar polígono
    if (!Array.isArray(poligono) || poligono.length < 3) {
      return NextResponse.json(
        { error: "El polígono debe tener al menos 3 puntos" },
        { status: 400 }
      );
    }

    // ✅ Crear el lote con cultivos y animales relacionados
    const lote = await prisma.lote.create({
      data: {
        nombre,
        hectareas: parseFloat(hectareas),
        poligono, // JSON con coordenadas
        campoId: usuario.campoId,

        // ✨ NUEVO: crear cultivos en la misma transacción
        cultivos: {
          create: cultivos.map((c: any) => ({
            tipoCultivo: c.tipoCultivo,
            fechaSiembra: new Date(c.fechaSiembra),
            hectareas: parseFloat(c.hectareas),
          })),
        },

        // ✨ NUEVO: crear animales asociados
        animalesLote: {
          create: animales.map((a: any) => ({
            categoria: a.categoria,
            cantidad: parseInt(a.cantidad),
            fechaIngreso: new Date(),
          })),
        },
      },
      include: {
        cultivos: true,
        animalesLote: true,
      },
    });

    console.log(
      `✅ Lote creado: ${nombre} con ${cultivos.length} cultivos y ${animales.length} animales`
    );
    return NextResponse.json(lote, { status: 201 });
  } catch (error) {
    console.error("💥 Error creando lote:", error);
    return NextResponse.json(
      { error: "Error creando el lote" },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE - Eliminar lote por ID
export async function DELETE(request: Request) {
  try {
    // 🔐 Verificar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const loteId = searchParams.get("id");

    if (!loteId) {
      return NextResponse.json(
        { error: "ID del lote es requerido" },
        { status: 400 }
      );
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    await prisma.lote.delete({ where: { id: loteId } });

    console.log(`🗑️ Lote eliminado: ${lote.nombre}`);
    return NextResponse.json(
      { message: "Lote eliminado correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("💥 Error eliminando lote:", error);
    return NextResponse.json(
      { error: "Error eliminando el lote" },
      { status: 500 }
    );
  }
}