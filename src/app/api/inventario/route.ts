// app/api/inventario/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// ==========================================
// GET - Obtener inventario por fecha
// ==========================================
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');

    if (!fecha) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });
    }

    const inventarios = await prisma.inventario.findMany({
      where: {
        campoId: usuario.campoId,
        fecha: new Date(fecha),
      },
      orderBy: { categoria: 'asc' },
    });

    return NextResponse.json(inventarios);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 });
  }
}

// ==========================================
// POST - Guardar inventario completo
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

    const body = await req.json();
    const { fecha, inventarios } = body;

    if (!fecha || !inventarios || !Array.isArray(inventarios)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Borrar inventario existente de esa fecha
    await prisma.inventario.deleteMany({
      where: {
        campoId: usuario.campoId,
        fecha: new Date(fecha),
      },
    });

   // Crear nuevos registros (incluye precioKgFin)
    const created = await prisma.inventario.createMany({
      data: inventarios.map((inv: any) => ({
        campoId: usuario.campoId,
        fecha: new Date(fecha),
        categoria: inv.categoria,
        cantidad: inv.cantidad,
        pesoInicio: inv.pesoInicio || null,  // 🆕 CAMBIO
        pesoFin: inv.pesoFin || null,        // 🆕 CAMBIO
        precioKg: inv.precioKg || null,
        precioKgFin: inv.precioKgFin || null,
      })),
    });

    return NextResponse.json({ 
      success: true, 
      count: created.count 
    });
  } catch (error) {
    console.error('Error al guardar inventario:', error);
    return NextResponse.json({ error: 'Error al guardar inventario' }, { status: 500 });
  }
}

// ==========================================
// DELETE - Eliminar una fila del inventario
// ==========================================
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await prisma.inventario.delete({
      where: {
        id,
        campoId: usuario.campoId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar item:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}