import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

interface DivisionPotrero {
  animalLoteId: string;
  loteId: string;
  totalOriginal: number;
  capones: number;
  carneros: number;
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
      if (div.capones + div.carneros !== div.totalOriginal) {
        return NextResponse.json(
          { error: `Error en potrero: ${div.capones} + ${div.carneros} ≠ ${div.totalOriginal}` },
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

        // Actualizar el existente a "Capones"
        await tx.animalLote.update({
          where: { id: div.animalLoteId },
          data: {
            categoria: "Capones",
            cantidad: div.capones,
            fechaIngreso: new Date(),
          },
        });

        // Crear nuevo para "Carneros"
        if (div.carneros > 0) {
          await tx.animalLote.create({
            data: {
              loteId: div.loteId,
              categoria: "Carneros",
              cantidad: div.carneros,
              peso: animalOriginal.peso,
              fechaIngreso: new Date(),
            },
          });
        }

        // Registrar evento
        await tx.evento.create({
          data: {
            tipo: "RECATEGORIZACION",
            descripcion: `División manual: Corderos DL → ${div.capones} Capones + ${div.carneros} Carneros`,
            fecha: new Date(),
            cantidad: div.totalOriginal,
            categoria: "Capones",
            loteId: div.loteId,
            campoId: user.campoId,
            usuarioId: session.user.id,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al dividir ovinos (castración):", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}