import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 🔄 POST → Cambiar el campo activo del usuario
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { campoId } = await req.json();

    if (!campoId) {
      return NextResponse.json(
        { error: "campoId es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene acceso a ese campo
    const usuarioCampo = await prisma.usuarioCampo.findFirst({
      where: {
        userId: session.user.id,
        campoId: campoId,
      },
      include: {
        campo: true,
      },
    });

    if (!usuarioCampo) {
      return NextResponse.json(
        { error: "No tenés acceso a ese campo" },
        { status: 403 }
      );
    }

    // Obtener el grupoId del campo
    const campo = await prisma.campo.findUnique({
      where: { id: campoId },
      select: { grupoId: true }
    });

    // Transacción para cambiar campo activo y grupo activo
    await prisma.$transaction(async (tx) => {
      // Desactivar todos los campos del usuario
      await tx.usuarioCampo.updateMany({
        where: { userId: session.user.id },
        data: { esActivo: false },
      });

      // Activar el campo seleccionado
      await tx.usuarioCampo.updateMany({
        where: {
          userId: session.user.id,
          campoId: campoId,
        },
        data: { esActivo: true },
      });

      // Actualizar grupo activo basado en el grupo del campo
      if (campo?.grupoId) {
        await tx.usuarioGrupo.updateMany({
          where: { userId: session.user.id },
          data: { esActivo: false }
        });

        await tx.usuarioGrupo.updateMany({
          where: {
            userId: session.user.id,
            grupoId: campo.grupoId
          },
          data: { esActivo: true }
        });
      }

      // Actualizar User.campoId y role (preservando MEGA_ADMIN)
      const usuarioActual = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      });

      // MEGA_ADMIN es global, no se debe sobrescribir al cambiar de campo
      const nuevoRol = usuarioActual?.role === 'MEGA_ADMIN' ? 'MEGA_ADMIN' : usuarioCampo.rol;

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          campoId: campoId,
          role: nuevoRol,
        },
      });
    });

    console.log(`✅ Campo activo cambiado a: ${usuarioCampo.campo.nombre} para ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: `Campo cambiado a "${usuarioCampo.campo.nombre}" ✅`,
      campo: {
        id: usuarioCampo.campo.id,
        nombre: usuarioCampo.campo.nombre,
        rol: usuarioCampo.rol,
      },
    });
  } catch (error) {
    console.error("💥 Error cambiando campo activo:", error);
    return NextResponse.json(
      { error: "Error interno al cambiar campo", details: String(error) },
      { status: 500 }
    );
  }
}