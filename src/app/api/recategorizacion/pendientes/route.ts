//src/app/api/recategorizacion/pendientes/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!user?.campoId) {
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 });
    }

    // Buscar animales con categorías "nacidos" o "mamones"
    const animalesLote = await prisma.animalLote.findMany({
      where: {
        lote: { campoId: user.campoId },
        categoria: {
          in: ["Terneros nacidos", "Terneras nacidas", "Corderos/as Mamones", "Corderos DL"],
        },
      },
      include: {
        lote: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Agrupar por categoría
    const pendientes = {
      ternerosNacidos: {
        total: 0,
        potreros: [] as Array<{ loteId: string; nombre: string; cantidad: number; animalLoteId: string }>,
      },
      corderosMamones: {
        total: 0,
        potreros: [] as Array<{ loteId: string; nombre: string; cantidad: number; animalLoteId: string }>,
      },
      corderosDL: {
        total: 0,
        potreros: [] as Array<{ loteId: string; nombre: string; cantidad: number; animalLoteId: string }>,
      },
    };

    animalesLote.forEach((animal) => {
      if (animal.categoria === "Terneros nacidos" || animal.categoria === "Terneras nacidas") {
        pendientes.ternerosNacidos.total += animal.cantidad;
        pendientes.ternerosNacidos.potreros.push({
          loteId: animal.loteId,
          nombre: animal.lote.nombre,
          cantidad: animal.cantidad,
          animalLoteId: animal.id,
        });
      } else if (animal.categoria === "Corderos/as Mamones") {
        pendientes.corderosMamones.total += animal.cantidad;
        pendientes.corderosMamones.potreros.push({
          loteId: animal.loteId,
          nombre: animal.lote.nombre,
          cantidad: animal.cantidad,
          animalLoteId: animal.id,
        });
      } else if (animal.categoria === "Corderos DL") {
        pendientes.corderosDL.total += animal.cantidad;
        pendientes.corderosDL.potreros.push({
          loteId: animal.loteId,
          nombre: animal.lote.nombre,
          cantidad: animal.cantidad,
          animalLoteId: animal.id,
        });
      }
    });

    return NextResponse.json(pendientes);
  } catch (error) {
    console.error("Error al obtener categorías pendientes:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}