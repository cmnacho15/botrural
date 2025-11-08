import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📦 GET - Obtener insumos del campo del usuario autenticado
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Buscar usuario y su campo
    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      );
    }

    // ✅ Insumos base que siempre deben existir
    const insumosBase = [
      { nombre: "Gasoil", unidad: "Litros" },
      { nombre: "Rollos", unidad: "Unidades" },
      { nombre: "Maíz", unidad: "Kilos" },
      { nombre: "Balanceado", unidad: "Kilos" },
      { nombre: "Alambre", unidad: "Metros" },
      { nombre: "Botellas", unidad: "Litros" },
    ];

    // Verificar y crear los que falten
    for (const insumo of insumosBase) {
      const existente = await prisma.insumo.findFirst({
        where: {
          campoId: usuario.campoId,
          nombre: insumo.nombre,
        },
      });

      if (!existente) {
        await prisma.insumo.create({
          data: {
            nombre: insumo.nombre,
            unidad: insumo.unidad,
            stock: 0,
            campoId: usuario.campoId,
          },
        });
      }
    }

    // ✅ Traer todos los insumos del campo con sus movimientos
    const insumos = await prisma.insumo.findMany({
      where: { campoId: usuario.campoId },
      include: {
        movimientos: {
          orderBy: { fecha: "desc" },
        },
      },
      orderBy: { nombre: "asc" },
    });

    console.log(`✅ Devolviendo ${insumos.length} insumos con movimientos`);

    return NextResponse.json(insumos);
  } catch (error) {
    console.error("💥 Error obteniendo insumos:", error);
    return NextResponse.json(
      { error: "Error obteniendo insumos" },
      { status: 500 }
    );
  }
}

// ➕ POST - Crear nuevo insumo personalizado
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene campo asignado" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, unidad, stock } = body;

    // Verificar duplicado
    const insumoExistente = await prisma.insumo.findFirst({
      where: { campoId: usuario.campoId, nombre },
    });

    if (insumoExistente) {
      return NextResponse.json(
        { error: "Ya existe un insumo con ese nombre" },
        { status: 409 }
      );
    }

    // Crear insumo nuevo
    const nuevoInsumo = await prisma.insumo.create({
      data: {
        nombre,
        unidad,
        stock: parseFloat(stock || 0),
        campoId: usuario.campoId,
      },
    });

    console.log(`✅ Nuevo insumo creado: ${nombre} (${unidad})`);

    return NextResponse.json(nuevoInsumo, { status: 201 });
  } catch (error) {
    console.error("💥 Error creando insumo:", error);
    return NextResponse.json(
      { error: "Error creando insumo" },
      { status: 500 }
    );
  }
}