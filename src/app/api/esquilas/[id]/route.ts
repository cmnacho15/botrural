import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// PATCH - Actualizar precio de referencia
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verificar que la esquila pertenezca al campo del usuario
    const esquila = await prisma.esquila.findFirst({
      where: {
        id: params.id,
        campoId: user.campoId,
      },
    });

    if (!esquila) {
      return NextResponse.json(
        { error: "Esquila no encontrada" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { precioRefUSD } = body;

    if (!precioRefUSD) {
      return NextResponse.json(
        { error: "Falta el precio de referencia" },
        { status: 400 }
      );
    }

    // Actualizar precio
    const esquilaActualizada = await prisma.esquila.update({
      where: { id: params.id },
      data: { precioRefUSD },
      include: {
        categorias: true,
      },
    });

    return NextResponse.json(esquilaActualizada);
  } catch (error) {
    console.error("Error al actualizar esquila:", error);
    return NextResponse.json(
      { error: "Error al actualizar esquila" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar esquila (solo si no tiene ventas)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verificar que la esquila pertenezca al campo del usuario
    const esquila = await prisma.esquila.findFirst({
      where: {
        id: params.id,
        campoId: user.campoId,
      },
      include: {
        categorias: true,
      },
    });

    if (!esquila) {
      return NextResponse.json(
        { error: "Esquila no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que no tenga ventas asociadas
    const tieneVentas = esquila.categorias.some(
      (cat) => Number(cat.pesoVendido) > 0
    );

    if (tieneVentas) {
      return NextResponse.json(
        { error: "No se puede eliminar una esquila con ventas asociadas" },
        { status: 400 }
      );
    }

    // Eliminar esquila (las categorías se eliminan en cascada)
    await prisma.esquila.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Esquila eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar esquila:", error);
    return NextResponse.json(
      { error: "Error al eliminar esquila" },
      { status: 500 }
    );
  }
}