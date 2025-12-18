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
    
    // 🔬 DEBUG 1
    console.log('🐴 CATEGORÍAS EQUINAS (se filtrarán):', Array.from(categoriasEquinas));

    // Obtener todos los potreros con sus animales
    const lotes = await prisma.lote.findMany({
      where: {
        campoId: usuario.campoId,
      },
      include: {
        animalesLote: true,
      },
    });

     // 🔬 DEBUG 2
    console.log('🐑 ANIMALES EN POTREROS:', 
      lotes.flatMap(l => l.animalesLote.map(a => ({
        categoria: a.categoria,
        cantidad: a.cantidad,
        lote: l.nombre
      })))
    );

    // Agrupar por categoría y sumar cantidades (EXCLUYENDO EQUINOS)
const agrupado: { [categoria: string]: number } = {};

// 🔬 DEBUG 1: Ver qué categorías se van a filtrar
console.log('🐴 CATEGORÍAS EQUINAS (se filtrarán):', Array.from(categoriasEquinas));

// 🔬 DEBUG 2: Ver todos los animales antes de filtrar
console.log('🐑 ANIMALES EN POTREROS:', 
  lotes.flatMap(l => l.animalesLote.map(a => ({
    categoria: a.categoria,
    cantidad: a.cantidad,
    lote: l.nombre
  })))
);

lotes.forEach(lote => {
  lote.animalesLote.forEach(animal => {
    const esEquino = categoriasEquinas.has(animal.categoria);
    
    // 🔬 DEBUG 3: Ver cada decisión de filtrado
    console.log(`🔍 Procesando: "${animal.categoria}" | ¿Es equino?: ${esEquino} | Cantidad: ${animal.cantidad}`);
    
    if (esEquino) {
      console.log(`   ⛔ FILTRADO: ${animal.categoria}`);
      return;
    }

    console.log(`   ✅ INCLUIDO: ${animal.categoria}`);

    if (agrupado[animal.categoria]) {
      agrupado[animal.categoria] += animal.cantidad;
    } else {
      agrupado[animal.categoria] = animal.cantidad;
    }
  });
});

// 🔬 DEBUG 4: Ver resultado final
console.log('📦 INVENTARIO FINAL AGRUPADO:', agrupado);

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