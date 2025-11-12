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
      where: { id: params.id },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // 📦 Leer datos del body
    const body = await request.json();
    const { nombre, hectareas, cultivos = [], animales = [] } = body;

    // 🧠 Actualizar lote + reemplazar cultivos y animales
    const loteActualizado = await prisma.lote.update({
      where: { id: params.id },
      data: {
        nombre,
        hectareas: parseFloat(hectareas),

        // 🔄 Reemplazar todos los cultivos
        cultivos: {
          deleteMany: {}, // elimina todos los anteriores
          create: cultivos.map((c: any) => ({
            tipoCultivo: c.tipoCultivo,
            fechaSiembra: new Date(c.fechaSiembra),
            hectareas: parseFloat(c.hectareas),
          })),
        },

        // 🔄 Reemplazar todos los animales
        animalesLote: {
          deleteMany: {},
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

    console.log(`✅ Lote actualizado: ${loteActualizado.nombre}`);
    return NextResponse.json(loteActualizado, { status: 200 });
  } catch (error) {
  console.error("💥 Error actualizando lote:", error);
  return NextResponse.json(
    { 
      error: "Error actualizando el lote", 
      details: (error as Error).message, // 👈 Agrega este detalle
      stack: (error as Error).stack       // 👈 Y esto también
    },
    { status: 500 }
  );
}
}


// 🗑️ DELETE - Eliminar lote específico (opcional)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 🔐 Verificar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({
      where: { id: params.id },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // ❗ Eliminar cultivos y animales antes del lote (por seguridad)
    await prisma.cultivo.deleteMany({ where: { loteId: params.id } });
    await prisma.animalLote.deleteMany({ where: { loteId: params.id } });

    // 🗑️ Eliminar lote
    await prisma.lote.delete({ where: { id: params.id } });

    console.log(`🗑️ Lote eliminado: ${lote.nombre}`);
    return NextResponse.json({ message: "Lote eliminado correctamente" });
  } catch (error) {
    console.error("💥 Error eliminando lote:", error);
    return NextResponse.json(
      { error: "Error eliminando el lote" },
      { status: 500 }
    );
  }
}