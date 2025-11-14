import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📝 PUT - Actualizar lote con cultivos y animales
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const session = await getServerSession(authOptions);
    console.log("👤 Sesión:", session);

    if (!session?.user?.id) {
      console.log("❌ Usuario NO autenticado");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    console.log("👤 Usuario encontrado:", usuario);

    const lote = await prisma.lote.findUnique({
      where: { id },
      include: {
        cultivos: true,
        animalesLote: true,
      },
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

    if (!nombre || isNaN(parseFloat(hectareas))) {
      console.log("❌ Validación falló:", { nombre, hectareas });
      return NextResponse.json(
        { error: "Nombre o hectáreas inválidas" },
        { status: 400 }
      );
    }

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

    // 🔥 DETECTAR CAMBIOS Y CREAR EVENTOS

    // 1️⃣ Detectar nuevos cultivos
    const cultivosAnteriores = lote.cultivos.map(c => c.tipoCultivo);
    const cultivosNuevos = cultivosValidos.filter(
      (c: any) => !cultivosAnteriores.includes(c.tipoCultivo)
    );

    console.log("🆕 Cultivos nuevos detectados:", cultivosNuevos);

    // 2️⃣ Detectar cambios en animales
    const animalesAnteriores = lote.animalesLote;
    const animalesPorCategoria = animalesValidos.reduce((acc: any, a: any) => {
      acc[a.categoria] = (acc[a.categoria] || 0) + a.cantidad;
      return acc;
    }, {});

    const animalesAnterioresPorCategoria = animalesAnteriores.reduce((acc: any, a: any) => {
      acc[a.categoria] = (acc[a.categoria] || 0) + a.cantidad;
      return acc;
    }, {});

    console.log("📊 Animales antes:", animalesAnterioresPorCategoria);
    console.log("📊 Animales ahora:", animalesPorCategoria);

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

    // 🔥 CREAR EVENTOS PARA LOS CAMBIOS

    // Eventos de nuevos cultivos (SIEMBRA)
    for (const cultivo of cultivosNuevos) {
      await prisma.evento.create({
        data: {
          tipo: 'SIEMBRA',
          fecha: cultivo.fechaSiembra,
          descripcion: `Se sembraron ${cultivo.hectareas.toFixed(1)} hectáreas de ${cultivo.tipoCultivo} en el lote "${nombre}".`,
          campoId: usuario!.campoId!,
          loteId: id,
          usuarioId: session.user.id,
          cantidad: cultivo.hectareas,
        },
      });
      console.log(`✅ Evento SIEMBRA creado: ${cultivo.tipoCultivo}`);
    }

    // Eventos de cambios en animales
    for (const categoria in animalesPorCategoria) {
      const cantidadNueva = animalesPorCategoria[categoria];
      const cantidadAnterior = animalesAnterioresPorCategoria[categoria] || 0;
      const diferencia = cantidadNueva - cantidadAnterior;

      if (diferencia > 0) {
        // INGRESO de animales
        await prisma.evento.create({
          data: {
            tipo: 'COMPRA',
            fecha: new Date(),
            descripcion: `Se ingresaron ${diferencia} ${categoria.toLowerCase()} al lote "${nombre}".`,
            campoId: usuario!.campoId!,
            loteId: id,
            usuarioId: session.user.id,
            cantidad: diferencia,
          },
        });
        console.log(`✅ Evento COMPRA creado: +${diferencia} ${categoria}`);
      } else if (diferencia < 0) {
        // SALIDA de animales
        await prisma.evento.create({
          data: {
            tipo: 'VENTA',
            fecha: new Date(),
            descripcion: `Se retiraron ${Math.abs(diferencia)} ${categoria.toLowerCase()} del lote "${nombre}".`,
            campoId: usuario!.campoId!,
            loteId: id,
            usuarioId: session.user.id,
            cantidad: Math.abs(diferencia),
          },
        });
        console.log(`✅ Evento VENTA creado: -${Math.abs(diferencia)} ${categoria}`);
      }
    }

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

// 🗑️ DELETE
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