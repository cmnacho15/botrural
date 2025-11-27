import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      snigSessionId,
      accion,
      caravanas,
      loteId,
      loteDestinoId,
      categoria,
      usuarioId,
      campoId
    } = body

    if (!snigSessionId || !accion || !caravanas || caravanas.length === 0) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    // 1) Buscar sesión SNIG
    const snigSession = await prisma.snigUploadSession.findUnique({
      where: { id: snigSessionId },
      include: { animales: true }
    })

    if (!snigSession) {
      return NextResponse.json({ error: "Sesión SNIG no encontrada" }, { status: 404 })
    }

    // 2) Animales de la sesión que coinciden
    const animalesProcesados = snigSession.animales.filter(a =>
      caravanas.includes(a.caravana)
    )

    if (animalesProcesados.length === 0) {
      return NextResponse.json({ error: "No se encontraron animales en esta sesión" }, { status: 404 })
    }

    // 3) Estado final SNIG
    const estadoFinal = (() => {
      switch (accion) {
        case "VENTA": return "VENDIDO"
        case "MORTANDAD": return "MUERTO"
        default: return "EN_CAMPO"
      }
    })()

    // 4) Actualizar SnigAnimals
    await prisma.snigAnimal.updateMany({
      where: { id: { in: animalesProcesados.map(a => a.id) }},
      data: {
        estado: estadoFinal,
        fechaEvento: new Date()
      }
    })

    // 5) Actualizar potreros
    if (["VENTA", "MORTANDAD", "TRASLADO"].includes(accion)) {

      if (!categoria) return NextResponse.json({ error: "Falta categoría" }, { status: 400 })
      if (!loteId) return NextResponse.json({ error: "Falta lote origen" }, { status: 400 })

      const cantidad = animalesProcesados.length

      // Descontar del lote origen
      await prisma.animalLote.updateMany({
        where: { loteId, categoria },
        data: {
          cantidad: { decrement: cantidad }
        }
      })

      // Si es traslado → sumar al lote destino
      if (accion === "TRASLADO") {
        if (!loteDestinoId) {
          return NextResponse.json({ error: "Falta lote destino" }, { status: 400 })
        }

        await prisma.animalLote.upsert({
          where: {
            loteId_categoria: {
              loteId: loteDestinoId,
              categoria
            }
          },
          update: { cantidad: { increment: cantidad }},
          create: {
            loteId: loteDestinoId,
            categoria,
            cantidad
          }
        })
      }
    }

    // 6) Registrar evento
    await prisma.evento.create({
      data: {
        tipo: accion,
        campoId,
        usuarioId: usuarioId || null,
        fecha: new Date(),
        descripcion: `SNIG – ${accion} – ${caravanas.length} animales`,
        cantidad: caravanas.length,
        categoria: categoria || null,
        loteId: loteId || null,
        loteDestinoId: loteDestinoId || null,
        caravanas: caravanas,
        origenSnig: "WEB"
      }
    })

    // 7) Cerrar sesión
    await prisma.snigUploadSession.update({
      where: { id: snigSessionId },
      data: { estado: "PROCESADO" }
    })

    return NextResponse.json({
      ok: true,
      mensaje: `Acción SNIG ${accion} procesada correctamente`,
      cantidad: caravanas.length
    })

  } catch (error: any) {
    console.error("❌ Error confirm SNIG:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}