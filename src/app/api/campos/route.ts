import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { CATEGORIAS_ANIMALES_DEFAULT } from "@/lib/constants";

const CATEGORIAS_GASTOS_DEFAULT = [
  { nombre: 'Alimentación', color: '#ef4444' },
  { nombre: 'Otros', color: '#6b7280' },
  { nombre: 'Administración', color: '#3b82f6' },
  { nombre: 'Renta', color: '#8b5cf6' },
  { nombre: 'Asesoramiento', color: '#06b6d4' },
  { nombre: 'Combustible', color: '#f97316' },
  { nombre: 'Compras de Hacienda', color: '#84cc16' },
  { nombre: 'Estructuras', color: '#64748b' },
  { nombre: 'Fertilizantes', color: '#22c55e' },
  { nombre: 'Fitosanitarios', color: '#14b8a6' },
  { nombre: 'Gastos Comerciales', color: '#a855f7' },
  { nombre: 'Impuestos', color: '#ec4899' },
  { nombre: 'Insumos Agrícolas', color: '#eab308' },
  { nombre: 'Labores', color: '#f59e0b' },
  { nombre: 'Maquinaria', color: '#78716c' },
  { nombre: 'Sanidad', color: '#dc2626' },
  { nombre: 'Seguros', color: '#0ea5e9' },
  { nombre: 'Semillas', color: '#65a30d' },
  { nombre: 'Sueldos', color: '#7c3aed' },
];

// 🧱 POST → Crear un campo y asociarlo al usuario actual
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { nombre, grupoId, nuevoGrupoNombre } = await req.json();

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido" },
        { status: 400 }
      );
    }

    // Determinar el grupo a usar
    let grupoIdFinal = grupoId;

    // Si se pasa nuevoGrupoNombre, crear grupo nuevo
    if (nuevoGrupoNombre && nuevoGrupoNombre.trim().length >= 2) {
      const nuevoGrupo = await prisma.grupo.create({
        data: { nombre: nuevoGrupoNombre.trim() }
      });

      // Crear relación UsuarioGrupo
      await prisma.usuarioGrupo.create({
        data: {
          userId: session.user.id,
          grupoId: nuevoGrupo.id,
          rol: 'ADMIN_GENERAL',
          esActivo: false
        }
      });

      grupoIdFinal = nuevoGrupo.id;
      console.log(`✅ Nuevo grupo creado: ${nuevoGrupo.nombre}`);
    }

    // Si no se especificó grupo, usar el grupo activo del usuario
    if (!grupoIdFinal) {
      const grupoActivo = await prisma.usuarioGrupo.findFirst({
        where: { userId: session.user.id, esActivo: true }
      });
      grupoIdFinal = grupoActivo?.grupoId || null;
    }

    // 🚜 Crear campo con categorías predeterminadas
    const campo = await prisma.$transaction(async (tx) => {
      // 1. Crear campo
      const nuevoCampo = await tx.campo.create({
        data: {
          nombre: nombre.trim(),
          grupoId: grupoIdFinal,
          usuarios: {
            connect: { id: session.user.id },
          },
        },
      });

      // 2. Crear categorías de gastos predeterminadas
      await tx.categoriaGasto.createMany({
        data: CATEGORIAS_GASTOS_DEFAULT.map((cat, index) => ({
          nombre: cat.nombre,
          color: cat.color,
          campoId: nuevoCampo.id,
          orden: index,
          activo: true,
        })),
        skipDuplicates: true,
      });

      // 3. Crear categorías de animales predeterminadas
      await tx.categoriaAnimal.createMany({
        data: CATEGORIAS_ANIMALES_DEFAULT.map(cat => ({
          nombreSingular: cat.nombreSingular,
          nombrePlural: cat.nombrePlural,
          tipoAnimal: cat.tipoAnimal,
          campoId: nuevoCampo.id,
          activo: true,
          esPredeterminado: true,
        })),
        skipDuplicates: true,
      });

      return nuevoCampo;
    });

    console.log(`✅ Campo creado: ${campo.nombre} con categorías predeterminadas`);

    // 🆕 Desactivar otros campos del usuario
    await prisma.usuarioCampo.updateMany({
      where: { userId: session.user.id },
      data: { esActivo: false },
    });

    // 🆕 Crear relación en UsuarioCampo
    await prisma.usuarioCampo.create({
      data: {
        userId: session.user.id,
        campoId: campo.id,
        rol: "ADMIN_GENERAL",
        esActivo: true,
      },
    });

    // 👑 Actualizar campoId del usuario al nuevo campo
    await prisma.user.update({
      where: { id: session.user.id },
      data: { campoId: campo.id, role: "ADMIN_GENERAL" },
    });

    console.log(`✅ Campo creado: ${campo.nombre} (asociado a ${session.user.email})`);

    return NextResponse.json({
      success: true,
      message: "Campo creado correctamente ✅",
      campo,
    });
  } catch (error) {
    console.error("💥 Error creando campo:", error);
    return NextResponse.json(
      { error: "Error interno al crear campo", details: String(error) },
      { status: 500 }
    );
  }
}

// 📋 GET → Obtener campos del usuario autenticado
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 🆕 Obtener todos los campos del usuario via UsuarioCampo
    const usuarioCampos = await prisma.usuarioCampo.findMany({
      where: { userId: session.user.id },
      include: {
        campo: {
          include: {
            lotes: true,
            grupo: { select: { id: true, nombre: true } },
            _count: {
              select: { usuarios: true }
            }
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Formatear respuesta
    const campos = usuarioCampos.map(uc => ({
      id: uc.campo.id,
      nombre: uc.campo.nombre,
      rol: uc.rol,
      esActivo: uc.esActivo,
      cantidadPotreros: uc.campo.lotes.length,
      cantidadUsuarios: uc.campo._count.usuarios,
      grupoId: uc.campo.grupoId,
      createdAt: uc.campo.createdAt,
    }));

    // Si no hay campos en UsuarioCampo pero sí en User.campoId (migración pendiente)
    if (campos.length === 0) {
      const usuario = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          campo: {
            include: {
              lotes: true,
            },
          },
        },
      });

      if (usuario?.campo) {
        return NextResponse.json([{
          id: usuario.campo.id,
          nombre: usuario.campo.nombre,
          rol: usuario.role,
          esActivo: true,
          cantidadPotreros: usuario.campo.lotes.length,
          cantidadUsuarios: 1,
          createdAt: usuario.campo.createdAt,
        }]);
      }
    }

    return NextResponse.json(campos);
  } catch (error) {
    console.error("💥 Error obteniendo campos:", error);
    return NextResponse.json(
      { error: "Error interno al obtener campos", details: String(error) },
      { status: 500 }
    );
  }
}

// 📝 PATCH → Actualizar nombre del campo
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { nombre } = await req.json();

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido (mínimo 2 caracteres)" },
        { status: 400 }
      );
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene un campo asociado" },
        { status: 404 }
      );
    }

    const campoActualizado = await prisma.campo.update({
      where: { id: usuario.campoId },
      data: { nombre: nombre.trim() },
    });

    console.log(`✅ Campo actualizado: ${campoActualizado.nombre}`);

    return NextResponse.json({
      success: true,
      message: "Nombre del campo actualizado correctamente ✅",
      campo: campoActualizado,
    });
  } catch (error) {
    console.error("💥 Error actualizando campo:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar campo", details: String(error) },
      { status: 500 }
    );
  }
}