import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET - Obtener cultivos de un potrero específico
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // Obtener cultivos del potrero
    const cultivos = await prisma.cultivo.findMany({
      where: {
        loteId: id,
        lote: {
          campoId: usuario?.campoId,
        },
      },
      select: {
        id: true,
        tipoCultivo: true,
        hectareas: true,
        fechaSiembra: true,
      },
      orderBy: {
        fechaSiembra: 'desc',
      },
    });

    return NextResponse.json(cultivos, { status: 200 });
  } catch (error: any) {
    console.error("💥 ERROR GET /api/lotes/[id]/cultivos:", error);
    return NextResponse.json(
      { error: "Error al obtener cultivos", message: error.message },
      { status: 500 }
    );
  }
}