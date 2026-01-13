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

    // Buscar campos con recategorización activa
    const configs = await prisma.configRecategorizacion.findMany({
      where: {
        OR: [{ bovinosActivo: true }, { ovinosActivo: true }],
      },
      include: {
        campo: true,
      },
    });

    // Filtrar solo los que corresponden a HOY
    const configsParaHoy = configs.filter(config => {
      const esFechaBovinos = config.bovinosActivo && config.bovinosDia === dia && config.bovinosMes === mes;
      const esFechaOvinos = config.ovinosActivo && config.ovinosDia === dia && config.ovinosMes === mes;
      return esFechaBovinos || esFechaOvinos;
    });

    if (configsParaHoy.length === 0) {
      return NextResponse.json({ message: "No hay recategorizaciones para hoy" });
    }

    let totalRecategorizados = 0;

    for (const config of configsParaHoy) {
      // Verificar si HOY es día de bovinos o ovinos
      const esDiaBovinos = config.bovinosActivo && config.bovinosDia === dia && config.bovinosMes === mes;
      const esDiaOvinos = config.ovinosActivo && config.ovinosDia === dia && config.ovinosMes === mes;
      
      // Obtener fecha de corte (inicio del año actual para este campo)
      const anioActual = hoy.getFullYear();
      let fechaCorte: Date;
      
      if (esDiaBovinos) {
        fechaCorte = new Date(anioActual, config.bovinosMes - 1, config.bovinosDia);
      } else {
        fechaCorte = new Date(anioActual, config.ovinosMes - 1, config.ovinosDia);
      }
      
      // Si ya pasó la fecha de corte este año, usar la del año pasado
      if (fechaCorte > hoy) {
        fechaCorte = new Date(anioActual - 1, fechaCorte.getMonth(), fechaCorte.getDate());
      }

      // Procesar bovinos solo si HOY es su día
      if (esDiaBovinos) {
        for (const regla of RECATEGORIZACIONES_BOVINOS) {
          const animales = await prisma.animalLote.findMany({
            where: {
              categoria: regla.de,
              lote: {
                campoId: config.campoId,
              },
              // Solo recategorizar animales que estaban ANTES de la fecha de corte
              fechaIngreso: {
                lt: fechaCorte,
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

      // Procesar ovinos solo si HOY es su día
      if (esDiaOvinos) {
        for (const regla of RECATEGORIZACIONES_OVINOS) {
          const animales = await prisma.animalLote.findMany({
            where: {
              categoria: regla.de,
              lote: {
                campoId: config.campoId,
              },
              fechaIngreso: {
                lt: fechaCorte,
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
      camposProcesados: configsParaHoy.length,
      animalesRecategorizados: totalRecategorizados,
    });
  } catch (error) {
    console.error("Error en recategorización automática:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}