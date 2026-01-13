//src/app/api/recategorizacion/masiva/route
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

    const resultados = [];
    const hoy = new Date();

    for (const recategorizacion of recategorizaciones) {
      const { de, a, filtros } = recategorizacion;

      // Construir where dinámicamente según filtros
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

      // Buscar animales que cumplen las condiciones
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

      if (animales.length === 0) {
        continue; // No hay animales para esta recategorización
      }

      // Actualizar todos los animales
      const animalIds = animales.map(a => a.id);
      await prisma.animalLote.updateMany({
        where: { id: { in: animalIds } },
        data: {
          categoria: a,
          fechaIngreso: hoy,
        },
      });

      // Calcular totales
      const totalAnimales = animales.reduce((sum, animal) => sum + animal.cantidad, 0);
      const potrerosProcesados = [...new Set(animales.map(a => a.lote.nombre))];

      // Crear evento resumen
      await prisma.evento.create({
        data: {
          tipo: "RECATEGORIZACION_MASIVA",
          descripcion: `Recategorización masiva: ${de} → ${a}`,
          fecha: hoy,
          cantidad: totalAnimales,
          categoria: a,
          loteId: null, // null porque afecta múltiples lotes
          campoId: user.campoId,
          metadata: {
            origen: de,
            destino: a,
            potrerosProcesados,
            totalAnimales,
            cantidadPotreros: potrerosProcesados.length,
            filtros: {
              fechaIngreso: filtros.fechaIngreso || null,
              potreroId: filtros.potreroId || null,
              loteRodeoId: filtros.loteRodeoId || null,
            },
          },
        },
      });

      resultados.push({
        de,
        a,
        totalAnimales,
        potrerosProcesados,
      });
    }

    return NextResponse.json({
      success: true,
      resultados,
      totalProcesado: resultados.reduce((sum, r) => sum + r.totalAnimales, 0),
    });
  } catch (error) {
    console.error("Error en recategorización masiva:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}