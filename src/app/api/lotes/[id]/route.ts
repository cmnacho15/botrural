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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({
      where: { id },
      include: {
        cultivos: true,
        animalesLote: true,
      },
    });

    if (!lote) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    if (lote.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, hectareas, poligono, cultivos = [], animales = [] } = body;

    if (!nombre || isNaN(parseFloat(hectareas))) {
      return NextResponse.json(
        { error: "Nombre o hectáreas inválidas" },
        { status: 400 }
      );
    }

    // ========================
    // 🔥 DETECTAR CAMBIOS
    // ========================

    const cultivosValidos = cultivos
      .filter((c: any) => c.tipoCultivo && c.fechaSiembra && c.hectareas)
      .map((c: any) => ({
        tipoCultivo: c.tipoCultivo,
        fechaSiembra: new Date(c.fechaSiembra),
        hectareas: parseFloat(c.hectareas),
      }));

    const animalesValidos = animales
      .filter((a: any) => a.categoria && a.cantidad)
      .map((a: any) => ({
        categoria: a.categoria,
        cantidad: parseInt(a.cantidad),
        fechaIngreso: new Date(),
      }));

    console.log("🐮 Animales válidos:", animalesValidos);

    // 🔥 DETECTAR CAMBIOS Y CREAR EVENTOS

    // 1️⃣ Detectar cultivos nuevos y eliminados
    console.log("🔍 ANTES - Cultivos en BD:", lote.cultivos);
    console.log("🔍 AHORA - Cultivos válidos a guardar:", cultivosValidos);

    const cultivosAnterioresMap = lote.cultivos.reduce((acc: any, c) => {
      acc[c.tipoCultivo] = c.hectareas;
      return acc;
    }, {});

    const cultivosNuevosMap = cultivosValidos.reduce((acc: any, c: any) => {
      acc[c.tipoCultivo] = c.hectareas;
      return acc;
    }, {});

    console.log("📋 Map de cultivos anteriores:", cultivosAnterioresMap);
    console.log("📋 Map de cultivos nuevos:", cultivosNuevosMap);

    // Cultivos completamente nuevos (no existían antes)
    const cultivosNuevos = cultivosValidos.filter(
      (c: any) => !(c.tipoCultivo in cultivosAnterioresMap)
    );

    // Cultivos eliminados (existían antes, ya no están)
    const cultivosEliminados = lote.cultivos.filter(
      c => !(c.tipoCultivo in cultivosNuevosMap)
    );

    console.log("🆕 Cultivos nuevos detectados:", cultivosNuevos);
    console.log("🗑️ Cultivos eliminados detectados:", cultivosEliminados);

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

    // ========================
    // 💾 ACTUALIZAR LOTE
    // ========================
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

    // 🔥 CREAR EVENTOS PARA LOS CAMBIOS

    // 1️⃣ Eventos de cultivos NUEVOS (SIEMBRA)
    for (const cultivo of cultivosNuevos) {
      await prisma.evento.create({
        data: {
          tipo: 'SIEMBRA',
          fecha: cultivo.fechaSiembra,
          descripcion: `Se sembraron ${cultivo.hectareas.toFixed(1)} hectáreas de ${cultivo.tipoCultivo} en el potrero "${nombre}".`,
          campoId: usuario!.campoId!,
          loteId: id,
          usuarioId: session.user.id,
          cantidad: cultivo.hectareas,
        },
      });
      console.log(`✅ Evento SIEMBRA creado: ${cultivo.tipoCultivo}`);
    }

    // 2️⃣ Eventos de cultivos ELIMINADOS (COSECHA)
    for (const cultivo of cultivosEliminados) {
      await prisma.evento.create({
        data: {
          tipo: 'COSECHA',
          fecha: new Date(),
          descripcion: `Se eliminaron ${cultivo.hectareas.toFixed(1)} hectáreas de ${cultivo.tipoCultivo} del potrero "${nombre}" (borrado manual).`,
          campoId: usuario!.campoId!,
          loteId: id,
          usuarioId: session.user.id,
          cantidad: cultivo.hectareas,
        },
      });
      console.log(`✅ Evento COSECHA creado: ${cultivo.tipoCultivo}`);
    }

    // 3️⃣ Eventos de cambios en ANIMALES
    for (const categoria in animalesPorCategoria) {
      const cantidadNueva = animalesPorCategoria[categoria];
      const cantidadAnterior = animalesAnterioresPorCategoria[categoria] || 0;
      const diferencia = cantidadNueva - cantidadAnterior;

      if (diferencia > 0) {
        // AJUSTE POSITIVO (adición)
        await prisma.evento.create({
          data: {
            tipo: 'AJUSTE',
            fecha: new Date(),
            descripcion: `Se agregaron ${diferencia} ${categoria.toLowerCase()} al potrero "${nombre}" (ajuste positivo).`,
            campoId: usuario!.campoId!,
            loteId: id,
            usuarioId: session.user.id,
            cantidad: diferencia,
            categoria: categoria,
          },
        });
        console.log(`✅ Evento AJUSTE POSITIVO creado: +${diferencia} ${categoria}`);
      } else if (diferencia < 0) {
        // AJUSTE NEGATIVO (eliminación)
        await prisma.evento.create({
          data: {
            tipo: 'AJUSTE',
            fecha: new Date(),
            descripcion: `Se eliminaron ${Math.abs(diferencia)} ${categoria.toLowerCase()} del potrero "${nombre}" (ajuste negativo - borrado manual).`,
            campoId: usuario!.campoId!,
            loteId: id,
            usuarioId: session.user.id,
            cantidad: Math.abs(diferencia),
            categoria: categoria,
          },
        });
        console.log(`✅ Evento AJUSTE NEGATIVO creado: -${Math.abs(diferencia)} ${categoria}`);
      }
    }

    // 4️⃣ Detectar categorías completamente eliminadas
    for (const categoria in animalesAnterioresPorCategoria) {
      if (!(categoria in animalesPorCategoria)) {
        const cantidad = animalesAnterioresPorCategoria[categoria];
        await prisma.evento.create({
          data: {
            tipo: 'AJUSTE',
            fecha: new Date(),
            descripcion: `Se eliminaron todos los ${cantidad} ${categoria.toLowerCase()} del potrero "${nombre}" (borrado manual).`,
            campoId: usuario!.campoId!,
            loteId: id,
            usuarioId: session.user.id,
            cantidad: cantidad,
            categoria: categoria,
          },
        });
        console.log(`✅ Evento AJUSTE NEGATIVO TOTAL creado: -${cantidad} ${categoria}`);
      }
    }

    return NextResponse.json(loteActualizado, { status: 200 });
  } catch (error: any) {
    console.error("💥 ERROR PUT /api/lotes/[id]:", error);
    return NextResponse.json(
      {
        error: "Error actualizando el lote",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE
export async function DELETE(
  request: Request, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({ 
      where: { id },
      include: {
        cultivos: true,
        animalesLote: true,
      }
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json({ error: "No autorizado o no existe" }, { status: 404 });
    }

    // 🚫 VALIDACIÓN: NO permitir eliminar si hay animales o cultivos
    if (lote.animalesLote.length > 0 || lote.cultivos.length > 0) {
      return NextResponse.json({ 
        error: "No se puede eliminar un potrero con animales o cultivos",
        animales: lote.animalesLote,
        cultivos: lote.cultivos
      }, { status: 400 });
    }

    // Eliminar relaciones primero
    await prisma.cultivo.deleteMany({ where: { loteId: id } });
    await prisma.animalLote.deleteMany({ where: { loteId: id } });
    await prisma.lote.delete({ where: { id } });

    console.log("🗑️ Potrero eliminado:", lote.nombre);
    return NextResponse.json({ success: true, message: "Potrero eliminado correctamente" });
  } catch (error: any) {
    console.error("💥 ERROR DELETE /api/lotes/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}