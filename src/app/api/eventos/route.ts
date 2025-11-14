import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

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
    } = body;

    // ====================================================
    // 1) Crear evento
    // ====================================================
    const evento = await prisma.evento.create({
      data: {
        tipo,
        descripcion,
        fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
        cantidad: cantidad ? parseInt(cantidad) : null,
        categoria: categoria || null,
        monto: monto ? parseFloat(monto) : null,
        loteId: loteId || null,
        usuarioId: session.user.id,
        campoId: usuario.campoId,
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
          await prisma.gasto.create({
            data: {
              tipo: "GASTO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: descripcion || `Gasto en ${categoria}`,
              categoria: categoria || "Otros",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              proveedor: proveedor ? proveedor.trim().toLowerCase() : null,
              comprador: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
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

          // ✅ Actualizar ultimoCambio del potrero
          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }

        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: "INGRESO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: descripcion || `Venta de ${categoria}`,
              categoria: categoria || "Otros",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              comprador: comprador ? comprador.trim().toLowerCase() : null,
              proveedor: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
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
            fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
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
            fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
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
          await prisma.gasto.create({
            data: {
              tipo: "GASTO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: `Compra de ${insumo.nombre}`,
              categoria: "Insumos",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              proveedor: proveedor ? proveedor.trim().toLowerCase() : null,
              comprador: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
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
              fechaSiembra: fecha ? new Date(fecha) : new Date(),
              hectareas: parseFloat(hectareas),
              loteId,
            },
          });
        }
        break;

      // ======================================================================
      // COSECHA
      // ======================================================================
      case "COSECHA":
        if (loteId && tipoCultivo) {
          await prisma.cultivo.deleteMany({
            where: { loteId, tipoCultivo, lote: { campoId: usuario.campoId } },
          });
        }

        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: "INGRESO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: descripcion || `Cosecha de ${tipoCultivo}`,
              categoria: categoria || "Cosecha",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              comprador: comprador ? comprador.trim().toLowerCase() : null,
              proveedor: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
          });
        }
        break;

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

          // ✅ Actualizar ultimoCambio del potrero
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

          // ✅ Actualizar ultimoCambio del potrero
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

          // ✅ Actualizar ultimoCambio del potrero
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

          // ✅ Actualizar ultimoCambio del potrero
          await prisma.lote.update({
            where: { id: loteId },
            data: { ultimoCambio: new Date() }
          });
        }

        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: "GASTO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: descripcion || `Compra de ${categoria}`,
              categoria: categoria || "Otros",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              proveedor: proveedor ? proveedor.trim().toLowerCase() : null,
              comprador: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
          });
        }
        break;

      // ======================================================================
      // TRASLADO (similar a CAMBIO_POTRERO pero sin el mismo potrero)
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

        // Restar en origen
        const nuevaCantidadOrigen = animalesOrigen.cantidad - cantidadMover;
        if (nuevaCantidadOrigen === 0) {
          await prisma.animalLote.delete({ where: { id: animalesOrigen.id } });
        } else {
          await prisma.animalLote.update({
            where: { id: animalesOrigen.id },
            data: { cantidad: nuevaCantidadOrigen },
          });
        }

        // Sumar en destino
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

        // ✅ Actualizar ultimoCambio en ambos potreros
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
          await prisma.gasto.create({
            data: {
              tipo: "INGRESO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha + 'T12:00:00Z') : new Date(),
              descripcion: descripcion || "Ingreso",
              categoria: categoria || "Otros",
              metodoPago: metodoPago || "Contado",
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              comprador: comprador ? comprador.trim().toLowerCase() : null,
              proveedor: null,
              diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
              pagado: metodoPago === "Contado" ? true : pagado ?? false,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
          });
        }
        break;

      // ======================================================================
      // 🚜 CAMBIO DE POTRERO
      // ======================================================================
      case "CAMBIO_POTRERO": {
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

        // Restar en origen
        const nuevaCantidadOrigen = animalesOrigen.cantidad - cantidadMover;
        if (nuevaCantidadOrigen === 0) {
          await prisma.animalLote.delete({ where: { id: animalesOrigen.id } });
        } else {
          await prisma.animalLote.update({
            where: { id: animalesOrigen.id },
            data: { cantidad: nuevaCantidadOrigen },
          });
        }

        // Sumar en destino
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

        // ✅ Actualizar ultimoCambio en ambos potreros
        await prisma.lote.update({
          where: { id: loteId },
          data: { ultimoCambio: new Date() }
        });
        
        await prisma.lote.update({
          where: { id: loteDestinoId },
          data: { ultimoCambio: new Date() }
        });

        // Singular/plural inteligente
        const categoriaLabel =
          cantidadMover === 1
            ? categoria.replace(/s$/, "")
            : categoria;

        const descripcionFinal =
          `Cambio de ${cantidadMover} ${categoriaLabel} del potrero "${potreroOrigen.nombre}" al potrero "${potreroDestino.nombre}".`;

        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            loteDestinoId,
            cantidad: cantidadMover,
            categoria,
            notas: notas || null,
            descripcion: descripcionFinal,
          },
        });

        break;
      }

      // ======================================================================
      // 🏷️ RECATEGORIZACIÓN
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

        // ✅ Actualizar ultimoCambio del potrero (no cambia animales de potrero, pero sí la composición)
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