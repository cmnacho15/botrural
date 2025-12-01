// app/api/ventas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { TipoEvento, TipoAnimal } from '@prisma/client';

// ========================================
// GET /api/ventas - Obtener ventas filtradas
// ========================================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    });

    if (!user?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo asignado' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    if (!fechaDesde || !fechaHasta) {
      return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
    }

    // Obtener todas las ventas del período
    const ventas = await prisma.evento.findMany({
      where: {
        campoId: user.campoId,
        tipo: TipoEvento.VENTA,
        fecha: {
          gte: new Date(fechaDesde),
          lte: new Date(fechaHasta)
        }
      },
      orderBy: { fecha: 'desc' },
      include: {
        animalLote: {
          include: {
            lote: true
          }
        }
      }
    });

    // ========================================
    // CÁLCULO DE RESUMEN POR ESPECIE Y CATEGORÍA
    // ========================================
    const resumenBovino = calcularResumenPorEspecie(ventas, TipoAnimal.BOVINO);
    const resumenOvino = calcularResumenPorEspecie(ventas, TipoAnimal.OVINO);
    const resumenLana = calcularResumenLana(ventas);

    // Totales generales
    const totalGeneral = {
      animales: resumenBovino.total.animales + resumenOvino.total.animales + resumenLana.total.animales,
      kgTotales: resumenBovino.total.kgTotales + resumenOvino.total.kgTotales + resumenLana.total.kgTotales,
      usdBruto: resumenBovino.total.usdBruto + resumenOvino.total.usdBruto + resumenLana.total.usdBruto,
      usdNeto: resumenBovino.total.usdNeto + resumenOvino.total.usdNeto + resumenLana.total.usdNeto
    };

    return NextResponse.json({
      ventas,
      resumen: {
        bovino: resumenBovino,
        ovino: resumenOvino,
        lana: resumenLana,
        totalGeneral
      }
    });

  } catch (error) {
    console.error('Error al obtener ventas:', error);
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}

// ========================================
// POST /api/ventas - Crear nueva venta
// ========================================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true }
    });

    if (!user?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo asignado' }, { status: 400 });
    }

    const body = await req.json();
    const {
      fecha,
      comprador,
      moneda,
      metodoPago,
      diasPlazo,
      pagado,
      notas,
      renglones, // Array de renglones de la boleta
      tasaCambio
    } = body;

    // Validaciones
    if (!fecha || !comprador || !renglones || renglones.length === 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Crear ventas en transacción
    const ventasCreadas = await prisma.$transaction(async (tx) => {
      const eventos = [];

      for (const renglon of renglones) {
        const {
          tipoAnimal,
          categoria,
          animalLoteId,
          cantidadVendida,
          pesoLoteKg,
          precioKgUSD,
          montoBrutoUSD,
          montoNetoUSD
        } = renglon;

        // Calcular monto en UYU
        let montoEnUYU = montoBrutoUSD;
        let tasaCambioFinal = null;
        
        if (moneda === 'USD' && tasaCambio) {
          montoEnUYU = montoBrutoUSD * tasaCambio;
          tasaCambioFinal = tasaCambio;
        }

        // Crear evento de venta
        const evento = await tx.evento.create({
          data: {
            tipo: TipoEvento.VENTA,
            descripcion: `Venta de ${cantidadVendida} ${categoria} a ${comprador}`,
            fecha: new Date(fecha),
            campoId: user.campoId,
            usuarioId: session.user.id,
            comprador,
            metodoPago: metodoPago || 'Contado',
            diasPlazo: diasPlazo || 0,
            pagado: pagado || false,
            notas,
            
            // Campos específicos de venta de ganado
            tipoAnimal,
            categoria,
            cantidadVendida,
            pesoLoteKg,
            precioKgUSD,
            montoBrutoUSD,
            montoNetoUSD: montoNetoUSD || montoBrutoUSD,
            moneda,
            montoEnUYU,
            tasaCambio: tasaCambioFinal,
            animalLoteId: animalLoteId || null,
            
            // Fecha de vencimiento si hay plazo
            fechaVencimiento: diasPlazo > 0 
              ? new Date(new Date(fecha).getTime() + diasPlazo * 24 * 60 * 60 * 1000)
              : null
          }
        });

        // Si viene de un lote específico, actualizar stock
        if (animalLoteId) {
          const animalLote = await tx.animalLote.findUnique({
            where: { id: animalLoteId }
          });

          if (animalLote) {
            const nuevaCantidad = animalLote.cantidad - cantidadVendida;
            
            if (nuevaCantidad < 0) {
              throw new Error(`No hay suficiente stock de ${categoria}`);
            }

            if (nuevaCantidad === 0) {
              // Eliminar el lote si queda en 0
              await tx.animalLote.delete({
                where: { id: animalLoteId }
              });
            } else {
              // Actualizar cantidad
              await tx.animalLote.update({
                where: { id: animalLoteId },
                data: { cantidad: nuevaCantidad }
              });
            }
          }
        }

        eventos.push(evento);
      }

      return eventos;
    });

    return NextResponse.json({ 
      success: true, 
      ventas: ventasCreadas 
    });

  } catch (error) {
    console.error('Error al crear venta:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error al crear venta' 
    }, { status: 500 });
  }
}

// ========================================
// FUNCIONES AUXILIARES DE CÁLCULO
// ========================================

/**
 * Calcula el resumen de ventas por especie
 * Agrupa por categoría y calcula totales
 */
function calcularResumenPorEspecie(ventas: any[], tipoAnimal: TipoAnimal) {
  // Filtrar ventas de la especie
  const ventasEspecie = ventas.filter(v => v.tipoAnimal === tipoAnimal);
  
  // Agrupar por categoría
  const categorias = new Map<string, {
    numAnimales: number;
    kgTotales: number;
    usdBruto: number;
    usdNeto: number;
  }>();

  ventasEspecie.forEach(venta => {
    const cat = venta.categoria || 'Sin categoría';
    const actual = categorias.get(cat) || {
      numAnimales: 0,
      kgTotales: 0,
      usdBruto: 0,
      usdNeto: 0
    };

    categorias.set(cat, {
      numAnimales: actual.numAnimales + (venta.cantidadVendida || 0),
      kgTotales: actual.kgTotales + (venta.pesoLoteKg || 0),
      usdBruto: actual.usdBruto + (venta.montoBrutoUSD || 0),
      usdNeto: actual.usdNeto + (venta.montoNetoUSD || venta.montoBrutoUSD || 0)
    });
  });

  // Convertir a array y calcular promedios
  const detalleCategorias = Array.from(categorias.entries()).map(([categoria, datos]) => ({
    categoria,
    numAnimales: datos.numAnimales,
    kgTotales: datos.kgTotales,
    pesoPromedio: datos.numAnimales > 0 ? datos.kgTotales / datos.numAnimales : 0,
    usdBruto: datos.usdBruto,
    usdNeto: datos.usdNeto,
    precioKg: datos.kgTotales > 0 ? datos.usdBruto / datos.kgTotales : 0,
    precioCabeza: datos.numAnimales > 0 ? datos.usdBruto / datos.numAnimales : 0
  }));

  // Calcular totales
  const total = {
    animales: detalleCategorias.reduce((sum, cat) => sum + cat.numAnimales, 0),
    kgTotales: detalleCategorias.reduce((sum, cat) => sum + cat.kgTotales, 0),
    usdBruto: detalleCategorias.reduce((sum, cat) => sum + cat.usdBruto, 0),
    usdNeto: detalleCategorias.reduce((sum, cat) => sum + cat.usdNeto, 0)
  };

  return {
    categorias: detalleCategorias,
    total: {
      ...total,
      pesoPromedio: total.animales > 0 ? total.kgTotales / total.animales : 0,
      precioKg: total.kgTotales > 0 ? total.usdBruto / total.kgTotales : 0,
      precioCabeza: total.animales > 0 ? total.usdBruto / total.animales : 0
    }
  };
}

/**
 * Calcula el resumen de ventas de lana
 * Lana tiene cálculo especial: vellón + barriga
 */
function calcularResumenLana(ventas: any[]) {
  const ventasLana = ventas.filter(v => v.esVentaLana === true);

  // Calcular totales de vellón y barriga por separado
  const kgVellon = ventasLana.reduce((sum, v) => sum + (v.kgVellon || 0), 0);
  const kgBarriga = ventasLana.reduce((sum, v) => sum + (v.kgBarriga || 0), 0);
  const kgTotales = kgVellon + kgBarriga;
  
  const animalesEsquilados = ventasLana.reduce((sum, v) => sum + (v.numeroEsquilados || 0), 0);
  const usdBruto = ventasLana.reduce((sum, v) => sum + (v.montoBrutoUSD || 0), 0);
  const usdNeto = ventasLana.reduce((sum, v) => sum + (v.montoNetoUSD || v.montoBrutoUSD || 0), 0);

  // Calcular precio promedio ponderado por kg
  const precioKg = kgTotales > 0 ? usdBruto / kgTotales : 0;
  const precioCabeza = animalesEsquilados > 0 ? usdBruto / animalesEsquilados : 0;
  const pesoPromedio = animalesEsquilados > 0 ? kgTotales / animalesEsquilados : 0;

  return {
    categorias: [{
      categoria: 'Lana',
      numAnimales: animalesEsquilados,
      kgTotales,
      kgVellon,
      kgBarriga,
      pesoPromedio,
      usdBruto,
      usdNeto,
      precioKg,
      precioCabeza
    }],
    total: {
      animales: animalesEsquilados,
      kgTotales,
      kgVellon,
      kgBarriga,
      usdBruto,
      usdNeto,
      pesoPromedio,
      precioKg,
      precioCabeza
    }
  };
}