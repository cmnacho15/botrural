import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// GET - Listar esquilas del campo actual
export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: "No hay campo activo" }, { status: 400 });
    }

    const esquilas = await prisma.esquila.findMany({
      where: { campoId: user.campoId },
      include: {
        categorias: true,
      },
      orderBy: { fecha: 'desc' },
    });

    // Calcular disponible para cada esquila
    const esquilasConDisponible = esquilas.map(esquila => {
      const totalKg = esquila.categorias.reduce((sum, cat) => sum + Number(cat.pesoKg), 0);
      const totalVendido = esquila.categorias.reduce((sum, cat) => sum + Number(cat.pesoVendido), 0);
      const disponible = totalKg - totalVendido;
      const porcentajeDisponible = totalKg > 0 ? (disponible / totalKg) * 100 : 0;

      return {
        ...esquila,
        totalKg,
        totalVendido,
        disponible,
        porcentajeDisponible,
      };
    });

    return NextResponse.json(esquilasConDisponible);
  } catch (error) {
    console.error("Error al obtener esquilas:", error);
    return NextResponse.json(
      { error: "Error al obtener esquilas" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva esquila
export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: "No hay campo activo" }, { status: 400 });
    }

    const body = await req.json();
    const { fecha, nroAnimales, precioRefUSD, notas, categorias } = body;

    // Validaciones
    if (!fecha || !nroAnimales || !precioRefUSD || !categorias || categorias.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    // Crear esquila con categorías
    const esquila = await prisma.esquila.create({
      data: {
        fecha: new Date(fecha),
        nroAnimales: parseInt(nroAnimales),
        precioRefUSD,
        notas: notas || null,
        campoId: user.campoId,
        categorias: {
          create: categorias.map((cat: any) => ({
            categoria: cat.categoria,
            pesoKg: cat.pesoKg,
            pesoVendido: 0,
          })),
        },
      },
      include: {
        categorias: true,
      },
    });

    return NextResponse.json(esquila, { status: 201 });
  } catch (error) {
    console.error("Error al crear esquila:", error);
    return NextResponse.json(
      { error: "Error al crear esquila" },
      { status: 500 }
    );
  }
}