import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

interface DivisionPotrero {
  animalLoteId: string;
  loteId: string;
  totalOriginal: number;
  machos: number;
  hembras: number;
}

export async function POST(req: Request) {
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

    const { divisiones }: { divisiones: DivisionPotrero[] } = await req.json();

    // Validar que cada división sume correctamente
    for (const div of divisiones) {
      if (div.machos + div.hembras !== div.totalOriginal) {
        return NextResponse.json(
          { error: `Error en potrero: ${div.machos} + ${div.hembras} ≠ ${div.totalOriginal}` },
          { status: 400 }
        );
      }
    }

    // Ejecutar en transacción
    await prisma.$transaction(async (tx) => {
      for (const div of divisiones) {
        const animalOriginal = await tx.animalLote.findUnique({
          where: { id: div.animalLoteId },
        });

        if (!animalOriginal) continue;

        // Actualizar el existente a "Terneros" (machos)
        await tx.animalLote.update({
          where: { id: div.animalLoteId },
          data: {
            categoria: "Terneros",
            cantidad: div.machos,
            fechaIngreso: new Date(),
          },
        });

        // Crear nuevo para "Terneras" (hembras)
        if (div.hembras > 0) {
          await tx.animalLote.create({
            data: {
              loteId: div.loteId,
              categoria: "Terneras",
              cantidad: div.hembras,
              peso: animalOriginal.peso,
              fechaIngreso: new Date(),
            },
          });
        }

        // Registrar evento
        await tx.evento.create({
          data: {
            tipo: "RECATEGORIZACION",
            descripcion: `División manual: Terneros nacidos → ${div.machos} Terneros + ${div.hembras} Terneras`,
            fecha: new Date(),
            cantidad: div.totalOriginal,
            categoria: "Terneros",
            loteId: div.loteId,
            campoId: user.campoId,
            usuarioId: session.user.id,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al dividir bovinos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}