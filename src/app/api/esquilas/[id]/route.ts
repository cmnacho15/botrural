import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// PATCH - Editar esquila
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

    const body = await req.json();
    const { fecha, nroAnimales, notas, micras, rendimientoLavado, categorias } = body;

    // Verificar que la esquila pertenezca al campo del usuario
    const esquilaExistente = await prisma.esquila.findFirst({
      where: {
        id: params.id,
        campoId: user.campoId,
      },
      include: {
        categorias: true,
      },
    });

    if (!esquilaExistente) {
      return NextResponse.json(
        { error: "Esquila no encontrada" },
        { status: 404 }
      );
    }

    // Validar que no se reduzca peso por debajo de lo vendido
    for (const catNueva of categorias) {
      const catExistente = esquilaExistente.categorias.find(
        c => c.categoria === catNueva.categoria
      );
      
      if (catExistente && catNueva.pesoKg < Number(catExistente.pesoVendido)) {
        return NextResponse.json(
          { error: `No podés reducir el peso de ${catNueva.categoria} por debajo de lo ya vendido (${catExistente.pesoVendido} kg)` },
          { status: 400 }
        );
      }
    }

    // Eliminar categorías antiguas
    await prisma.esquilaCategoria.deleteMany({
  where: { esquilaId: params.id },
});

    // Actualizar esquila con nuevas categorías
    const esquilaActualizada = await prisma.esquila.update({
      where: { id: params.id },
      data: {
        fecha: new Date(fecha),
        nroAnimales: parseInt(nroAnimales),
        notas: notas || null,
        micras: micras || null,
        rendimientoLavado: rendimientoLavado || null,
        categorias: {
          create: categorias.map((cat: any) => {
            const catAnterior = esquilaExistente.categorias.find(
              c => c.categoria === cat.categoria
            );
            
            return {
              categoria: cat.categoria,
              pesoKg: cat.pesoKg,
              precioUSD: cat.precioUSD,
              micras: cat.micras,
              rendimientoLavado: cat.rendimientoLavado,
              pesoVendido: catAnterior ? catAnterior.pesoVendido : 0,
            };
          }),
        },
      },
      include: {
        categorias: true,
      },
    });

    return NextResponse.json(esquilaActualizada);
  } catch (error) {
    console.error("Error al editar esquila:", error);
    return NextResponse.json(
      { error: "Error al editar esquila" },
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