import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    // 🔐 Validar sesión
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener usuario y campo asociado
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      );
    }

    // Leer datos del body
    const body = await request.json();
    const { tipo, cantidad, fecha, notas, insumoId, loteId } = body;

    // 🧩 Validación básica
    if (!tipo || !cantidad || !insumoId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // 🔍 Buscar insumo dentro del campo del usuario
    const insumo = await prisma.insumo.findFirst({
      where: { id: insumoId, campoId: usuario.campoId },
    });

    if (!insumo) {
      return NextResponse.json(
        { error: "Insumo no encontrado o no pertenece a tu campo" },
        { status: 404 }
      );
    }

    const cantidadFloat = parseFloat(cantidad);
    const fechaMovimiento = fecha ? new Date(fecha) : new Date();

    // 💾 Crear movimiento
    await prisma.movimientoInsumo.create({
      data: {
        tipo,
        cantidad: cantidadFloat,
        fecha: fechaMovimiento,
        notas: notas || null,
        insumoId,
        loteId: loteId || null,
      },
    });

    // 🔁 Actualizar el stock del insumo
    const nuevoStock =
      tipo === "INGRESO"
        ? insumo.stock + cantidadFloat
        : insumo.stock - cantidadFloat;

    const insumoActualizado = await prisma.insumo.update({
      where: { id: insumoId },
      data: {
        stock: Math.max(0, nuevoStock),
        updatedAt: new Date(),
      },
      include: {
        movimientos: {
          orderBy: { fecha: "desc" },
        },
      },
    });

    console.log(
      `✅ Movimiento de insumo registrado (${tipo}): ${cantidadFloat} ${insumo.unidad}`
    );

    // 🔹 Respuesta al frontend
    return NextResponse.json(
      {
        message: "Movimiento registrado correctamente",
        insumoActualizado,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("💥 Error creando movimiento:", error);
    return NextResponse.json(
      { error: "Error creando movimiento" },
      { status: 500 }
    );
  }
}