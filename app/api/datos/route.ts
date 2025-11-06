import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapeo de tipos a categorías e íconos
const tipoConfig: Record<string, { categoria: string; icono: string; color: string }> = {
  // Animales
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
  
  // Agricultura
  SIEMBRA: { categoria: "agricultura", icono: "🌱", color: "green" },
  PULVERIZACION: { categoria: "agricultura", icono: "💦", color: "blue" },
  REFERTILIZACION: { categoria: "agricultura", icono: "🌿", color: "lime" },
  RIEGO: { categoria: "agricultura", icono: "💧", color: "cyan" },
  MONITOREO: { categoria: "agricultura", icono: "🔍", color: "yellow" },
  COSECHA: { categoria: "agricultura", icono: "🌾", color: "amber" },
  OTROS_LABORES: { categoria: "agricultura", icono: "🔧", color: "gray" },
  
  // Clima
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

    // Obtener eventos
    const eventos = await prisma.evento.findMany({
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // Obtener gastos e ingresos
    const gastosIngresos = await prisma.gasto.findMany({
      include: {
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // Obtener movimientos de insumos
    const movimientosInsumos = await prisma.movimientoInsumo.findMany({
      include: {
        insumo: { select: { nombre: true, unidad: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    // Convertir eventos a formato unificado
    const datosEventos = eventos.map((evento) => {
      const config = tipoConfig[evento.tipo] || { categoria: "otros", icono: "📌", color: "gray" };
      return {
        id: evento.id,
        fecha: evento.fecha,
        tipo: evento.tipo,
        categoria: config.categoria,
        descripcion: evento.descripcion,
        icono: config.icono,
        color: config.color,
        usuario: evento.usuario?.name,
        lote: evento.lote?.nombre,
        detalles: {
          cantidad: evento.cantidad,
          categoria: evento.categoria,
        },
      };
    });

    // Convertir gastos/ingresos a formato unificado
    const datosGastos = gastosIngresos.map((gasto) => ({
      id: gasto.id,
      fecha: gasto.fecha,
      tipo: gasto.tipo,
      categoria: "finanzas",
      descripcion: `${gasto.tipo === "GASTO" ? "Gasto" : "Ingreso"}: ${gasto.descripcion || gasto.categoria}`,
      icono: gasto.tipo === "GASTO" ? "💸" : "💰",
      color: gasto.tipo === "GASTO" ? "red" : "green",
      lote: gasto.lote?.nombre,
      detalles: {
        monto: gasto.monto,
        categoria: gasto.categoria,
        metodoPago: gasto.metodoPago,
      },
    }));

    // Convertir movimientos de insumos a formato unificado
    const datosInsumos = movimientosInsumos.map((mov) => ({
      id: mov.id,
      fecha: mov.fecha,
      tipo: mov.tipo,
      categoria: "insumos",
      descripcion: `${mov.tipo === "INGRESO" ? "Ingreso" : "Uso"} de ${mov.insumo.nombre}: ${mov.cantidad} ${mov.insumo.unidad}`,
      icono: mov.tipo === "INGRESO" ? "📥" : "📤",
      color: mov.tipo === "INGRESO" ? "green" : "red",
      lote: mov.lote?.nombre,
      detalles: {
        insumo: mov.insumo.nombre,
        cantidad: mov.cantidad,
        unidad: mov.insumo.unidad,
        notas: mov.notas,
      },
    }));

    // Combinar todos los datos
    let todosDatos = [...datosEventos, ...datosGastos, ...datosInsumos];

    // Aplicar filtros
    if (categoria && categoria !== "todos") {
      todosDatos = todosDatos.filter((d) => d.categoria === categoria);
    }

    if (fechaDesde) {
      todosDatos = todosDatos.filter((d) => new Date(d.fecha) >= new Date(fechaDesde));
    }

    if (fechaHasta) {
      todosDatos = todosDatos.filter((d) => new Date(d.fecha) <= new Date(fechaHasta));
    }

    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase();
      todosDatos = todosDatos.filter(
        (d) =>
          d.descripcion.toLowerCase().includes(busquedaLower) ||
          d.tipo.toLowerCase().includes(busquedaLower)
      );
    }

    // Ordenar por fecha descendente
    todosDatos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return NextResponse.json(todosDatos);
  } catch (error) {
    console.error("Error al obtener datos:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}