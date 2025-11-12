import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📝 PUT - Actualizar lote con cultivos y animales
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 🔐 Verificar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Buscar usuario
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // Buscar lote
    const lote = await prisma.lote.findUnique({
      where: { id },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // 📦 Leer datos del body
    const body = await request.json();
    const { nombre, hectareas, poligono, cultivos = [], animales = [] } = body; // 🔴 CAMBIO 1

    console.log("📥 Body recibido para actualizar:", body);

    // ✅ Validar datos básicos
    if (!nombre || isNaN(parseFloat(hectareas))) {
      return NextResponse.json(
        { error: "Nombre o hectáreas inválidas" },
        { status: 400 }
      );
    }

    // ✅ Filtrar cultivos válidos (evita errores por NaN o fechas vacías)
    const cultivosValidos = cultivos
      .filter((c: any) => c.tipoCultivo && c.fechaSiembra && c.hectareas)
      .map((c: any) => ({
        tipoCultivo: c.tipoCultivo,
        fechaSiembra: new Date(c.fechaSiembra),
        hectareas: parseFloat(c.hectareas),
      }));

    // ✅ Filtrar animales válidos
    const animalesValidos = animales
      .filter((a: any) => a.categoria && a.cantidad)
      .map((a: any) => ({
        categoria: a.categoria,
        cantidad: parseInt(a.cantidad),
        fechaIngreso: new Date(),
      }));

    // 🧠 Actualizar lote
    const loteActualizado = await prisma.lote.update({
      where: { id },
      data: {
        nombre,
        hectareas: parseFloat(hectareas),
        ...(poligono && { poligono }), // 🔴 CAMBIO 2

        cultivos: {
          deleteMany: {},
          create: cultivosValidos,
        },
        animalesLote: {
          deleteMany: {},
          create: animalesValidos,
        },
      },
      include: {
        cultivos: true,
        animalesLote: true,
      },
    });

    console.log(`✅ Lote actualizado: ${loteActualizado.nombre}`);
    return NextResponse.json(loteActualizado, { status: 200 });
  } catch (error) {
    console.error("💥 Error actualizando lote:", error);
    return NextResponse.json(
      {
        error: "Error actualizando el lote",
        details: (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE - Eliminar lote específico
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 🔐 Verificar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({
      where: { id },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // 🧹 Eliminar cultivos y animales antes
    await prisma.cultivo.deleteMany({ where: { loteId: id } });
    await prisma.animalLote.deleteMany({ where: { loteId: id } });

    // 🗑️ Eliminar lote
    await prisma.lote.delete({ where: { id } });

    console.log(`🗑️ Lote eliminado: ${lote.nombre}`);
    return NextResponse.json({ message: "Lote eliminado correctamente" });
  } catch (error) {
    console.error("💥 Error eliminando lote:", error);
    return NextResponse.json(
      {
        error: "Error eliminando el lote",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}