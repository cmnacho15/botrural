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

    // Desactivar todos los campos del usuario
    await prisma.usuarioCampo.updateMany({
      where: { userId: session.user.id },
      data: { esActivo: false },
    });

    // Activar el campo seleccionado
    await prisma.usuarioCampo.updateMany({
      where: {
        userId: session.user.id,
        campoId: campoId,
      },
      data: { esActivo: true },
    });

    // Actualizar User.campoId para compatibilidad
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        campoId: campoId,
        role: usuarioCampo.rol, // Actualizar rol según el campo
      },
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