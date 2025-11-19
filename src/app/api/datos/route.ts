// 🎯 COMENTARIO PARA QUE VERCEL LO TOME

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

// ==============================================
// 🔹 Configuración de categorías e íconos
// ==============================================
const categoriaPorTipo: Record<string, string> = {
  MOVIMIENTO: 'animales',
  CAMBIO_POTRERO: 'animales', //
  TRATAMIENTO: 'animales',
  VENTA: 'animales',
  COMPRA: 'animales',
  TRASLADO: 'animales',
  NACIMIENTO: 'animales',
  MORTANDAD: 'animales',
  CONSUMO: 'animales',
  ABORTO: 'animales',
  DESTETE: 'animales',
  TACTO: 'animales',
  RECATEGORIZACION: 'animales',
  SIEMBRA: 'agricultura',
  PULVERIZACION: 'agricultura',
  REFERTILIZACION: 'agricultura',
  RIEGO: 'agricultura',
  MONITOREO: 'agricultura',
  COSECHA: 'agricultura',
  OTROS_LABORES: 'agricultura',
  LLUVIA: 'clima',
  HELADA: 'clima',
  GASTO: 'finanzas',
  INGRESO: 'finanzas',
}

const iconoPorTipo: Record<string, string> = {
  MOVIMIENTO: '🔄',
  CAMBIO_POTRERO: '⊞',
  TRATAMIENTO: '💉',
  VENTA: '🐄',
  COMPRA: '🛒',
  TRASLADO: '🚛',
  NACIMIENTO: '🐣',
  MORTANDAD: '💀',
  CONSUMO: '🍖',
  ABORTO: '❌',
  DESTETE: '🔀',
  TACTO: '✋',
  RECATEGORIZACION: '🏷️',
  SIEMBRA: '🌱',
  PULVERIZACION: '💦',
  REFERTILIZACION: '🌿',
  RIEGO: '💧',
  MONITOREO: '🔍',
  COSECHA: '🌾',
  OTROS_LABORES: '🔧',
  LLUVIA: '🌧️',
  HELADA: '❄️',
  GASTO: '💸',
  INGRESO: '💰',
}

// ==============================================
// 🔹 GET: Unificar eventos, gastos e insumos
// ==============================================
export async function GET(request: Request) {
  try {
    console.log('🚀 GET /api/datos INICIADO')

    const session = await getServerSession(authOptions)
    console.log('👤 Sesión:', session?.user?.id)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    console.log('👤 Usuario encontrado:', usuario)

    if (!usuario?.campoId) {
      return NextResponse.json(
        { error: 'Usuario sin campo asignado' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const busqueda = searchParams.get('busqueda')

    console.log('🔍 Filtros:', { categoria, fechaDesde, fechaHasta, busqueda })

    // ==============================
    // 1️⃣ Obtener datos base
    // ==============================
    console.log('📊 Consultando eventos...')
    const eventos = await prisma.evento.findMany({
      where: {
        campoId: usuario.campoId,
      },
      include: {
        usuario: { select: { name: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: [
  { fecha: 'desc' },
  { createdAt: 'desc' },
],
    })
    console.log('✅ Eventos encontrados:', eventos.length)

    console.log('💸 Consultando gastos e ingresos...')
    const gastos = await prisma.gasto.findMany({
      where: { campoId: usuario.campoId },
      include: { lote: { select: { nombre: true } } },
      orderBy: [
  { fecha: 'desc' },
  { createdAt: 'desc' },
],
    })
    console.log('✅ Gastos/Ingresos encontrados:', gastos.length)

    console.log('📦 Consultando movimientos de insumos...')
    const movimientosInsumos = await prisma.movimientoInsumo.findMany({
      where: { insumo: { campoId: usuario.campoId } },
      include: {
        insumo: { select: { nombre: true, unidad: true } },
        lote: { select: { nombre: true } },
      },
      orderBy: [
  { fecha: 'desc' },
  { createdAt: 'desc' },
],
    })
    console.log('✅ Movimientos encontrados:', movimientosInsumos.length)

    // ==============================
    // 2️⃣ Unificar todos los datos
    // ==============================
    const datosUnificados: any[] = []

    // 🎯 EVENTOS (excepto gastos e ingresos que ya están en tabla Gasto)
eventos
  .filter((evento: any) => evento.tipo !== 'GASTO' && evento.tipo !== 'INGRESO')
  .forEach((evento) => {
    datosUnificados.push({
      id: evento.id,
      fecha: evento.fecha,
      createdAt: evento.createdAt,
      tipo: evento.tipo,
      categoria: categoriaPorTipo[evento.tipo] || 'otros',
      descripcion: evento.descripcion,
      icono: iconoPorTipo[evento.tipo] || '📌',
      usuario: evento.usuario?.name || null,
      lote: evento.lote?.nombre || null,
      // ✅ Campos directos (no en detalles)
      cantidad: evento.cantidad,
      monto: evento.monto,
      notas: evento.notas || null,  // ← AGREGAR ESTA LÍNEA
    })
  })

    // 💸 GASTOS E INGRESOS de la tabla Gasto
    gastos.forEach((gasto) => {
      const esIngreso = gasto.tipo === 'INGRESO'

      datosUnificados.push({
        id: gasto.id,
        fecha: gasto.fecha,
        createdAt: gasto.createdAt,
        tipo: gasto.tipo, // 'GASTO' o 'INGRESO'
        categoria: 'finanzas',
        descripcion: gasto.descripcion,
        icono: esIngreso ? '💰' : '💸',
        usuario: null,
        lote: gasto.lote?.nombre || null,
        // ✅ Campos directos para que los vea la página
        monto: gasto.monto ? parseFloat(gasto.monto.toString()) : null,
        cantidad: gasto.cantidadVendida,
        proveedor: gasto.proveedor,
        comprador: gasto.comprador,
        metodoPago: gasto.metodoPago,
        iva: gasto.iva ? parseFloat(gasto.iva.toString()) : null,
        diasPlazo: gasto.diasPlazo,
        pagado: gasto.pagado,
      })
    })

    // 🧪 MOVIMIENTOS DE INSUMOS
    movimientosInsumos.forEach((mov) => {
      datosUnificados.push({
        id: mov.id,
        fecha: mov.fecha,
        createdAt: mov.createdAt,
        tipo: mov.tipo === 'INGRESO' ? 'INGRESO_INSUMO' : 'USO_INSUMO',
        categoria: 'insumos',
        descripcion: `${mov.tipo === 'INGRESO' ? 'Ingreso' : 'Uso'} de ${
          mov.insumo.nombre
        }`,
        icono: mov.tipo === 'INGRESO' ? '📦' : '🧪',
        usuario: null,
        lote: mov.lote?.nombre || null,
        // ✅ Campos directos
        insumo: mov.insumo.nombre,
        cantidad: mov.cantidad,
        unidad: mov.insumo.unidad,
        notas: mov.notas,
      })
    })

    // ORDENAR
datosUnificados.sort((a, b) => {
  const fechaA = new Date(a.fecha).getTime()
  const fechaB = new Date(b.fecha).getTime()
  if (fechaB !== fechaA) return fechaB - fechaA
  const creadoA = a.createdAt ? new Date(a.createdAt).getTime() : 0
  const creadoB = b.createdAt ? new Date(b.createdAt).getTime() : 0
  return creadoB - creadoA
})

    // ==============================
    // 3️⃣ Filtros
    // ==============================
    let datosFiltrados = [...datosUnificados]

    if (categoria && categoria !== 'todos') {
      datosFiltrados = datosFiltrados.filter((d) => d.categoria === categoria)
    }

    if (fechaDesde) {
      datosFiltrados = datosFiltrados.filter(
        (d) => new Date(d.fecha) >= new Date(fechaDesde)
      )
    }

    if (fechaHasta) {
      datosFiltrados = datosFiltrados.filter(
        (d) => new Date(d.fecha) <= new Date(fechaHasta)
      )
    }

    if (busqueda) {
      const q = busqueda.toLowerCase()
      datosFiltrados = datosFiltrados.filter(
        (d) =>
          d.descripcion?.toLowerCase().includes(q) ||
          d.tipo?.toLowerCase().includes(q) ||
          d.proveedor?.toLowerCase().includes(q) ||
          d.comprador?.toLowerCase().includes(q) ||
          d.insumo?.toLowerCase().includes(q) ||
          d.lote?.toLowerCase().includes(q)
      )
    }

    console.log('✅ Total datos unificados:', datosUnificados.length)
    console.log('✅ Total datos filtrados:', datosFiltrados.length)
    console.log('📊 Ejemplo primer dato:', datosFiltrados[0])

    return NextResponse.json(datosFiltrados)
  } catch (error) {
    console.error('💥 ERROR COMPLETO en /api/datos:', error)
    console.error('Stack:', (error as Error).stack)
    return NextResponse.json(
      {
        error: 'Error al obtener datos',
        message: (error as Error).message,
      },
      { status: 500 }
    )
  }
}