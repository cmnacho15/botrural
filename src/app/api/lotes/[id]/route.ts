import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📝 PUT - Actualizar lote con cultivos y animales
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> } // ✅ CORRECTO para Next.js 15
) {
  try {
    const { id } = await context.params; // ✅ Ahora sí obtienes el id


    // 🔐 Sesión
    const session = await getServerSession(authOptions);
    console.log("👤 Sesión:", session);

    if (!session?.user?.id) {
      console.log("❌ Usuario NO autenticado");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Usuario
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    console.log("👤 Usuario encontrado:", usuario);

    // Lote
    const lote = await prisma.lote.findUnique({
      where: { id },
    });
    console.log("🌾 Lote encontrado:", lote);

    if (!lote) {
      console.log("❌ Lote NO existe:", id);
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    if (lote.campoId !== usuario?.campoId) {
      console.log("⛔ Lote NO pertenece al usuario");
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Leer body
    const rawBody = await request.text();
    console.log("📨 RAW BODY:", rawBody);

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.log("❌ NO SE PUDO PARSEAR JSON:", err);
      return NextResponse.json(
        { error: "Body inválido", rawBody },
        { status: 400 }
      );
    }

    console.log("📥 Body parseado:", body);

    const { nombre, hectareas, poligono, cultivos = [], animales = [] } = body;

    console.log("🧪 Datos principales:", {
      nombre,
      hectareas,
      poligono,
      cultivos,
      animales,
    });

    // Validaciones
    if (!nombre) console.log("⚠️ nombre está vacío!");
    if (!hectareas) console.log("⚠️ hectareas está vacío!");

    if (!nombre || isNaN(parseFloat(hectareas))) {
      console.log("❌ Validación falló:", { nombre, hectareas });
      return NextResponse.json(
        { error: "Nombre o hectáreas inválidas" },
        { status: 400 }
      );
    }

    // Cultivos
    console.log("🌱 Procesando cultivos...");
    const cultivosValidos = cultivos
      .filter((c: any) => {
        const valido = c.tipoCultivo && c.fechaSiembra && c.hectareas;
        if (!valido) console.log("⚠️ Cultivo inválido descartado:", c);
        return valido;
      })
      .map((c: any) => ({
        tipoCultivo: c.tipoCultivo,
        fechaSiembra: new Date(c.fechaSiembra),
        hectareas: parseFloat(c.hectareas),
      }));

    console.log("🌿 Cultivos válidos:", cultivosValidos);

    // Animales
    console.log("🐄 Procesando animales...");
    const animalesValidos = animales
      .filter((a: any) => {
        const valido = a.categoria && a.cantidad;
        if (!valido) console.log("⚠️ Animal inválido descartado:", a);
        return valido;
      })
      .map((a: any) => ({
        categoria: a.categoria,
        cantidad: parseInt(a.cantidad),
        fechaIngreso: new Date(),
      }));

    console.log("🐮 Animales válidos:", animalesValidos);

    // PRISMA UPDATE
    console.log("📡 Enviando actualización a Prisma...");

    const loteActualizado = await prisma.lote.update({
      where: { id },
      data: {
        nombre,
        hectareas: parseFloat(hectareas),

        ...(poligono && { poligono }),

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

    console.log("✅ PRISMA respondió OK:", loteActualizado);

    return NextResponse.json(loteActualizado, { status: 200 });
  } catch (error: any) {
    console.log("💥 ERROR DETECTADO PUT /api/lotes/[id]");
    console.log("🟥 Mensaje:", error.message);
    console.log("🟥 Stack:", error.stack);

    return NextResponse.json(
      {
        error: "Error actualizando el lote",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE (igual que antes)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    console.log("🚀 DELETE /api/lotes/[id] INICIADO");
    const { id } = params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({ where: { id } });
    console.log("📌 Lote encontrado:", lote);

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: "No autorizado o no existe" }, { status: 404 });
    }

    await prisma.cultivo.deleteMany({ where: { loteId: id } });
    await prisma.animalLote.deleteMany({ where: { loteId: id } });
    await prisma.lote.delete({ where: { id } });

    console.log("🗑️ Lote eliminado OK");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.log("💥 ERROR DELETE /api/lotes/[id]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}