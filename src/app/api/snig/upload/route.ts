import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ✅ REGEX CORREGIDO PARA SNIG URUGUAYO
// Formato: [|CARAVANA|FECHA|HORA||...]
const CARAVANA_REGEX = /\[\|([A]\d{10,30})\|/g;

// Regex para fecha y hora (después de la caravana)
const FECHA_REGEX = /\[\|[A]\d{10,30}\|(\d{8})\|(\d{6})\|/;

function parseFechaSnig(fechaStr: string, horaStr: string): Date | null {
  try {
    // Formato SNIG: DDMMYYYY HHMMSS
    const dia = fechaStr.substring(0, 2);
    const mes = fechaStr.substring(2, 4);
    const anio = fechaStr.substring(4, 8);
    const hora = horaStr.substring(0, 2);
    const min = horaStr.substring(2, 4);
    const seg = horaStr.substring(4, 6);
    
    return new Date(`${anio}-${mes}-${dia}T${hora}:${min}:${seg}Z`);
  } catch (e) {
    console.error("❌ Error parseando fecha:", e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const campoId = formData.get("campoId") as string | null;
    const usuarioId = formData.get("usuarioId") as string | null;

    console.log("📤 [SNIG] Recibido:", { 
      fileName: file?.name, 
      campoId, 
      usuarioId 
    });

    // ✅ VALIDACIONES BÁSICAS
    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    if (!campoId) {
      return NextResponse.json(
        { error: "No se recibió el campoId" },
        { status: 400 }
      );
    }

    const text = await file.text();
    console.log("📄 [SNIG] Primeras 3 líneas:", text.split("\n").slice(0, 3).join("\n"));

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "El archivo está vacío" },
        { status: 400 }
      );
    }

    // ✅ EXTRAER CARAVANAS CON REGEX CORREGIDO
    const caravanasSet = new Set<string>();
    let match;
    
    // Resetear regex antes de usar
    CARAVANA_REGEX.lastIndex = 0;
    
    while ((match = CARAVANA_REGEX.exec(text)) !== null) {
      caravanasSet.add(match[1]);
    }

    const caravanas = Array.from(caravanasSet);
    console.log(`🏷️ [SNIG] Caravanas encontradas: ${caravanas.length}`);
    console.log(`🏷️ [SNIG] Primeras 5:`, caravanas.slice(0, 5));

    if (caravanas.length === 0) {
      console.error("❌ [SNIG] No se encontraron caravanas. Primeros 500 chars:", text.substring(0, 500));
      return NextResponse.json(
        { error: "No se encontraron caravanas válidas en el archivo. Verificá que sea un archivo TXT del SNIG de Uruguay." },
        { status: 400 }
      );
    }

    // ✅ EXTRAER FECHA SNIG (de la primera línea)
    let fechaSnig: Date | null = null;
    const lines = text.split("\n");
    
    for (const line of lines) {
      const m = FECHA_REGEX.exec(line);
      if (m) {
        fechaSnig = parseFechaSnig(m[1], m[2]);
        if (fechaSnig) {
          console.log("📅 [SNIG] Fecha extraída:", fechaSnig);
          break;
        }
      }
    }

    const fechaUsada = fechaSnig ?? new Date();
    const fechaWarning = fechaSnig 
      ? null 
      : "No se pudo extraer la fecha del SNIG. Se usó la fecha actual.";

    if (!fechaSnig) {
      console.warn("⚠️ [SNIG] No se pudo extraer fecha, usando fecha actual");
    }

    // ✅ CREAR SESIÓN EN LA BASE DE DATOS
    console.log("💾 [SNIG] Creando sesión en DB...");
    const session = await prisma.snigUploadSession.create({
      data: {
        campoId,
        usuarioId: usuarioId || null,
        fechaSnig: fechaUsada,
        cantidadTotal: caravanas.length,
        estado: "PENDIENTE",
        tipoDetectado: "PENDIENTE"
      }
    });

    console.log(`✅ [SNIG] Sesión creada: ${session.id}`);

    // ✅ GUARDAR ANIMALES EN BATCH
    const animalesData = caravanas.map(caravana => ({
      caravana,
      campoId,
      sessionId: session.id,
      estado: "EN_CAMPO" as const,
      origen: "DESCONOCIDO" as const,
      fechaAlta: fechaUsada,
      fechaEvento: fechaUsada
    }));

    await prisma.snigAnimal.createMany({
      data: animalesData,
      skipDuplicates: true
    });

    console.log(`✅ [SNIG] ${caravanas.length} animales guardados en DB`);

    // ✅ DEVOLVER RESPUESTA
    return NextResponse.json({
      ok: true,
      snigSessionId: session.id,
      caravanas,
      cantidad: caravanas.length,
      fechaSnig: fechaUsada.toISOString(),
      warningFecha: fechaWarning,
      accionesPosibles: [
        "STOCK_INICIAL",
        "NACIMIENTO",
        "COMPRA",
        "VENTA",
        "MORTANDAD",
        "TRASLADO"
      ]
    });

  } catch (error: any) {
    console.error("❌ [SNIG] Error procesando archivo:", error);
    return NextResponse.json(
      { 
        error: error.message || "Error interno procesando el archivo",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}