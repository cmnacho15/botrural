import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { convertirAUYU, obtenerTasaCambio } from '@/lib/currency'

// Función para combinar fecha del usuario con hora actual
function crearFechaConHoraActual(fechaUsuario: string | undefined): Date {
  if (!fechaUsuario) return new Date()
  
  try {
    // Si ya viene con hora (ISO completo), usarlo directamente
    if (fechaUsuario.includes('T')) {
      return new Date(fechaUsuario)
    }
    
    // Si es solo fecha, agregar hora actual
    const fecha = new Date(fechaUsuario + 'T00:00:00.000Z')
    const ahora = new Date()
    
    // Combinar la fecha del usuario con la hora actual
    fecha.setUTCHours(ahora.getUTCHours())
    fecha.setUTCMinutes(ahora.getUTCMinutes())
    fecha.setUTCSeconds(ahora.getUTCSeconds())
    fecha.setUTCMilliseconds(ahora.getUTCMilliseconds())
    
    return fecha
  } catch (error) {
    console.error('Error parseando fecha:', fechaUsuario, error)
    return new Date() // Fallback a fecha actual
  }
}

// ====================================================
// FUNCIÓN ÚNICA PARA GUARDAR REGISTROS FINANCIEROS
// ====================================================
async function crearGastoFinanciero({
  tipo,
  monto,
  descripcion,
  categoria,
  fecha,
  moneda,
  metodoPago,
  iva,
  proveedor,
  comprador,
  campoId,
  loteId,
  diasPlazo,
  pagado,
  especie
}: {
  tipo: "GASTO" | "INGRESO"
  monto: number
  descripcion: string
  categoria: string
  fecha: Date
  moneda: string
  metodoPago?: string
  iva?: number | null
  proveedor?: string | null
  comprador?: string | null
  campoId: string
  loteId?: string | null
  diasPlazo?: number | null
  pagado?: boolean
  especie?: string | null
}) {
  const tasaCambio = await obtenerTasaCambio(moneda)
  const montoEnUYU = await convertirAUYU(monto, moneda)
  
  // ✅ Calcular montoEnUSD
  const montoEnUSD = moneda === "USD" 
    ? monto 
    : monto / (tasaCambio || 40)
  
  return prisma.gasto.create({
    data: {
      tipo,
      monto,
      montoOriginal: monto,
      moneda,
      tasaCambio,
      montoEnUYU,
      montoEnUSD,  // ✅ NUEVO
      especie: especie || null,  // ✅ ESTO  // ✅ NUEVO (eventos del sistema no asignan especie)
      fecha,
      descripcion,
      categoria: categoria || "Otros",
      metodoPago: metodoPago || "Contado",
      iva: iva !== undefined ? iva : null,
      proveedor: proveedor ? proveedor.trim().toLowerCase() : null,
      comprador: comprador ? comprador.trim().toLowerCase() : null,
      diasPlazo: metodoPago === "Plazo" ? diasPlazo : null,
      pagado: metodoPago === "Contado" ? true : (pagado ?? false),
      campoId,
      loteId: loteId || null,
    }
  })
}

// ====================================================
// POST – CREAR EVENTO
// ====================================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId)
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 });

    const body = await request.json();

    const {
      tipo,
      fecha,
      descripcion,
      loteId,
      cantidad,
      categoria,
      animales,
      monto,
      insumoId,
      tipoCultivo,
      hectareas,
      loteDestinoId,
      metodoPago,
      intensidad,
      notas,
      iva,
      comprador,
      diasPlazo,
      pagado,
      proveedor,
      categoriaNueva,
      especie,
      rodeoId,
    } = body;

    const moneda = body.moneda || 'UYU';

    // ====================================================
    // 1) Crear evento
    // ====================================================
    const evento = await prisma.evento.create({
      data: {
        tipo,
        descripcion,
        fecha: crearFechaConHoraActual(fecha),
        cantidad: cantidad ? parseInt(cantidad) : null,
        categoria: categoria || null,
        monto: monto ? parseFloat(monto) : null,
        loteId: loteId || null,
        usuarioId: session.user.id,
        campoId: usuario.campoId,
        notas: notas || null,
        rodeoId: rodeoId || null,
      },
    });

    // ====================================================
    // 2) Lógica por tipo
    // ====================================================
    switch (tipo) {
      // ======================================================================
      // LLUVIA / HELADA
      // ======================================================================
      case "LLUVIA":
      case "HELADA":
        break;

      // ======================================================================
      // GASTO
      // ======================================================================
      case "GASTO":
        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            proveedor: proveedor || null,
            metodoPago: metodoPago || "Contado",
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          },
        });

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "GASTO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Gasto en ${categoria}`,
            categoria: categoria || "Otros",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor,
            comprador: null,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
            especie: especie || null, 
          });
        }
        break;

      // ======================================================================
      // VENTA → INGRESO
      // ======================================================================
      case "VENTA":
        if (loteId && cantidad && categoria) {
          const animal = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animal) {
            const nuevaCantidad = Math.max(0, animal.cantidad - parseInt(cantidad));
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animal.id } });
            } else {
              await prisma.animalLote.update({
                where: { id: animal.id },
                data: { cantidad: nuevaCantidad },
              });
            }
          }

          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "INGRESO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Venta de ${categoria}`,
            categoria: categoria || "Ventas",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor: null,
            comprador,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          });
        }
        break;

      // ======================================================================
      // USO DE INSUMO
      // ======================================================================
      case "USO_INSUMO": {
        if (!insumoId || !cantidad)
          return NextResponse.json({ error: "insumoId y cantidad requeridos" }, { status: 400 });

        const insumo = await prisma.insumo.findFirst({
          where: { id: insumoId, campoId: usuario.campoId },
        });

        if (!insumo)
          return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });

        await prisma.movimientoInsumo.create({
          data: {
            tipo: "USO",
            cantidad: parseFloat(cantidad),
            fecha: crearFechaConHoraActual(fecha),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null,
          },
        });

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: Math.max(0, insumo.stock - parseFloat(cantidad)) },
        });

        break;
      }

      // ======================================================================
      // INGRESO INSUMO
      // ======================================================================
      case "INGRESO_INSUMO": {
        if (!insumoId || !cantidad)
          return NextResponse.json({ error: "insumoId y cantidad requeridos" }, { status: 400 });

        const insumo = await prisma.insumo.findFirst({
          where: { id: insumoId, campoId: usuario.campoId },
        });

        if (!insumo)
          return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });

        await prisma.movimientoInsumo.create({
          data: {
            tipo: "INGRESO",
            cantidad: parseFloat(cantidad),
            fecha: crearFechaConHoraActual(fecha),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null,
          },
        });

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: insumo.stock + parseFloat(cantidad) },
        });

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "GASTO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Compra de insumo: ${insumo.nombre}`,
            categoria: categoria || "Insumos",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor,
            comprador: null,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          });
        }

        break;
      }

      // ======================================================================
      // SIEMBRA
      // ======================================================================
      case "SIEMBRA":
        if (loteId && tipoCultivo && hectareas) {
          await prisma.cultivo.create({
            data: {
              tipoCultivo,
              fechaSiembra: crearFechaConHoraActual(fecha),
              hectareas: parseFloat(hectareas),
              loteId,
            },
          });
        }
        break;

      // ======================================================================
      // COSECHA
      // ======================================================================
      case "COSECHA": {
        if (!loteId || !body.cultivoId || !hectareas) {
          return NextResponse.json(
            { error: "Se requiere loteId, cultivoId y hectareas" },
            { status: 400 }
          );
        }

        const cultivoActual = await prisma.cultivo.findFirst({
          where: {
            id: body.cultivoId,
            loteId,
            lote: { campoId: usuario.campoId },
          },
        });

        if (!cultivoActual) {
          return NextResponse.json(
            { error: "Cultivo no encontrado" },
            { status: 404 }
          );
        }

        const hectareasCosechar = parseFloat(hectareas);

        if (hectareasCosechar > cultivoActual.hectareas) {
          return NextResponse.json(
            { error: `No puedes cosechar más de ${cultivoActual.hectareas} ha disponibles` },
            { status: 400 }
          );
        }

        const hectareasRestantes = cultivoActual.hectareas - hectareasCosechar;

        if (hectareasRestantes === 0 || Math.abs(hectareasRestantes) < 0.01) {
          await prisma.cultivo.delete({
            where: { id: cultivoActual.id },
          });
        } else {
          await prisma.cultivo.update({
            where: { id: cultivoActual.id },
            data: { hectareas: hectareasRestantes },
          });
        }

        await prisma.lote.update({
          where: { id: loteId },
          data: { ultimoCambio: new Date() },
        });

        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            notas: notas || null,
          },
        });

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "INGRESO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Cosecha de ${cultivoActual.tipoCultivo}`,
            categoria: categoria || "Agricultura",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor: null,
            comprador,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          });
        }

        break;
      }

      // ======================================================================
      // NACIMIENTO
      // ======================================================================
      case "NACIMIENTO":
        if (loteId && cantidad && categoria) {
          const animal = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animal) {
            await prisma.animalLote.update({
              where: { id: animal.id },
              data: { cantidad: animal.cantidad + parseInt(cantidad) },
            });
          } else {
            await prisma.animalLote.create({
              data: { categoria, cantidad: parseInt(cantidad), loteId },
            });
          }

          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }
        break;

      // ======================================================================
      // MORTANDAD
      // ======================================================================
      case "MORTANDAD":
        if (loteId && cantidad && categoria) {
          const animal = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animal) {
            const nuevaCantidad = Math.max(0, animal.cantidad - parseInt(cantidad));
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animal.id } });
            } else {
              await prisma.animalLote.update({
                where: { id: animal.id },
                data: { cantidad: nuevaCantidad },
              });
            }
          }

          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }
        break;

      // ======================================================================
      // CONSUMO
      // ======================================================================
      case "CONSUMO":
        if (loteId && cantidad && categoria) {
          const animal = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animal) {
            const nuevaCantidad = Math.max(0, animal.cantidad - parseInt(cantidad));
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animal.id } });
            } else {
              await prisma.animalLote.update({
                where: { id: animal.id },
                data: { cantidad: nuevaCantidad },
              });
            }
          }

          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }
        break;

      // ======================================================================
      // COMPRA
      // ======================================================================
      case "COMPRA":
        if (loteId && cantidad && categoria) {
          const animal = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animal) {
            await prisma.animalLote.update({
              where: { id: animal.id },
              data: { cantidad: animal.cantidad + parseInt(cantidad) },
            });
          } else {
            await prisma.animalLote.create({
              data: { categoria, cantidad: parseInt(cantidad), loteId },
            });
          }

          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "GASTO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Compra de ${categoria}`,
            categoria: categoria || "Animales",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor,
            comprador: null,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          });
        }
        break;

      // ======================================================================
      // TRASLADO
      // ======================================================================
      case "TRASLADO": {
        if (!loteId || !loteDestinoId || !categoria)
          return NextResponse.json(
            { error: "Se requiere potrero origen, destino y categoría" },
            { status: 400 }
          );

        const [potreroOrigen, potreroDestino] = await Promise.all([
          prisma.lote.findFirst({
            where: { id: loteId, campoId: usuario.campoId },
          }),
          prisma.lote.findFirst({
            where: { id: loteDestinoId, campoId: usuario.campoId },
          }),
        ]);

        if (!potreroOrigen || !potreroDestino)
          return NextResponse.json(
            { error: "Potreros no válidos" },
            { status: 404 }
          );

        const animalesOrigen = await prisma.animalLote.findFirst({
          where: { loteId, categoria, lote: { campoId: usuario.campoId } },
        });

        if (!animalesOrigen)
          return NextResponse.json(
            { error: `No hay animales de ${categoria} en el potrero origen` },
            { status: 404 }
          );

        const cantidadMover = cantidad ? parseInt(cantidad) : animalesOrigen.cantidad;

        if (cantidadMover > animalesOrigen.cantidad)
          return NextResponse.json(
            { error: "No hay suficientes animales" },
            { status: 400 }
          );

        const nuevaCantidadOrigen = animalesOrigen.cantidad - cantidadMover;
        if (nuevaCantidadOrigen === 0) {
          await prisma.animalLote.delete({ where: { id: animalesOrigen.id } });
        } else {
          await prisma.animalLote.update({
            where: { id: animalesOrigen.id },
            data: { cantidad: nuevaCantidadOrigen },
          });
        }

        const animalesDestino = await prisma.animalLote.findFirst({
          where: {
            loteId: loteDestinoId,
            categoria,
            lote: { campoId: usuario.campoId },
          },
        });

        if (animalesDestino) {
          await prisma.animalLote.update({
            where: { id: animalesDestino.id },
            data: { cantidad: animalesDestino.cantidad + cantidadMover },
          });
        } else {
          await prisma.animalLote.create({
            data: {
              categoria,
              cantidad: cantidadMover,
              loteId: loteDestinoId,
            },
          });
        }

        await prisma.lote.update({
          where: { id: loteId },
          data: { ultimoCambio: new Date() }
        });
        
        await prisma.lote.update({
          where: { id: loteDestinoId },
          data: { ultimoCambio: new Date() }
        });

        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            loteDestinoId,
            cantidad: cantidadMover,
            categoria,
            notas: notas || null,
          },
        });

        break;
      }

      // ======================================================================
      // INGRESO (GENÉRICO)
      // ======================================================================
      case "INGRESO":
        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            comprador: comprador || null,
            metodoPago: metodoPago || "Contado",
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          },
        });

        if (monto && parseFloat(monto) > 0) {
          await crearGastoFinanciero({
            tipo: "INGRESO",
            monto: parseFloat(monto),
            descripcion: descripcion || `Ingreso - ${categoria}`,
            categoria: categoria || "Otros Ingresos",
            fecha: crearFechaConHoraActual(fecha),
            moneda,
            metodoPago,
            iva: iva !== undefined ? parseFloat(String(iva)) : null,
            proveedor: null,
            comprador,
            campoId: usuario.campoId,
            loteId,
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : pagado ?? false,
          });
        }
        break;

      // ======================================================================
      // CAMBIO DE POTRERO
      // ======================================================================
      case "CAMBIO_POTRERO": {
  if (!loteId || !loteDestinoId)
    return NextResponse.json(
      { error: "Se requiere potrero origen y destino" },
      { status: 400 }
    );

  // Soportar array de animales O categoria/cantidad individual (retrocompatibilidad)
  const animalesAProcesar = animales && Array.isArray(animales) && animales.length > 0
    ? animales
    : categoria ? [{ categoria, cantidad: cantidad ? parseInt(cantidad) : null }] : [];

  if (animalesAProcesar.length === 0)
    return NextResponse.json(
      { error: "Se requiere al menos una categoría de animales" },
      { status: 400 }
    );

  const [potreroOrigen, potreroDestino] = await Promise.all([
    prisma.lote.findFirst({
      where: { id: loteId, campoId: usuario.campoId },
    }),
    prisma.lote.findFirst({
      where: { id: loteDestinoId, campoId: usuario.campoId },
    }),
  ]);

  if (!potreroOrigen || !potreroDestino)
    return NextResponse.json(
      { error: "Potreros no válidos" },
      { status: 404 }
    );

  // Procesar cada categoría de animales
  for (const animalData of animalesAProcesar) {
    const { categoria: cat, cantidad: cant } = animalData;

    const animalesOrigen = await prisma.animalLote.findFirst({
      where: { loteId, categoria: cat, lote: { campoId: usuario.campoId } },
    });

    if (!animalesOrigen) {
      return NextResponse.json(
        { error: `No hay animales de ${cat} en el potrero origen` },
        { status: 404 }
      );
    }

    const cantidadMover = cant ? parseInt(String(cant)) : animalesOrigen.cantidad;

    if (cantidadMover > animalesOrigen.cantidad) {
      return NextResponse.json(
        { error: `No hay suficientes ${cat} (disponibles: ${animalesOrigen.cantidad})` },
        { status: 400 }
      );
    }

    // Restar del origen
    const nuevaCantidadOrigen = animalesOrigen.cantidad - cantidadMover;
    if (nuevaCantidadOrigen === 0) {
      await prisma.animalLote.delete({ where: { id: animalesOrigen.id } });
    } else {
      await prisma.animalLote.update({
        where: { id: animalesOrigen.id },
        data: { cantidad: nuevaCantidadOrigen },
      });
    }

    // Sumar al destino
    const animalesDestino = await prisma.animalLote.findFirst({
      where: {
        loteId: loteDestinoId,
        categoria: cat,
        lote: { campoId: usuario.campoId },
      },
    });

    if (animalesDestino) {
      await prisma.animalLote.update({
        where: { id: animalesDestino.id },
        data: { cantidad: animalesDestino.cantidad + cantidadMover },
      });
    } else {
      await prisma.animalLote.create({
        data: {
          categoria: cat,
          cantidad: cantidadMover,
          loteId: loteDestinoId,
        },
      });
    }
  }

  // Actualizar timestamps de ambos potreros
  await prisma.lote.update({
    where: { id: loteId },
    data: { ultimoCambio: new Date() }
  });
  
  await prisma.lote.update({
    where: { id: loteDestinoId },
    data: { ultimoCambio: new Date() }
  });

  // Actualizar evento con resumen
  const resumenAnimales = animalesAProcesar.map(a => `${a.cantidad} ${a.categoria}`).join(', ');
  
  await prisma.evento.update({
    where: { id: evento.id },
    data: {
      loteDestinoId,
      cantidad: animalesAProcesar.reduce((sum, a) => sum + (parseInt(String(a.cantidad)) || 0), 0),
      categoria: animalesAProcesar.map(a => a.categoria).join(', '),
      notas: notas || null,
    },
  });

  break;
}

      // ======================================================================
      // RECATEGORIZACIÓN
      // ======================================================================
      case "RECATEGORIZACION": {
        if (!loteId || !cantidad || !categoria || !categoriaNueva)
          return NextResponse.json(
            { error: "Faltan datos: loteId, cantidad, categoria, categoriaNueva" },
            { status: 400 }
          );

        if (categoria === categoriaNueva)
          return NextResponse.json(
            { error: "La categoría nueva debe ser distinta" },
            { status: 400 }
          );

        const animalActual = await prisma.animalLote.findFirst({
          where: { loteId, categoria, lote: { campoId: usuario.campoId } },
        });

        if (!animalActual)
          return NextResponse.json(
            { error: `No hay animales de ${categoria} en este potrero` },
            { status: 404 }
          );

        const cant = parseInt(cantidad);

        if (cant > animalActual.cantidad)
          return NextResponse.json(
            { error: "Cantidad mayor a existente" },
            { status: 400 }
          );

        const nuevaCantidadActual = animalActual.cantidad - cant;

        if (nuevaCantidadActual === 0) {
          await prisma.animalLote.delete({ where: { id: animalActual.id } });
        } else {
          await prisma.animalLote.update({
            where: { id: animalActual.id },
            data: { cantidad: nuevaCantidadActual },
          });
        }

        const animalNuevo = await prisma.animalLote.findFirst({
          where: {
            loteId,
            categoria: categoriaNueva,
            lote: { campoId: usuario.campoId },
          },
        });

        if (animalNuevo) {
          await prisma.animalLote.update({
            where: { id: animalNuevo.id },
            data: { cantidad: animalNuevo.cantidad + cant },
          });
        } else {
          await prisma.animalLote.create({
            data: {
              categoria: categoriaNueva,
              cantidad: cant,
              loteId,
            },
          });
        }

        await prisma.lote.update({
          where: { id: loteId },
          data: { ultimoCambio: new Date() }
        });

        const potrero = await prisma.lote.findUnique({
          where: { id: loteId },
          select: { nombre: true },
        });

        const catActualLabel = cant === 1 ? categoria.replace(/s$/, "") : categoria;
        const catNuevaLabel = cant === 1 ? categoriaNueva.replace(/s$/, "") : categoriaNueva;

        const descripcionRecat =
          `Recategorización de ${cant} ${catActualLabel} a ${catNuevaLabel} en potrero "${potrero?.nombre}".`;

        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            descripcion: descripcionRecat,
            notas: notas || null,
            categoriaNueva,
          },
        });

        break;
      }

      // ======================================================================
      // DEFAULT
      // ======================================================================
      default:
        break;
    }

    // ====================================================
    // FIN — RESPUESTA
    // ====================================================
    return NextResponse.json({ success: true, evento }, { status: 201 });
  } catch (error) {
    console.error("ERROR EN POST /api/eventos:", error);
    return NextResponse.json(
      {
        error: "Error al crear el evento",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}