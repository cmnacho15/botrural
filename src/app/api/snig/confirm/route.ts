import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TipoEvento, SnigEstado, SnigOrigen } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      snigSessionId,
      accion,
      caravanas,
      loteId,
      loteDestinoId,
      categoria,
      usuarioId,
      campoId
    } = body;

    console.log("📥 [CONFIRM] Datos recibidos:", { 
      snigSessionId, 
      accion, 
      cantidadCaravanas: caravanas?.length,
      campoId
    });

    // Validaciones básicas
    if (!snigSessionId || !accion || !caravanas || caravanas.length === 0) {
      return NextResponse.json(
        { error: "Datos incompletos: se requiere snigSessionId, accion y caravanas" },
        { status: 400 }
      );
    }

    if (!campoId) {
      return NextResponse.json(
        { error: "Se requiere campoId" },
        { status: 400 }
      );
    }

    // 1️⃣ Buscar sesión SNIG
    const snigSession = await prisma.snigUploadSession.findUnique({
      where: { id: snigSessionId },
      include: { animales: true }
    });

    if (!snigSession) {
      return NextResponse.json(
        { error: "Sesión SNIG no encontrada" },
        { status: 404 }
      );
    }

    if (snigSession.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: `Esta sesión ya fue procesada (estado: ${snigSession.estado})` },
        { status: 400 }
      );
    }

    console.log(`📦 [CONFIRM] Sesión encontrada con ${snigSession.animales.length} animales`);

    // 2️⃣ Obtener animales de la sesión SNIG
    const animalesSnig = snigSession.animales;
    
    if (animalesSnig.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron animales en esta sesión SNIG" },
        { status: 404 }
      );
    }

    console.log(`📦 [CONFIRM] Procesando ${animalesSnig.length} animales de la sesión`);
    
    // Filtrar por caravanas si se proporcionaron (para acciones específicas)
    const animalesProcesados = caravanas && caravanas.length > 0
      ? animalesSnig.filter(a => caravanas.includes(a.caravana))
      : animalesSnig;

    if (animalesProcesados.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron animales que coincidan con las caravanas proporcionadas" },
        { status: 404 }
      );
    }

    console.log(`✅ Procesando ${animalesProcesados.length} animales para acción: ${accion}`);

    // 3️⃣ Mapear acción a TipoEvento y SnigEstado
    let tipoEvento: TipoEvento;
    let estadoFinal: SnigEstado;
    let origenFinal: SnigOrigen;

    switch (accion) {
      case "STOCK_INICIAL":
        tipoEvento = "STOCK_INICIAL";
        estadoFinal = "EN_CAMPO";
        origenFinal = "STOCK_INICIAL";
        break;
      case "NACIMIENTO":
        tipoEvento = "NACIMIENTO";
        estadoFinal = "EN_CAMPO";
        origenFinal = "NACIMIENTO";
        break;
      case "COMPRA":
        tipoEvento = "COMPRA";
        estadoFinal = "EN_CAMPO";
        origenFinal = "COMPRA";
        break;
      case "VENTA":
        tipoEvento = "VENTA";
        estadoFinal = "VENDIDO";
        origenFinal = "COMPRA";
        break;
      case "MORTANDAD":
        tipoEvento = "MORTANDAD";
        estadoFinal = "MUERTO";
        origenFinal = "DESCONOCIDO";
        break;
      case "TRASLADO":
        tipoEvento = "TRASLADO";
        estadoFinal = "EN_CAMPO";
        origenFinal = "DESCONOCIDO";
        break;
      default:
        return NextResponse.json(
          { error: `Acción no reconocida: ${accion}` },
          { status: 400 }
        );
    }

    const cantidad = animalesProcesados.length;
    const fechaEvento = new Date();

    console.log(`🔄 Procesando ${cantidad} animales para acción: ${accion}`);

    // 4️⃣ ACTUALIZAR ANIMALES SNIG
    await prisma.snigAnimal.updateMany({
      where: {
        id: { in: animalesProcesados.map(a => a.id) }
      },
      data: {
        estado: estadoFinal,
        origen: origenFinal,
        fechaEvento,
        fechaBaja: estadoFinal !== "EN_CAMPO" ? fechaEvento : null
      }
    });

    console.log(`✅ Actualizados ${cantidad} registros en SnigAnimal`);

    // 5️⃣ ACTUALIZAR POTREROS (AnimalLote)
    // ⚠️ STOCK_INICIAL NO modifica potreros (solo registra caravanas)
    
    if (accion === "STOCK_INICIAL") {
      console.log(`📦 [STOCK_INICIAL] Solo se registraron caravanas, sin modificar potreros`);
    } else if (["NACIMIENTO", "COMPRA"].includes(accion)) {
      // SUMAR animales al potrero
      if (!loteId || !categoria) {
        return NextResponse.json(
          { error: "Para esta acción se requiere loteId y categoria" },
          { status: 400 }
        );
      }

      await prisma.animalLote.upsert({
        where: {
          loteId_categoria: {
            loteId,
            categoria
          }
        },
        update: {
          cantidad: { increment: cantidad }
        },
        create: {
          loteId,
          categoria,
          cantidad
        }
      });

      console.log(`✅ Sumados ${cantidad} animales a lote ${loteId}, categoría ${categoria}`);
    }

    if (["VENTA", "MORTANDAD"].includes(accion)) {
      // RESTAR animales del potrero
      if (!loteId || !categoria) {
        return NextResponse.json(
          { error: "Para esta acción se requiere loteId y categoria" },
          { status: 400 }
        );
      }

      const animalLote = await prisma.animalLote.findUnique({
        where: {
          loteId_categoria: { loteId, categoria }
        }
      });

      if (!animalLote) {
        return NextResponse.json(
          { error: `No se encontró el AnimalLote para lote ${loteId} y categoría ${categoria}` },
          { status: 404 }
        );
      }

      if (animalLote.cantidad < cantidad) {
        return NextResponse.json(
          { error: `No hay suficientes animales en el potrero (${animalLote.cantidad} disponibles, ${cantidad} solicitados)` },
          { status: 400 }
        );
      }

      await prisma.animalLote.update({
        where: {
          loteId_categoria: { loteId, categoria }
        },
        data: {
          cantidad: { decrement: cantidad }
        }
      });

      console.log(`✅ Restados ${cantidad} animales de lote ${loteId}, categoría ${categoria}`);
    }

    if (accion === "TRASLADO") {
      // RESTAR del origen, SUMAR al destino
      if (!loteId || !loteDestinoId || !categoria) {
        return NextResponse.json(
          { error: "Para traslado se requiere loteId, loteDestinoId y categoria" },
          { status: 400 }
        );
      }

      if (loteId === loteDestinoId) {
        return NextResponse.json(
          { error: "El potrero origen y destino no pueden ser el mismo" },
          { status: 400 }
        );
      }

      // Restar del origen
      const animalLoteOrigen = await prisma.animalLote.findUnique({
        where: {
          loteId_categoria: { loteId, categoria }
        }
      });

      if (!animalLoteOrigen) {
        return NextResponse.json(
          { error: `No se encontró el AnimalLote origen para lote ${loteId} y categoría ${categoria}` },
          { status: 404 }
        );
      }

      if (animalLoteOrigen.cantidad < cantidad) {
        return NextResponse.json(
          { error: `No hay suficientes animales en el potrero origen (${animalLoteOrigen.cantidad} disponibles, ${cantidad} solicitados)` },
          { status: 400 }
        );
      }

      await prisma.animalLote.update({
        where: {
          loteId_categoria: { loteId, categoria }
        },
        data: {
          cantidad: { decrement: cantidad }
        }
      });

      // Sumar al destino
      await prisma.animalLote.upsert({
        where: {
          loteId_categoria: {
            loteId: loteDestinoId,
            categoria
          }
        },
        update: {
          cantidad: { increment: cantidad }
        },
        create: {
          loteId: loteDestinoId,
          categoria,
          cantidad
        }
      });

      console.log(`✅ Trasladados ${cantidad} animales de ${loteId} a ${loteDestinoId}`);
    }

    // 6️⃣ REGISTRAR EVENTO
    const caravanasParaEvento = animalesProcesados.map(a => a.caravana);
    
    await prisma.evento.create({
      data: {
        tipo: tipoEvento,
        campoId,
        usuarioId: usuarioId || null,
        fecha: fechaEvento,
        descripcion: `SNIG – ${accion} – ${cantidad} animales`,
        cantidad,
        categoria: categoria || null,
        loteId: loteId || null,
        loteDestinoId: accion === "TRASLADO" ? loteDestinoId : null,
        caravanas: JSON.parse(JSON.stringify(caravanasParaEvento)),
        origenSnig: "WEB"
      }
    });

    console.log(`✅ Evento registrado: ${tipoEvento}`);

    // 7️⃣ CERRAR SESIÓN SNIG
    await prisma.snigUploadSession.update({
      where: { id: snigSessionId },
      data: {
        estado: "PROCESADO",
        tipoDetectado: accion
      }
    });

    console.log(`✅ Sesión SNIG ${snigSessionId} cerrada correctamente`);

    return NextResponse.json({
      ok: true,
      mensaje: `Acción SNIG "${accion}" procesada correctamente`,
      cantidad,
      caravanas: caravanasParaEvento
    });

  } catch (error: any) {
    console.error("❌ Error confirmando SNIG:", error);
    return NextResponse.json(
      { error: error.message || "Error interno procesando la confirmación" },
      { status: 500 }
    );
  }
}