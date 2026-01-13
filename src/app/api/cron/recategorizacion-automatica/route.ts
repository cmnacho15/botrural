import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapeo de recategorizaciones automáticas
const RECATEGORIZACIONES_BOVINOS = [
  { de: "Terneros", a: "Novillos 1-2" },
  { de: "Terneras", a: "Vaquillonas 1-2" },
  { de: "Novillos 1-2", a: "Novillos 2-3" },
  { de: "Novillos 2-3", a: "Novillos +3" },
  { de: "Vaquillonas 1-2", a: "Vaquillonas +2" },
  { de: "Vaquillonas +2", a: "Vacas" },
];

const RECATEGORIZACIONES_OVINOS = [
  { de: "Corderas DL", a: "Borregas 2-4 dientes" },
  { de: "Borregas 2-4 dientes", a: "Ovejas" },
];

export async function POST(req: Request) {
  try {
    const hoy = new Date();
    const dia = hoy.getDate();
    const mes = hoy.getMonth() + 1;

    // Solo ejecutar el 1ro de enero
    if (dia !== 1 || mes !== 1) {
      return NextResponse.json({ message: "No es la fecha de recategorización" });
    }

    // Buscar campos con recategorización activa
    const configs = await prisma.configRecategorizacion.findMany({
      where: {
        OR: [{ bovinosActivo: true }, { ovinosActivo: true }],
      },
      include: {
        campo: true,
      },
    });

    let totalRecategorizados = 0;

    for (const config of configs) {
      // Procesar bovinos
      if (config.bovinosActivo) {
        for (const regla of RECATEGORIZACIONES_BOVINOS) {
          const animales = await prisma.animalLote.findMany({
            where: {
              categoria: regla.de,
              lote: {
                campoId: config.campoId,
              },
              // Solo recategorizar animales que estaban ANTES del 1ro de enero
              fechaIngreso: {
                lt: new Date(hoy.getFullYear(), 0, 1), // antes del 1/1 de este año
              },
            },
          });

          for (const animal of animales) {
            await prisma.animalLote.update({
              where: { id: animal.id },
              data: {
                categoria: regla.a,
                fechaIngreso: hoy,
              },
            });

            await prisma.evento.create({
              data: {
                tipo: "RECATEGORIZACION",
                descripcion: `Recategorización automática: ${regla.de} → ${regla.a}`,
                fecha: hoy,
                cantidad: animal.cantidad,
                categoria: regla.a,
                loteId: animal.loteId,
                campoId: config.campoId,
              },
            });

            totalRecategorizados++;
          }
        }
      }

      // Procesar ovinos
      if (config.ovinosActivo) {
        for (const regla of RECATEGORIZACIONES_OVINOS) {
          const animales = await prisma.animalLote.findMany({
            where: {
              categoria: regla.de,
              lote: {
                campoId: config.campoId,
              },
              fechaIngreso: {
                lt: new Date(hoy.getFullYear(), 0, 1),
              },
            },
          });

          for (const animal of animales) {
            await prisma.animalLote.update({
              where: { id: animal.id },
              data: {
                categoria: regla.a,
                fechaIngreso: hoy,
              },
            });

            await prisma.evento.create({
              data: {
                tipo: "RECATEGORIZACION",
                descripcion: `Recategorización automática: ${regla.de} → ${regla.a}`,
                fecha: hoy,
                cantidad: animal.cantidad,
                categoria: regla.a,
                loteId: animal.loteId,
                campoId: config.campoId,
              },
            });

            totalRecategorizados++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      camposProcesados: configs.length,
      animalesRecategorizados: totalRecategorizados,
    });
  } catch (error) {
    console.error("Error en recategorización automática:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}