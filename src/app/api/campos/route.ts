import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 🧱 POST → Crear un campo y asociarlo al usuario actual
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { nombre } = await req.json();

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido" },
        { status: 400 }
      );
    }

    // 🚜 Crear campo
    const campo = await prisma.campo.create({
      data: {
        nombre: nombre.trim(),
        usuarios: {
          connect: { id: session.user.id },
        },
      },
    });

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