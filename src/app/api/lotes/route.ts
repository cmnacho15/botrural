//src/app/api/lotes/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// 📋 GET - Obtener lotes del campo del usuario autenticado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo' }, { status: 400 })
    }

    const lotes = await prisma.lote.findMany({
      where: { campoId: usuario.campoId },
      include: {
        cultivos: true,
        animalesLote: true,
      },
      orderBy: { nombre: 'asc' },
    })

    // Calcular días de pastoreo/descanso
const lotesConDias = lotes.map((lote: any) => {
  const tieneAnimales = lote.animalesLote && lote.animalesLote.length > 0
  
  // 🔥 CALCULAR FECHA BASE (teniendo en cuenta el ajuste)
  let fechaBase = lote.ultimoCambio ? new Date(lote.ultimoCambio) : new Date()
  
  // 🔍 DEBUG: Ver valores iniciales
  console.log(`\n🔍 LOTE: ${lote.nombre}`);
  console.log(`   - ultimoCambio: ${lote.ultimoCambio}`);
  console.log(`   - fechaBase INICIAL: ${fechaBase}`);
  console.log(`   - tieneAnimales: ${tieneAnimales}`);
  console.log(`   - diasPastoreoAjuste: ${lote.diasPastoreoAjuste}`);
  console.log(`   - diasDescansoAjuste: ${lote.diasDescansoAjuste}`);
  
  // Si hay ajuste, restar esos días a la fecha base
  if (tieneAnimales && lote.diasPastoreoAjuste) {
    fechaBase = new Date(fechaBase.getTime() - (lote.diasPastoreoAjuste * 24 * 60 * 60 * 1000))
    console.log(`   ✅ AJUSTE PASTOREO aplicado: ${lote.diasPastoreoAjuste} días`);
    console.log(`   - fechaBase AJUSTADA: ${fechaBase}`);
  } else if (!tieneAnimales && lote.diasDescansoAjuste) {
    fechaBase = new Date(fechaBase.getTime() - (lote.diasDescansoAjuste * 24 * 60 * 60 * 1000))
    console.log(`   ✅ AJUSTE DESCANSO aplicado: ${lote.diasDescansoAjuste} días`);
    console.log(`   - fechaBase AJUSTADA: ${fechaBase}`);
  }
  
  const diasDesdeUltimoCambio = Math.floor((Date.now() - fechaBase.getTime()) / (1000 * 60 * 60 * 24))
  
  console.log(`   - diasDesdeUltimoCambio FINAL: ${diasDesdeUltimoCambio}`);

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
    const { nombre, hectareas, poligono, cultivos = [], animales = [], moduloPastoreoId, esPastoreable } = body;  // 🆕 AGREGAR esPastoreable

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
        ultimoCambio: new Date(), // 🔥 AGREGADO: registrar fecha de creación
        moduloPastoreoId: moduloPastoreoId || null,

        cultivos: {
          create: cultivos.map((c: any) => ({
            tipoCultivo: c.tipoCultivo,
            fechaSiembra: new Date(c.fechaSiembra),
            hectareas: parseFloat(c.hectareas),
          })),
        },

        animalesLote: {
          create: animales.map((a: any) => ({
            categoria: a.categoria,
            cantidad: parseInt(a.cantidad),
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
        await prisma.evento.create({
          data: {
            tipo: 'SIEMBRA',
            fecha: new Date(cultivo.fechaSiembra),
            descripcion: `Se sembraron ${parseFloat(cultivo.hectareas).toFixed(1)} hectáreas de ${cultivo.tipoCultivo} en el lote "${nombre}".`,
            campoId: usuario.campoId,
            loteId: lote.id,
            usuarioId: session.user.id,
            cantidad: parseFloat(cultivo.hectareas),
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

    await prisma.evento.create({
      data: {
        tipo: 'AJUSTE',
        fecha: new Date(),
        descripcion,
        campoId: usuario.campoId,
        loteId: lote.id,
        usuarioId: session.user.id,
        cantidad: parseInt(animal.cantidad),
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