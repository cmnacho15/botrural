//src/app/api/lotes/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📋 GET - Obtener lotes del campo del usuario autenticado (o de otro campo si se pasa campoId)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campoIdParam = searchParams.get('campoId')

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    // Si se pasa campoId, verificar que el usuario tiene acceso a ese campo
    let campoIdAUsar = usuario.campoId

    if (campoIdParam && campoIdParam !== usuario.campoId) {
      const tieneAcceso = await prisma.usuarioCampo.findFirst({
        where: {
          userId: usuario.id,
          campoId: campoIdParam
        }
      })

      if (!tieneAcceso) {
        return NextResponse.json({ error: 'No tenés acceso a ese campo' }, { status: 403 })
      }

      campoIdAUsar = campoIdParam
    }

    const lotes = await prisma.lote.findMany({
  where: { campoId: campoIdAUsar },
  include: {
    cultivos: true,
    animalesLote: true,
    moduloPastoreo: true,  // ✅ ESTE NOMBRE
  },
  orderBy: { nombre: 'asc' },
})

    // Calcular días de pastoreo/descanso
const lotesConDias = lotes.map((lote: any) => {
  const tieneAnimales = lote.animalesLote && lote.animalesLote.length > 0
  const diasDesdeUltimoCambio = lote.ultimoCambio 
    ? Math.floor((Date.now() - new Date(lote.ultimoCambio).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return {
    ...lote,
    diasPastoreo: tieneAnimales ? diasDesdeUltimoCambio : 0,
    diasDescanso: !tieneAnimales ? diasDesdeUltimoCambio : 0,
  }
})

return NextResponse.json(lotesConDias)
  } catch (error) {
    console.error('Error al obtener lotes:', error)
    return NextResponse.json({ error: 'Error al obtener lotes' }, { status: 500 })
  }
}

// 🧩 POST - Crear nuevo lote asociado al campo del usuario autenticado
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: "El usuario no tiene un campo asignado" },
        { status: 400 }
      );
    }

    const body = await request.json();
const { nombre, hectareas, poligono, cultivos = [], animales = [], moduloPastoreoId, esPastoreable, diasPastoreoAjuste, diasDescansoAjuste } = body;

    if (!nombre || !hectareas) {
      return NextResponse.json(
        { error: "Nombre y hectáreas son requeridos" },
        { status: 400 }
      );
    }

    if (!Array.isArray(poligono) || poligono.length < 3) {
      return NextResponse.json(
        { error: "El polígono debe tener al menos 3 puntos" },
        { status: 400 }
      );
    }

    
    // ✨ Crear el lote con cultivos y animales relacionados
    const lote = await prisma.lote.create({
      data: {
        nombre,
        hectareas: parseFloat(hectareas),
        poligono,
        esPastoreable: esPastoreable ?? true,  // 🆕 NUEVO
        campoId: usuario.campoId,
        ultimoCambio: (() => {
      const tieneAnimales = animales && animales.length > 0
      if (diasPastoreoAjuste && tieneAnimales) {
        return new Date(Date.now() - (diasPastoreoAjuste * 24 * 60 * 60 * 1000))
      }
      if (diasDescansoAjuste && !tieneAnimales) {
        return new Date(Date.now() - (diasDescansoAjuste * 24 * 60 * 60 * 1000))
      }
      return new Date()
    })(),
        moduloPastoreoId: moduloPastoreoId || null,

        cultivos: {
          create: cultivos
            .filter((c: any) => c.tipoCultivo) // Solo cultivos con tipo
            .map((c: any) => {
              const haCultivo = parseFloat(c.hectareas)
              return {
                tipoCultivo: c.tipoCultivo,
                fechaSiembra: c.fechaSiembra && c.fechaSiembra.length > 0 ? new Date(c.fechaSiembra) : new Date(),
                hectareas: !isNaN(haCultivo) && haCultivo > 0 ? haCultivo : parseFloat(hectareas),
              }
            }),
        },

        animalesLote: {
          create: animales
            .filter((a: any) => a.categoria && a.cantidad)
            .map((a: any) => ({
              categoria: a.categoria,
              cantidad: parseInt(a.cantidad),
              peso: a.peso ? parseFloat(a.peso) : null,
              fechaIngreso: new Date(),
            })),
        },
      },
      include: {
        cultivos: true,
        animalesLote: true,
      },
    });

    // 🔥 NUEVO: Crear eventos en la tabla Evento
    
    // 1️⃣ Crear eventos de SIEMBRA por cada cultivo
    for (const cultivo of cultivos) {
      if (cultivo.tipoCultivo) {
        const fechaSiembra = cultivo.fechaSiembra && cultivo.fechaSiembra.length > 0
          ? new Date(cultivo.fechaSiembra)
          : new Date()
        const haParsed = parseFloat(cultivo.hectareas)
        const hectareasCultivo = !isNaN(haParsed) && haParsed > 0 ? haParsed : parseFloat(hectareas)

        await prisma.evento.create({
          data: {
            tipo: 'SIEMBRA',
            fecha: fechaSiembra,
            descripcion: `Se sembraron ${hectareasCultivo.toFixed(1)} hectáreas de ${cultivo.tipoCultivo} en el lote "${nombre}".`,
            campoId: usuario.campoId,
            loteId: lote.id,
            usuarioId: session.user.id,
            cantidad: hectareasCultivo,
          },
        });
      }
    }

    
// 2️⃣ Crear eventos de INGRESO de animales
for (const animal of animales) {
  if (animal.categoria && animal.cantidad) {
    // ✅ Construir descripción con peso
    let descripcion = `Se ingresaron ${animal.cantidad} ${animal.categoria.toLowerCase()}`;
    
    // Agregar peso si existe
    if (animal.peso) {
      descripcion += ` (${animal.peso} kg promedio)`;
    }
    
    descripcion += ` al lote "${nombre}".`;

    // ✅ Usar fecha ajustada si hay días de pastoreo configurados
    const fechaEvento = diasPastoreoAjuste 
      ? new Date(Date.now() - (diasPastoreoAjuste * 24 * 60 * 60 * 1000))
      : new Date();

    await prisma.evento.create({
      data: {
        tipo: 'AJUSTE',
        fecha: fechaEvento,
        descripcion,
        campoId: usuario.campoId,
        loteId: lote.id,
        usuarioId: session.user.id,
        cantidad: parseInt(animal.cantidad),
        categoria: animal.categoria,
      },
    });
  }
}

    console.log(
      `✅ Lote creado: ${nombre} con ${cultivos.length} cultivos y ${animales.length} animales + eventos generados`
    );
    return NextResponse.json(lote, { status: 201 });
  } catch (error) {
    console.error("💥 Error creando lote:", error);
    return NextResponse.json(
      { error: "Error creando el lote" },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE - Eliminar lote por ID
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const loteId = searchParams.get("id");

    if (!loteId) {
      return NextResponse.json(
        { error: "ID del lote es requerido" },
        { status: 400 }
      );
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
    });

    if (!lote || lote.campoId !== usuario?.campoId) {
      return NextResponse.json(
        { error: "Lote no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    await prisma.lote.delete({ where: { id: loteId } });

    console.log(`🗑️ Lote eliminado: ${lote.nombre}`);
    return NextResponse.json(
      { message: "Lote eliminado correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("💥 Error eliminando lote:", error);
    return NextResponse.json(
      { error: "Error eliminando el lote" },
      { status: 500 }
    );
  }
} 

//holaaa