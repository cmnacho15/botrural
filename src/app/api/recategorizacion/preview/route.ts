import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

type Filtros = {
  fechaIngreso?: string;
  potreroId?: string;
  loteRodeoId?: string;
};

type Recategorizacion = {
  de: string;
  a: string;
  filtros: Filtros;
};

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

    const { recategorizaciones } = await req.json() as { recategorizaciones: Recategorizacion[] };

    if (!recategorizaciones || recategorizaciones.length === 0) {
      return NextResponse.json({ error: "No hay recategorizaciones seleccionadas" }, { status: 400 });
    }

    const previews = [];

    for (const recategorizacion of recategorizaciones) {
      const { de, a, filtros } = recategorizacion;

      // Construir where dinámicamente
      const whereCondition: any = {
        categoria: de,
        lote: { campoId: user.campoId },
      };

      if (filtros.fechaIngreso) {
        whereCondition.fechaIngreso = {
          lt: new Date(filtros.fechaIngreso),
        };
      }

      if (filtros.potreroId) {
        whereCondition.loteId = filtros.potreroId;
      }

      if (filtros.loteRodeoId) {
        whereCondition.rodeoId = filtros.loteRodeoId;
      }

      // Buscar animales
      const animales = await prisma.animalLote.findMany({
        where: whereCondition,
        include: {
          lote: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      // Agrupar por potrero
      const porPotrero = animales.reduce((acc, animal) => {
        const key = animal.lote.nombre;
        if (!acc[key]) {
          acc[key] = 0;
        }
        acc[key] += animal.cantidad;
        return acc;
      }, {} as Record<string, number>);

      const totalAnimales = animales.reduce((sum, animal) => sum + animal.cantidad, 0);

      previews.push({
        de,
        a,
        totalAnimales,
        potreros: Object.entries(porPotrero).map(([nombre, cantidad]) => ({
          nombre,
          cantidad,
        })),
        filtros,
      });
    }

    const totalGeneral = previews.reduce((sum, p) => sum + p.totalAnimales, 0);

    return NextResponse.json({
      previews,
      totalGeneral,
      cantidadRecategorizaciones: previews.length,
    });
  } catch (error) {
    console.error("Error en preview:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}