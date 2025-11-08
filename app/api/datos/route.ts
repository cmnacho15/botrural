import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔹 Configuración de íconos, colores y categorías
const tipoConfig: Record<string, { categoria: string; icono: string; color: string }> = {
  // 🐄 Animales
  MOVIMIENTO: { categoria: "animales", icono: "🔄", color: "blue" },
  TRATAMIENTO: { categoria: "animales", icono: "💉", color: "red" },
  VENTA: { categoria: "animales", icono: "💰", color: "green" },
  COMPRA: { categoria: "animales", icono: "🛒", color: "purple" },
  TRASLADO: { categoria: "animales", icono: "🚛", color: "orange" },
  NACIMIENTO: { categoria: "animales", icono: "🐣", color: "yellow" },
  MORTANDAD: { categoria: "animales", icono: "💀", color: "gray" },
  CONSUMO: { categoria: "animales", icono: "🍖", color: "brown" },
  ABORTO: { categoria: "animales", icono: "❌", color: "red" },
  DESTETE: { categoria: "animales", icono: "🔀", color: "cyan" },
  TACTO: { categoria: "animales", icono: "✋", color: "pink" },
  RECATEGORIZACION: { categoria: "animales", icono: "🏷️", color: "indigo" },

  // 🌾 Agricultura
  SIEMBRA: { categoria: "agricultura", icono: "🌱", color: "green" },
  PULVERIZACION: { categoria: "agricultura", icono: "💦", color: "blue" },
  REFERTILIZACION: { categoria: "agricultura", icono: "🌿", color: "lime" },
  RIEGO: { categoria: "agricultura", icono: "💧", color: "cyan" },
  MONITOREO: { categoria: "agricultura", icono: "🔍", color: "yellow" },
  COSECHA: { categoria: "agricultura", icono: "🌾", color: "amber" },
  OTROS_LABORES: { categoria: "agricultura", icono: "🔧", color: "gray" },

  // 🌦️ Clima
  LLUVIA: { categoria: "clima", icono: "🌧️", color: "blue" },
  HELADA: { categoria: "clima", icono: "❄️", color: "cyan" },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get("categoria");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");
    const busqueda = searchParams.get("busqueda");

    // ==============================
    // 1️⃣ Obtener eventos
    // ==============================
    const eventos = await prisma.evento.findMany({
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // ==============================
    // 2️⃣ Obtener gastos e ingresos
    // ==============================
    const gastos = await prisma.gasto.findMany({
      include: {
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // ==============================
    // 3️⃣ Obtener movimientos de insumos
    // ==============================
    const movimientosInsumos = await prisma.movimientoInsumo.findMany({
      include: {
        insumo: { select: { nombre: true, unidad: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // ==============================
    // 4️⃣ Unificar todos los datos
    // ==============================
    const datosUnificados: any[] = [];

    // 🎯 Eventos
    eventos.forEach((evento) => {
      const config = tipoConfig[evento.tipo] || { categoria: "otros", icono: "📌", color: "gray" };

      datosUnificados.push({
        id: evento.id,
        fecha: evento.fecha,
        tipo: evento.tipo,
        categoria: config.categoria,
        descripcion: evento.descripcion,
        icono: config.icono,
        color: config.color,
        usuario: evento.usuario?.name || null,
        lote: evento.lote?.nombre || null,
        detalles: {
          cantidad: evento.cantidad,
          categoriaEvento: evento.categoria,
        },
      });
    });

    // 💸 Gastos
    gastos.forEach((gasto) => {
      datosUnificados.push({
        id: gasto.id,
        fecha: gasto.fecha,
        tipo: gasto.tipo,
        categoria: "finanzas",
        descripcion: `Gasto: ${gasto.descripcion || gasto.categoria}`, // ✅ Sin monto aquí
        icono: gasto.tipo === "GASTO" ? "💸" : "💰",
        color: gasto.tipo === "GASTO" ? "red" : "green",
        usuario: null,
        lote: gasto.lote?.nombre || null,
        detalles: {
          monto: gasto.monto, // ✅ Monto visible en detalles
          categoriaGasto: gasto.categoria,
          metodoPago: gasto.metodoPago,
        },
      });
    });

    // 🧪 Insumos
    movimientosInsumos.forEach((mov) => {
      datosUnificados.push({
        id: mov.id,
        fecha: mov.fecha,
        tipo: mov.tipo,
        categoria: "insumos",
        descripcion: `${mov.tipo === "INGRESO" ? "Ingreso" : "Uso"} de ${mov.insumo.nombre}: ${mov.cantidad} ${mov.insumo.unidad}`,
        icono: mov.tipo === "INGRESO" ? "📥" : "📤",
        color: mov.tipo === "INGRESO" ? "green" : "red",
        usuario: null,
        lote: mov.lote?.nombre || null,
        detalles: {
          insumo: mov.insumo.nombre,
          cantidad: mov.cantidad,
          unidad: mov.insumo.unidad,
          notas: mov.notas,
        },
      });
    });

    // ==============================
    // 5️⃣ Aplicar filtros
    // ==============================
    let datosFiltrados = [...datosUnificados];

    if (categoria && categoria !== "todos") {
      datosFiltrados = datosFiltrados.filter((d) => d.categoria === categoria);
    }

    if (fechaDesde) {
      datosFiltrados = datosFiltrados.filter((d) => new Date(d.fecha) >= new Date(fechaDesde));
    }

    if (fechaHasta) {
      datosFiltrados = datosFiltrados.filter((d) => new Date(d.fecha) <= new Date(fechaHasta));
    }

    if (busqueda) {
      const q = busqueda.toLowerCase();
      datosFiltrados = datosFiltrados.filter(
        (d) =>
          d.descripcion.toLowerCase().includes(q) ||
          (d.tipo && d.tipo.toLowerCase().includes(q))
      );
    }

    // ==============================
    // 6️⃣ Ordenar (más recientes primero)
    // ==============================
    datosFiltrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return NextResponse.json(datosFiltrados);
  } catch (error) {
    console.error("💥 Error al obtener datos:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}