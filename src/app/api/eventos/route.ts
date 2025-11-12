import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// ==============================================
// POST: Crear un nuevo evento con lógica integrada
// ==============================================
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 });
    }

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
      comprador, // ← NUEVO
      diasPlazo, // ← NUEVO
      pagado,    // ← NUEVO (opcional, se puede calcular)
    } = body;

    console.log("Creando evento:", { tipo, descripcion });

    // 1. CREAR EL EVENTO PRINCIPAL
    const evento = await prisma.evento.create({
      data: {
        tipo,
        descripcion,
        fecha: fecha ? new Date(fecha) : new Date(),
        cantidad: cantidad ? parseInt(cantidad) : null,
        categoria: categoria || null,
        loteId: loteId || null,
        usuarioId: session.user.id,
        campoId: usuario.campoId,
      },
    });

    console.log("Evento creado:", evento.id);

    // 2. LÓGICA SEGÚN EL TIPO DE EVENTO
    switch (tipo) {
      // LLUVIA / HELADA
      case "LLUVIA":
      case "HELADA":
        break;

      // GASTO
      case "GASTO":
        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: "GASTO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha) : new Date(),
              descripcion: descripcion || `Gasto en ${categoria}`,
              categoria: categoria || "Otros",
              metodoPago: metodoPago || null,
              iva: iva !== undefined ? parseFloat(String(iva)) : null,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
          });
          console.log("Gasto registrado correctamente");
        }
        break;

      // VENTA
      case "VENTA":
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animalExistente) {
            const nuevaCantidad = Math.max(0, animalExistente.cantidad - parseInt(cantidad));
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animalExistente.id } });
            } else {
              await prisma.animalLote.update({
                where: { id: animalExistente.id },
                data: { cantidad: nuevaCantidad },
              });
            }
          }
          console.log("Animales restados del lote (venta)");
        }
        break;

      // USO DE INSUMO
      case "USO_INSUMO":
        if (!insumoId || !cantidad) {
          return NextResponse.json({ error: "insumoId y cantidad requeridos" }, { status: 400 });
        }

        const insumoUso = await prisma.insumo.findFirst({
          where: { id: insumoId, campoId: usuario.campoId },
        });
        if (!insumoUso) {
          return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
        }

        await prisma.movimientoInsumo.create({
          data: {
            tipo: "USO",
            cantidad: parseFloat(cantidad),
            fecha: fecha ? new Date(fecha) : new Date(),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null,
          },
        });

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: Math.max(0, insumoUso.stock - parseFloat(cantidad)) },
        });

        console.log("Uso de insumo registrado");
        break;

      // INGRESO DE INSUMO
      case "INGRESO_INSUMO":
        if (!insumoId || !cantidad) {
          return NextResponse.json({ error: "insumoId y cantidad requeridos" }, { status: 400 });
        }

        const insumoIngreso = await prisma.insumo.findFirst({
          where: { id: insumoId, campoId: usuario.campoId },
        });
        if (!insumoIngreso) {
          return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
        }

        await prisma.movimientoInsumo.create({
          data: {
            tipo: "INGRESO",
            cantidad: parseFloat(cantidad),
            fecha: fecha ? new Date(fecha) : new Date(),
            notas: notas || descripcion || null,
            insumoId,
            loteId: loteId || null,
          },
        });

        await prisma.insumo.update({
          where: { id: insumoId },
          data: { stock: insumoIngreso.stock + parseFloat(cantidad) },
        });

        if (monto && parseFloat(monto) > 0) {
          await prisma.gasto.create({
            data: {
              tipo: "GASTO",
              monto: parseFloat(monto),
              fecha: fecha ? new Date(fecha) : new Date(),
              descripcion: `Compra de ${insumoIngreso.nombre}`,
              categoria: "Insumos",
              metodoPago: metodoPago || null,
              campoId: usuario.campoId,
              loteId: loteId || null,
            },
          });
        }

        console.log("Ingreso de insumo registrado");
        break;

      // SIEMBRA
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
          console.log("Cultivo creado en el lote");
        }
        break;

      // COSECHA
      case "COSECHA":
        if (loteId && tipoCultivo) {
          await prisma.cultivo.deleteMany({
            where: { loteId, tipoCultivo, lote: { campoId: usuario.campoId } },
          });
          console.log("Cultivo eliminado tras cosecha");
        }
        break;

      // NACIMIENTO
      case "NACIMIENTO":
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animalExistente) {
            await prisma.animalLote.update({
              where: { id: animalExistente.id },
              data: { cantidad: animalExistente.cantidad + parseInt(cantidad) },
            });
          } else {
            await prisma.animalLote.create({
              data: { categoria, cantidad: parseInt(cantidad), loteId },
            });
          }
          console.log("Nacimientos registrados");
        }
        break;

      // MORTANDAD
      case "MORTANDAD":
        if (loteId && cantidad && categoria) {
          const animalExistente = await prisma.animalLote.findFirst({
            where: { loteId, categoria, lote: { campoId: usuario.campoId } },
          });

          if (animalExistente) {
            const nuevaCantidad = Math.max(0, animalExistente.cantidad - parseInt(cantidad));
            if (nuevaCantidad === 0) {
              await prisma.animalLote.delete({ where: { id: animalExistente.id } });
            } else {
              await prisma.animalLote.update({
                where: { id: animalExistente.id },
                data: { cantidad: nuevaCantidad },
              });
            }
          }
          console.log("Mortandad registrada");
        }
        break;

      // INGRESO (Venta)
      case "INGRESO":
        // Guardar campos de venta con comprador y pago
        await prisma.evento.update({
          where: { id: evento.id },
          data: {
            comprador: comprador || null,
            metodoPago: metodoPago || "Contado",
            diasPlazo: metodoPago === "Plazo" ? parseInt(diasPlazo || "0") : null,
            pagado: metodoPago === "Contado" ? true : (pagado ?? false),
          },
        });
        console.log("Ingreso registrado con condición de pago");
        break;

      default:
        break;
    }

    return NextResponse.json({ success: true, evento }, { status: 201 });
  } catch (error) {
    console.error("Error creando evento:", error);
    return NextResponse.json(
      {
        error: "Error al crear el evento",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ==============================================
// GET: Listar eventos del campo del usuario
// ==============================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json([], { status: 200 });
    }

    const eventos = await prisma.evento.findMany({
      where: { campoId: usuario.campoId },
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(eventos);
  } catch (error) {
    console.error("Error al obtener eventos:", error);
    return NextResponse.json({ error: "Error al obtener eventos" }, { status: 500 });
  }
}