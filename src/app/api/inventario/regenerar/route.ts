// app/api/inventario/regenerar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// ==========================================
// POST - Regenerar inventario desde potreros
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 });
    }

    // ✅ Obtener todas las categorías del campo para filtrar EQUINOS
    const categorias = await prisma.categoriaAnimal.findMany({
      where: {
        campoId: usuario.campoId,
      },
      select: {
        nombreSingular: true,
        tipoAnimal: true,
      },
    });

    // Crear Set de categorías EQUINAS para excluir
    const categoriasEquinas = new Set(
      categorias
        .filter(cat => cat.tipoAnimal === 'EQUINO')
        .map(cat => cat.nombreSingular)
    );

    // Obtener todos los potreros con sus animales
    const lotes = await prisma.lote.findMany({
      where: {
        campoId: usuario.campoId,
      },
      include: {
        animalesLote: true,
      },
    });

    // Agrupar por categoría y sumar cantidades (EXCLUYENDO EQUINOS)
    const agrupado: { [categoria: string]: number } = {};

    lotes.forEach(lote => {
      lote.animalesLote.forEach(animal => {
        // ✅ FILTRAR: Saltar si es categoría EQUINA
        if (categoriasEquinas.has(animal.categoria)) {
          return;
        }

        if (agrupado[animal.categoria]) {
          agrupado[animal.categoria] += animal.cantidad;
        } else {
          agrupado[animal.categoria] = animal.cantidad;
        }
      });
    });

    // Convertir a array
    const inventarios = Object.entries(agrupado).map(([categoria, cantidad]) => ({
      categoria,
      cantidad,
      peso: null,
      precioKg: null,
    }));

    return NextResponse.json(inventarios);
  } catch (error) {
    console.error('Error al regenerar inventario:', error);
    return NextResponse.json({ error: 'Error al regenerar inventario' }, { status: 500 });
  }
}