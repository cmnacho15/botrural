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
  { nombre: 'Insumos de Cultivos', color: '#10b981' },  // 🆕 NUEVO
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

    const { nombre, grupoId, nuevoGrupoNombre, tipoCampo } = await req.json();

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
          tipoCampo: tipoCampo || 'MIXTO',  // 🆕 NUEVO
          grupoId: grupoIdFinal,
          usuarios: {
            connect: { id: session.user.id },
          },
        },
      });

      // 2. Crear categorías de gastos predeterminadas (según tipo de campo)
      const categoriasFiltradas = tipoCampo === 'GANADERO'
        ? CATEGORIAS_GASTOS_DEFAULT.filter(cat => cat.nombre !== 'Insumos de Cultivos')
        : CATEGORIAS_GASTOS_DEFAULT;

      await tx.categoriaGasto.createMany({
        data: categoriasFiltradas.map((cat, index) => ({
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

    const body = await req.json();
    const { nombre, tipoCampo } = body;

    // Validar nombre si se envía
    if (nombre !== undefined && (!nombre || nombre.trim().length < 2)) {
      return NextResponse.json(
        { error: "El nombre del campo es requerido (mínimo 2 caracteres)" },
        { status: 400 }
      );
    }

    // Validar tipoCampo si se envía
    if (tipoCampo !== undefined && !['GANADERO', 'MIXTO'].includes(tipoCampo)) {
      return NextResponse.json(
        { error: "Tipo de campo inválido" },
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

    // Construir objeto de actualización dinámicamente
    const dataToUpdate: any = {};
    if (nombre !== undefined) dataToUpdate.nombre = nombre.trim();
    if (tipoCampo !== undefined) {
      dataToUpdate.tipoCampo = tipoCampo;
      
      // 🆕 Si cambia a GANADERO, desactivar "Insumos de Cultivos"
      if (tipoCampo === 'GANADERO') {
        await prisma.categoriaGasto.updateMany({
          where: {
            campoId: usuario.campoId,
            nombre: 'Insumos de Cultivos'
          },
          data: { activo: false }
        });
      }
      
      // 🆕 Si cambia a MIXTO, reactivar "Insumos de Cultivos" si existe
      if (tipoCampo === 'MIXTO') {
        await prisma.categoriaGasto.updateMany({
          where: {
            campoId: usuario.campoId,
            nombre: 'Insumos de Cultivos'
          },
          data: { activo: true }
        });
      }
    }

    const campoActualizado = await prisma.campo.update({
      where: { id: usuario.campoId },
      data: dataToUpdate,
    });

    console.log(`✅ Campo actualizado:`, dataToUpdate);

    return NextResponse.json({
      success: true,
      message: "Campo actualizado correctamente ✅",
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



/**
 * DELETE - Eliminar un campo y todos sus datos
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campoId = searchParams.get("id")
    const confirmacion = searchParams.get("confirmacion")

    if (!campoId) {
      return NextResponse.json({ error: "ID del campo es requerido" }, { status: 400 })
    }

    if (confirmacion !== "ELIMINAR") {
      return NextResponse.json({ error: "Confirmación incorrecta" }, { status: 400 })
    }

    // Verificar que el usuario es ADMIN_GENERAL del campo
    const usuarioCampo = await prisma.usuarioCampo.findFirst({
      where: {
        userId: session.user.id,
        campoId: campoId,
        rol: "ADMIN_GENERAL"
      },
      include: {
        campo: {
          select: { nombre: true, grupoId: true }
        }
      }
    })

    if (!usuarioCampo) {
      return NextResponse.json({ error: "No tenés permiso para eliminar este campo" }, { status: 403 })
    }

    // Contar cuántos campos tiene el usuario
    const cantidadCampos = await prisma.usuarioCampo.count({
      where: { userId: session.user.id }
    })

    if (cantidadCampos <= 1) {
      return NextResponse.json({ 
        error: "No podés eliminar tu único campo. Primero creá otro campo." 
      }, { status: 400 })
    }

    const campoNombre = usuarioCampo.campo.nombre
    const grupoId = usuarioCampo.campo.grupoId

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Borrar traslados (origen o destino)
      await tx.traslado.deleteMany({
        where: {
          OR: [
            { campoOrigenId: campoId },
            { campoDestinoId: campoId }
          ]
        }
      })

      // 2. Borrar eventos
      await tx.evento.deleteMany({
        where: { campoId }
      })

      // 3. Borrar gastos
      await tx.gasto.deleteMany({
        where: { campoId }
      })

      // 4. Borrar ventas y sus renglones
      const ventas = await tx.venta.findMany({
        where: { campoId },
        select: { id: true }
      })
      
      if (ventas.length > 0) {
        await tx.ventaRenglon.deleteMany({
          where: { ventaId: { in: ventas.map(v => v.id) } }
        })
        await tx.venta.deleteMany({
          where: { campoId }
        })
      }

      // 5. Borrar compras y sus renglones
      const compras = await tx.compra.findMany({
        where: { campoId },
        select: { id: true }
      })
      
      if (compras.length > 0) {
        await tx.compraRenglon.deleteMany({
          where: { compraId: { in: compras.map(c => c.id) } }
        })
        await tx.compra.deleteMany({
          where: { campoId }
        })
      }

      // 6. Borrar animales de lotes
      const lotes = await tx.lote.findMany({
        where: { campoId },
        select: { id: true }
      })

      if (lotes.length > 0) {
        await tx.animalLote.deleteMany({
          where: { loteId: { in: lotes.map(l => l.id) } }
        })

        await tx.cultivo.deleteMany({
          where: { loteId: { in: lotes.map(l => l.id) } }
        })
      }

      // 7. Borrar lotes (potreros)
      await tx.lote.deleteMany({
        where: { campoId }
      })

      // 8. Borrar módulos de pastoreo
      await tx.moduloPastoreo.deleteMany({
        where: { campoId }
      })

      // 9. Borrar rodeos
      await tx.rodeo.deleteMany({
        where: { campoId }
      })

      // 10. Borrar insumos
      await tx.insumo.deleteMany({
        where: { campoId }
      })

      // 11. Borrar firmas
      await tx.firma.deleteMany({
        where: { campoId }
      })

      // 12. Borrar categorías de gasto
      await tx.categoriaGasto.deleteMany({
        where: { campoId }
      })

      // 13. Borrar categorías de animal
      await tx.categoriaAnimal.deleteMany({
        where: { campoId }
      })

      // 14. Borrar invitaciones
      await tx.invitation.deleteMany({
        where: { campoId }
      })

      // 15. Borrar UsuarioCampo (todos los usuarios del campo)
      await tx.usuarioCampo.deleteMany({
        where: { campoId }
      })

      // 16. Borrar el campo
      await tx.campo.delete({
        where: { id: campoId }
      })

      // 17. Si el grupo quedó sin campos, borrarlo
      if (grupoId) {
        const camposRestantes = await tx.campo.count({
          where: { grupoId }
        })

        if (camposRestantes === 0) {
          await tx.usuarioGrupo.deleteMany({
            where: { grupoId }
          })
          await tx.grupo.delete({
            where: { id: grupoId }
          })
          console.log(`🗑️ Grupo eliminado (quedó sin campos)`)
        }
      }

      // 18. Actualizar el usuario para que apunte a otro campo
      const otroCampo = await tx.usuarioCampo.findFirst({
        where: { userId: session.user.id },
        include: { campo: true }
      })

      if (otroCampo) {
        await tx.usuarioCampo.updateMany({
          where: { userId: session.user.id },
          data: { esActivo: false }
        })

        await tx.usuarioCampo.update({
          where: { id: otroCampo.id },
          data: { esActivo: true }
        })

        await tx.user.update({
          where: { id: session.user.id },
          data: { campoId: otroCampo.campoId }
        })
      }
    })

    console.log(`🗑️ Campo eliminado: ${campoNombre} por usuario ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: "Campo eliminado correctamente"
    })

  } catch (error) {
    console.error("Error eliminando campo:", error)
    return NextResponse.json({ error: "Error interno al eliminar campo" }, { status: 500 })
  }
}