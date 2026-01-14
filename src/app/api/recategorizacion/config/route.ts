import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 });
    }

    // Buscar o crear config
    let config = await prisma.configRecategorizacion.findUnique({
      where: { campoId: user.campoId },
    });

    if (!config) {
      config = await prisma.configRecategorizacion.create({
        data: {
          campoId: user.campoId,
          bovinosActivo: false,
          ovinosActivo: false,
          bovinosDia: 1,
          bovinosMes: 1,
          ovinosDia: 1,
          ovinosMes: 1,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error al obtener config:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
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
      return NextResponse.json({ error: "Usuario sin campo" }, { status: 400 });
    }

    const { 
      bovinosActivo, 
      ovinosActivo, 
      bovinosDia, 
      bovinosMes, 
      ovinosDia, 
      ovinosMes 
    } = await req.json();

    const config = await prisma.configRecategorizacion.upsert({
      where: { campoId: user.campoId },
      update: {
        bovinosActivo,
        ovinosActivo,
        bovinosDia,
        bovinosMes,
        ovinosDia,
        ovinosMes,
      },
      create: {
        campoId: user.campoId,
        bovinosActivo,
        ovinosActivo,
        bovinosDia,
        bovinosMes,
        ovinosDia,
        ovinosMes,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error al actualizar config:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}