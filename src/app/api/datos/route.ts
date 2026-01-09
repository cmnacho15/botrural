//src/app/api/datos/route.ts


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
  DAO: 'animales',  // ← AGREGAR ESTA LÍNEA
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
  TRASLADO_EGRESO: '📤',
  TRASLADO_INGRESO: '📥',
  NACIMIENTO: '➕',
  MORTANDAD: '➖',
  CONSUMO: '🍖',
  ABORTO: '❌',
  DESTETE: '🔀',
  TACTO: '✋',
  RECATEGORIZACION: '🏷️',
  DAO: '🔬',  // ← AGREGAR ESTA LÍNEA
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
    lote: { 
      select: { 
        nombre: true,
        moduloPastoreo: {  // 👈 AGREGAR ESTO
          select: { nombre: true }
        }
      } 
    },
    rodeo: { select: { nombre: true } }, 
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

    console.log('🚚 Consultando traslados...')
    const traslados = await prisma.traslado.findMany({
      where: {
        OR: [
          { campoOrigenId: usuario.campoId },
          { campoDestinoId: usuario.campoId }
        ]
      },
      include: {
        campoOrigen: { select: { nombre: true } },
        campoDestino: { select: { nombre: true } },
        potreroOrigen: { select: { nombre: true } },
        potreroDestino: { select: { nombre: true } },
      },
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    console.log('✅ Traslados encontrados:', traslados.length)

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
      categoriaAnimal: evento.categoria,  // ✅ AGREGAR ESTA LÍNEA
      descripcion: evento.descripcion,
      icono: iconoPorTipo[evento.tipo] || '📌',
      usuario: evento.usuario?.name || null,
      lote: evento.lote?.nombre || null,
      rodeo: evento.rodeo?.nombre || null,
      // ✅ Campos directos (no en detalles)
      cantidad: evento.cantidad,
      monto: evento.monto,
      caravana: evento.caravana || null,
      notas: evento.notas && typeof evento.notas === 'string' && evento.notas.trim() !== '' ? evento.notas : null,
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
        moneda: gasto.moneda || 'UYU', // 👈 AGREGAR ESTA LÍNEA
        cantidad: gasto.cantidadVendida,
        proveedor: gasto.proveedor,
        comprador: gasto.comprador,
        metodoPago: gasto.metodoPago,
        iva: gasto.iva ? parseFloat(gasto.iva.toString()) : null,
        diasPlazo: gasto.diasPlazo,
        pagado: gasto.pagado,
      })
    })

    // 🚚 TRASLADOS ENTRE CAMPOS
    traslados.forEach((traslado) => {
      const esEgreso = traslado.campoOrigenId === usuario.campoId
      const tipo = esEgreso ? 'TRASLADO_EGRESO' : 'TRASLADO_INGRESO'
      
      // Construir descripción más completa
      let descripcion = ''
      if (esEgreso) {
        descripcion = `Egreso de ${traslado.cantidad} ${traslado.categoria} desde potrero ${traslado.potreroOrigen.nombre} hacia ${traslado.campoDestino.nombre} (${traslado.potreroDestino.nombre})`
      } else {
        descripcion = `Ingreso de ${traslado.cantidad} ${traslado.categoria} en potrero ${traslado.potreroDestino.nombre} desde ${traslado.campoOrigen.nombre} (${traslado.potreroOrigen.nombre})`
      }
      
      // Agregar info de peso y valor si existe
      if (traslado.pesoPromedio && traslado.precioKgUSD) {
        const totalUSD = traslado.cantidad * traslado.pesoPromedio * traslado.precioKgUSD
        descripcion += ` — ${traslado.pesoPromedio}kg/cab a USD ${traslado.precioKgUSD}/kg = USD ${totalUSD.toLocaleString('es-UY', { minimumFractionDigits: 0 })}`
      } else if (traslado.pesoPromedio) {
        descripcion += ` — ${traslado.pesoPromedio}kg/cab`
      }

      datosUnificados.push({
        id: traslado.id,
        fecha: traslado.fecha,
        createdAt: traslado.createdAt,
        tipo,
        categoria: 'animales',
        categoriaAnimal: traslado.categoria,
        descripcion,
        icono: '🚛',
        usuario: null,
        lote: esEgreso ? traslado.potreroOrigen.nombre : traslado.potreroDestino.nombre,
        cantidad: traslado.cantidad,
        monto: traslado.totalUSD,
        notas: traslado.notas,
        // Datos extra para traslados
        campoDestino: esEgreso ? traslado.campoDestino.nombre : null,
        campoOrigen: !esEgreso ? traslado.campoOrigen.nombre : null,
        pesoPromedio: traslado.pesoPromedio,
        precioKgUSD: traslado.precioKgUSD,
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
        icono: mov.tipo === 'INGRESO' ? '📦' : '🔻',
        usuario: null,
        lote: mov.lote?.nombre || null,
        // ✅ Campos directos
        insumo: mov.insumo.nombre,
        cantidad: mov.cantidad,
        unidad: mov.insumo.unidad,
        notas: mov.notas && typeof mov.notas === 'string' && mov.notas.trim() !== '' ? mov.notas : null,
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