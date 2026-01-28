import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import { getCotizacionDiaAnterior, getDiaAnterior } from '@/lib/bcu-cotizacion'

// Tipos para las hojas seleccionadas
type HojasSeleccionadas = {
  tratamientos?: boolean
  movimientosGanaderos?: boolean
  cambiosPotrero?: boolean
  tactos?: boolean
  dao?: boolean
  recategorizaciones?: boolean
  siembras?: boolean
  pulverizaciones?: boolean
  fertilizaciones?: boolean
  cosechas?: boolean
  riegos?: boolean
  monitoreos?: boolean
  otrasLabores?: boolean
  lluvia?: boolean
  heladas?: boolean
  insumos?: boolean
  gastosIngresos?: boolean
  ventas?: boolean
  traslados?: boolean
}

// Estilos reutilizables
const estiloEncabezado: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  },
}

const estiloCelda: Partial<ExcelJS.Style> = {
  alignment: { vertical: 'middle' },
  border: {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  },
}

// Función para formatear fecha
function formatearFecha(fecha: Date | null): string {
  if (!fecha) return ''
  const d = new Date(fecha)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const anio = d.getFullYear()
  return `${dia}/${mes}/${anio}`
}

// Función para aplicar estilo a encabezados
function aplicarEstiloEncabezado(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.style = estiloEncabezado
  })
  row.height = 25
}

// Función para aplicar estilo a filas de datos
function aplicarEstiloDatos(sheet: ExcelJS.Worksheet, startRow: number) {
  for (let i = startRow; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    row.eachCell((cell) => {
      cell.style = { ...estiloCelda }
    })
    // Alternar color de fondo
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      })
    }
  }
}

// Función para auto-ajustar columnas
function autoAjustarColumnas(sheet: ExcelJS.Worksheet, columnas: { header: string; key: string; width?: number }[]) {
  columnas.forEach((col, index) => {
    const column = sheet.getColumn(index + 1)
    column.width = col.width || 15
  })
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const usuario = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { campoId: true },
    })

    if (!usuario?.campoId) {
      return NextResponse.json({ error: 'Usuario sin campo asignado' }, { status: 400 })
    }

    const body = await request.json()
    const { hojas, fechaDesde, fechaHasta } = body as {
      hojas: HojasSeleccionadas
      fechaDesde?: string
      fechaHasta?: string
    }

    // Filtro de fechas
    const filtroFecha: any = {}
    if (fechaDesde) filtroFecha.gte = new Date(fechaDesde)
    if (fechaHasta) filtroFecha.lte = new Date(fechaHasta + 'T23:59:59')

    const whereFecha = fechaDesde || fechaHasta ? { fecha: filtroFecha } : {}

    // Crear workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'BotRural'
    workbook.created = new Date()

    // ========================================
    // HOJA: TRATAMIENTOS
    // ========================================
    if (hojas.tratamientos) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'TRATAMIENTO', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Tratamientos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Tratamiento', key: 'descripcion', width: 30 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''

        // Limpiar prefijo "Tratamiento:" de la descripción
        let descripcionLimpia = e.descripcion || ''
        if (descripcionLimpia.toLowerCase().startsWith('tratamiento:')) {
          descripcionLimpia = descripcionLimpia.substring(12).trim()
        }

        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          descripcion: descripcionLimpia,
          potrero: nombrePotrero,
          cantidad: e.cantidad || '',
          categoria: e.categoria || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'G1' }
    }

    // ========================================
    // HOJA: MOVIMIENTOS GANADEROS
    // ========================================
    if (hojas.movimientosGanaderos) {
      const eventos = await prisma.evento.findMany({
        where: {
          campoId: usuario.campoId,
          tipo: { in: ['NACIMIENTO', 'MORTANDAD', 'COMPRA', 'VENTA', 'CONSUMO', 'ABORTO', 'DESTETE'] },
          ...whereFecha,
        },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Movimientos Ganaderos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 15 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Caravana', key: 'caravana', width: 15 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      const tiposLegibles: Record<string, string> = {
        NACIMIENTO: 'Nacimiento',
        MORTANDAD: 'Mortandad',
        COMPRA: 'Compra',
        VENTA: 'Venta',
        CONSUMO: 'Consumo',
        ABORTO: 'Aborto',
        DESTETE: 'Destete',
      }

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          tipo: tiposLegibles[e.tipo] || e.tipo,
          cantidad: e.cantidad || '',
          categoria: e.categoria || '',
          caravana: e.caravana || '',
          potrero: nombrePotrero,
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'GH1' }

    }

    // ========================================
    // HOJA: CAMBIOS DE POTRERO
    // ========================================
    if (hojas.cambiosPotrero) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'CAMBIO_POTRERO', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      // Obtener nombres de potreros destino CON MÓDULOS
      const loteDestinoIds = eventos.map(e => e.loteDestinoId).filter(Boolean) as string[]
      const lotesDestino = await prisma.lote.findMany({
        where: { id: { in: loteDestinoIds } },
        select: { 
          id: true, 
          nombre: true,
          moduloPastoreo: { select: { nombre: true } }
        },
      })
      const lotesDestinoMap = new Map(
        lotesDestino.map(l => [
          l.id, 
          l.moduloPastoreo?.nombre 
            ? `${l.nombre} (${l.moduloPastoreo.nombre})`
            : l.nombre
        ])
      )

      const sheet = workbook.addWorksheet('Cambios de Potrero')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero Origen', key: 'origen', width: 18 },
        { header: 'Potrero Destino', key: 'destino', width: 18 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombreOrigen = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          origen: nombreOrigen,
          destino: e.loteDestinoId ? lotesDestinoMap.get(e.loteDestinoId) || '' : '',
          cantidad: e.cantidad || '',
          categoria: e.categoria || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'G1' }
    }

    // ========================================
    // HOJA: TACTOS
    // ========================================
    if (hojas.tactos) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'TACTO', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
          rodeo: { select: { nombre: true } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Tactos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Lote', key: 'rodeo', width: 18 },
        { header: 'Animales Tactados', key: 'tactados', width: 16 },
        { header: 'Preñados (n)', key: 'prenados', width: 14 },
        { header: 'Preñados (%)', key: 'prenadosPct', width: 14 },
        { header: 'Fallados (n)', key: 'fallados', width: 14 },
        { header: 'Fallados (%)', key: 'falladosPct', width: 14 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        const tactados = e.cantidad || 0
        
        // 🔍 Parsear la descripción para extraer preñados
        let prenados = 0
        if (e.descripcion) {
          // Buscar patrón: "95 preñados" o "95 preñados ("
          const match = e.descripcion.match(/(\d+)\s+preñados/i)
          if (match) {
            prenados = parseInt(match[1])
          }
        }
        
        const fallados = tactados > 0 ? tactados - prenados : 0
        const prenadosPct = tactados > 0 ? ((prenados / tactados) * 100).toFixed(1) : '0.0'
        const falladosPct = tactados > 0 ? ((fallados / tactados) * 100).toFixed(1) : '0.0'

        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          rodeo: e.rodeo?.nombre || '',
          tactados: tactados,
          prenados: prenados,
          prenadosPct: `${prenadosPct}%`,
          fallados: fallados,
          falladosPct: `${falladosPct}%`,
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'I1' }
    }
    

    // ========================================
    // HOJA: DAO
    // ========================================
    if (hojas.dao) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'DAO' as any, ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
          rodeo: { select: { nombre: true } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('DAO')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Lote', key: 'loteNombre', width: 18 },
        { header: 'Categoría', key: 'categoria', width: 20 },
        { header: 'Cant. Exam.', key: 'examinada', width: 12 },
        { header: 'Preñado (n)', key: 'prenado', width: 14 },
        { header: 'Preñado (%)', key: 'prenadoPct', width: 14 },
        { header: 'Ciclando (n)', key: 'ciclando', width: 14 },
        { header: 'Ciclando (%)', key: 'ciclandoPct', width: 14 },
        { header: 'Anestro Sup. (n)', key: 'anestroSup', width: 16 },
        { header: 'Anestro Sup. (%)', key: 'anestroSupPct', width: 16 },
        { header: 'Anestro Prof. (n)', key: 'anestroProf', width: 17 },
        { header: 'Anestro Prof. (%)', key: 'anestroProfPct', width: 17 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      // Variables para totales
      let totalExaminada = 0
      let totalPrenado = 0
      let totalCiclando = 0
      let totalAnestroSup = 0
      let totalAnestroProf = 0

      eventos.forEach((e: any) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        if (!e.descripcion) return

        // Parsear descripción: "DAO en potrero X: Vacas: 50 examinadas (Preñadas: 30, Ciclando: 10...)"
        const categorias = e.descripcion.split(' | ')
        
        categorias.forEach((catText: string) => {
          const matchCategoria = catText.match(/([^:]+):\s*(\d+)\s*examinadas\s*\(Preñadas?:\s*(\d+),\s*Ciclando:\s*(\d+),\s*Anestro Superficial:\s*(\d+),\s*Anestro Profundo:\s*(\d+)\)/)
          
          if (matchCategoria) {
            const categoria = matchCategoria[1].replace(/^.*en potrero[^:]*:\s*/, '').trim()
            const examinada = parseInt(matchCategoria[2])
            const prenado = parseInt(matchCategoria[3])
            const ciclando = parseInt(matchCategoria[4])
            const anestroSup = parseInt(matchCategoria[5])
            const anestroProf = parseInt(matchCategoria[6])
            
            // Acumular totales
            totalExaminada += examinada
            totalPrenado += prenado
            totalCiclando += ciclando
            totalAnestroSup += anestroSup
            totalAnestroProf += anestroProf
            
            // Calcular todos los porcentajes
            const prenadoPct = examinada > 0 ? ((prenado / examinada) * 100).toFixed(1) : '0.0'
            const ciclandoPct = examinada > 0 ? ((ciclando / examinada) * 100).toFixed(1) : '0.0'
            const anestroSupPct = examinada > 0 ? ((anestroSup / examinada) * 100).toFixed(1) : '0.0'
            const anestroProfPct = examinada > 0 ? ((anestroProf / examinada) * 100).toFixed(1) : '0.0'

            sheet.addRow({
              fecha: formatearFecha(e.fecha),
              potrero: nombrePotrero,
              loteNombre: e.rodeo?.nombre || '',
              categoria: categoria,
              examinada: examinada,
              prenado: prenado,
              prenadoPct: `${prenadoPct}%`,
              ciclando: ciclando,
              ciclandoPct: `${ciclandoPct}%`,
              anestroSup: anestroSup,
              anestroSupPct: `${anestroSupPct}%`,
              anestroProf: anestroProf,
              anestroProfPct: `${anestroProfPct}%`,
              notas: e.notas || '',
            })
          }
        })
      })

      // Calcular porcentajes totales
      const totalPrenadoPct = totalExaminada > 0 ? ((totalPrenado / totalExaminada) * 100).toFixed(1) : '0.0'
      const totalCiclandoPct = totalExaminada > 0 ? ((totalCiclando / totalExaminada) * 100).toFixed(1) : '0.0'
      const totalAnestroSupPct = totalExaminada > 0 ? ((totalAnestroSup / totalExaminada) * 100).toFixed(1) : '0.0'
      const totalAnestroProfPct = totalExaminada > 0 ? ((totalAnestroProf / totalExaminada) * 100).toFixed(1) : '0.0'

      // Agregar fila TOTAL
      const filaTotal = sheet.addRow({
        fecha: '',
        potrero: '',
        loteNombre: '',
        categoria: 'TOTAL',
        examinada: totalExaminada,
        prenado: totalPrenado,
        prenadoPct: `${totalPrenadoPct}%`,
        ciclando: totalCiclando,
        ciclandoPct: `${totalCiclandoPct}%`,
        anestroSup: totalAnestroSup,
        anestroSupPct: `${totalAnestroSupPct}%`,
        anestroProf: totalAnestroProf,
        anestroProfPct: `${totalAnestroProfPct}%`,
        notas: '',
      })

      // Estilo para fila TOTAL
      filaTotal.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8FFC8' } }
        cell.font = { bold: true }
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'N1' }
    }

    // ========================================
    // HOJA: RECATEGORIZACIONES
    // ========================================
    if (hojas.recategorizaciones) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'RECATEGORIZACION', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Recategorizaciones')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Categoría Origen', key: 'categoriaOrigen', width: 20 },
        { header: 'Categoría Destino', key: 'categoriaDestino', width: 20 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          cantidad: e.cantidad || '',
          categoriaOrigen: e.categoria || '',
          categoriaDestino: e.categoriaNueva || '',
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'G1' }
    }

    // ========================================
    // HOJA: SIEMBRAS
    // ========================================
    if (hojas.siembras) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'SIEMBRA', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Siembras')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: PULVERIZACIONES
    // ========================================
    if (hojas.pulverizaciones) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'PULVERIZACION', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Pulverizaciones')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: FERTILIZACIONES
    // ========================================
    if (hojas.fertilizaciones) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'REFERTILIZACION', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Fertilizaciones')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: COSECHAS
    // ========================================
    if (hojas.cosechas) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'COSECHA', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Cosechas')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Monto', key: 'monto', width: 15 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          monto: e.monto ? `$${e.monto.toLocaleString('es-UY')}` : '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'F1' }
    }

    // ========================================
    // HOJA: RIEGOS
    // ========================================
    if (hojas.riegos) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'RIEGO', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Riegos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: MONITOREOS
    // ========================================
    if (hojas.monitoreos) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'MONITOREO', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Monitoreos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: OTRAS LABORES
    // ========================================
    if (hojas.otrasLabores) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'OTROS_LABORES', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Otras Labores')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        const nombrePotrero = e.lote?.moduloPastoreo?.nombre
          ? `${e.lote.nombre} (${e.lote.moduloPastoreo.nombre})`
          : e.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          potrero: nombrePotrero,
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: LLUVIA
    // ========================================
    if (hojas.lluvia) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'LLUVIA', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Lluvia')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Milímetros', key: 'mm', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          mm: e.cantidad || '',
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'E1' }
    }

    // ========================================
    // HOJA: HELADAS
    // ========================================
    if (hojas.heladas) {
      const eventos = await prisma.evento.findMany({
        where: { campoId: usuario.campoId, tipo: 'HELADA', ...whereFecha },
        include: {
          usuario: { select: { name: true } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Heladas')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Usuario', key: 'usuario', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      eventos.forEach((e) => {
        sheet.addRow({
          fecha: formatearFecha(e.fecha),
          descripcion: e.descripcion || '',
          usuario: e.usuario?.name || '',
          notas: e.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'D1' }
    }

    // ========================================
    // HOJA: INSUMOS
    // ========================================
    if (hojas.insumos) {
      const movimientos = await prisma.movimientoInsumo.findMany({
        where: {
          insumo: { campoId: usuario.campoId },
          ...(fechaDesde || fechaHasta ? { fecha: filtroFecha } : {}),
        },
        include: {
          insumo: { select: { nombre: true, unidad: true } },
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Insumos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: 'Insumo', key: 'insumo', width: 25 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Unidad', key: 'unidad', width: 12 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      movimientos.forEach((m) => {
        const nombrePotrero = m.lote?.moduloPastoreo?.nombre
          ? `${m.lote.nombre} (${m.lote.moduloPastoreo.nombre})`
          : m.lote?.nombre || ''
          
        sheet.addRow({
          fecha: formatearFecha(m.fecha),
          tipo: m.tipo === 'INGRESO' ? 'Ingreso' : 'Uso',
          insumo: m.insumo.nombre,
          cantidad: m.cantidad,
          unidad: m.insumo.unidad,
          potrero: nombrePotrero,
          notas: m.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'G1' }
    }

    // ========================================
    // HOJA: GASTOS E INGRESOS
    // ========================================
    if (hojas.gastosIngresos) {
      const gastos = await prisma.gasto.findMany({
        where: {
          campoId: usuario.campoId,
          ...(fechaDesde || fechaHasta ? { fecha: filtroFecha } : {}),
        },
        include: {
          lote: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Gastos e Ingresos')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Cotiz. USD Día Ant', key: 'cotizacion', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: 'Origen', key: 'origen', width: 12 },
        { header: 'Descripción', key: 'descripcion', width: 35 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Proveedor/Comprador', key: 'contraparte', width: 20 },
        { header: 'Moneda', key: 'moneda', width: 10 },
        { header: 'Monto s/IVA', key: 'montoSinIva', width: 14 },
        { header: 'IVA', key: 'iva', width: 12 },
        { header: 'Total', key: 'montoTotal', width: 14 },
        { header: 'Monto UYU', key: 'montoUYU', width: 14 },
        { header: 'Monto USD', key: 'montoUSD', width: 14 },
        { header: 'Método Pago', key: 'metodoPago', width: 15 },
        { header: 'Pagado', key: 'pagado', width: 10 },
        { header: 'Potrero', key: 'potrero', width: 18 },
        { header: 'Ver Factura', key: 'factura', width: 12 },
      ]
      sheet.columns = columnas

      // Agrupar gastos por factura (mismo imageUrl) para alternar colores
      // Crear clave de grupo: imageUrl si existe, sino ID único (cada uno su propio grupo)
      const getGrupoKey = (g: any) => {
        if (g.imageUrl) return g.imageUrl
        return g.id // Sin imagen = cada gasto es su propio grupo
      }

      // Ordenar: primero por grupo (imageUrl), luego por fecha dentro del grupo
      // Esto asegura que todos los items de la misma factura queden juntos
      const gastosOrdenados = [...gastos].sort((a, b) => {
        const grupoA = getGrupoKey(a)
        const grupoB = getGrupoKey(b)

        // Si tienen el mismo grupo (misma factura), ordenar por fecha
        if (grupoA === grupoB) {
          return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        }

        // Si son grupos diferentes, ordenar por la fecha del primer item de cada grupo
        const fechaA = new Date(a.fecha).getTime()
        const fechaB = new Date(b.fecha).getTime()
        return fechaA - fechaB
      })

      // Pre-cargar cotizaciones para todas las fechas únicas de gastos
      const fechasUnicasGastos = new Set<string>()
      gastosOrdenados.forEach(g => {
        const diaAnterior = getDiaAnterior(new Date(g.fecha))
        fechasUnicasGastos.add(diaAnterior.toISOString().split('T')[0])
      })

      const cotizacionesCacheGastos: Map<string, number | null> = new Map()
      for (const fechaStr of fechasUnicasGastos) {
        const fecha = new Date(fechaStr + 'T12:00:00')
        const result = await getCotizacionDiaAnterior(new Date(fecha.getTime() + 86400000))
        cotizacionesCacheGastos.set(fechaStr, result.valor)
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      let rowNum = 2
      let grupoIndex = 0
      let grupoAnterior = ''

      for (const g of gastosOrdenados) {
        const grupoActual = getGrupoKey(g)
        const esPrimerDelGrupo = grupoActual !== grupoAnterior

        // Si es un nuevo grupo, incrementar el índice para alternar color
        if (esPrimerDelGrupo) {
          grupoIndex++
          grupoAnterior = grupoActual
        }

        // Color por tipo y alternado por grupo (factura)
        const esGrupoPar = grupoIndex % 2 === 0
        const esIngreso = g.tipo === 'INGRESO'

        let colorFondo: string
        if (esIngreso) {
          // Ingresos: verde (alternando tonos entre facturas)
          colorFondo = esGrupoPar ? 'FF86EFAC' : 'FFBBF7D0' // verde / verde claro
        } else {
          // Gastos: gris / blanco (alternando entre facturas)
          colorFondo = esGrupoPar ? 'FFE5E7EB' : 'FFFFFFFF' // gris / blanco
        }

        const nombrePotrero = g.lote?.moduloPastoreo?.nombre
          ? `${g.lote.nombre} (${g.lote.moduloPastoreo.nombre})`
          : g.lote?.nombre || ''

        // Calcular monto sin IVA
        const ivaAmount = g.iva ? Number(g.iva) : 0
        const montoTotal = g.montoOriginal ? Number(g.montoOriginal) : (g.monto ? Number(g.monto) : 0)
        const montoSinIva = montoTotal - ivaAmount

        // Determinar origen (si es venta)
        const esVenta = g.categoria?.startsWith('Venta de') || g.descripcion?.startsWith('Venta de')
        const origen = esVenta ? 'Venta' : (g.tipo === 'INGRESO' ? 'Otro' : 'Compra')

        // Obtener cotización del día anterior
        const diaAnteriorGasto = getDiaAnterior(new Date(g.fecha))
        const fechaCotizKeyGasto = diaAnteriorGasto.toISOString().split('T')[0]
        const cotizacionGasto = cotizacionesCacheGastos.get(fechaCotizKeyGasto)
        const cotizacionStrGasto = cotizacionGasto !== null && cotizacionGasto !== undefined
          ? cotizacionGasto.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : 'N/D'

        const row = sheet.addRow({
          fecha: formatearFecha(g.fecha),
          cotizacion: esPrimerDelGrupo ? cotizacionStrGasto : '',
          tipo: g.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto',
          origen: origen,
          descripcion: g.descripcion || '',
          categoria: g.categoria || '',
          contraparte: g.proveedor || g.comprador || '',
          moneda: g.moneda || 'UYU',
          montoSinIva: ivaAmount > 0 ? montoSinIva.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          iva: ivaAmount > 0 ? ivaAmount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          montoTotal: montoTotal ? montoTotal.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          montoUYU: g.montoEnUYU ? Number(g.montoEnUYU).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          montoUSD: g.montoEnUSD ? Number(g.montoEnUSD).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          metodoPago: g.metodoPago || '',
          pagado: g.pagado ? 'Sí' : 'No',
          potrero: nombrePotrero,
          factura: '',
        })

        // Aplicar color de fondo a toda la fila
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } }
        })

        // Agregar link a la factura solo en el primer renglón del grupo (columna Q ahora)
        if (esPrimerDelGrupo && g.imageUrl) {
          const cell = sheet.getCell(`Q${rowNum}`)
          cell.value = { text: '📎 Ver', hyperlink: g.imageUrl } as any
          cell.font = { color: { argb: 'FF0066CC' }, underline: true }
        }

        rowNum++
      }

      aplicarEstiloEncabezado(sheet.getRow(1))
      // NO usar aplicarEstiloDatos porque sobrescribe los colores personalizados
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'Q1' }
    }

    // ========================================
    // HOJA: VENTAS (VACUNO, OVINO, LANA)
    // ========================================
    if (hojas.ventas) {
      const ventas = await prisma.venta.findMany({
        where: {
          campoId: usuario.campoId,
          ...(fechaDesde || fechaHasta ? { fecha: filtroFecha } : {}),
        },
        include: {
          renglones: true,
          firma: { select: { razonSocial: true } },
        },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Ventas')

      // Helper para formatear números
      const formatNum = (num: number): string =>
        num.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const formatNeg = (num: number): string =>
        (-num).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      // Estilo para títulos de sección
      const estiloSeccion: Partial<ExcelJS.Style> = {
        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      }

      // Función para agregar una sección
      const agregarSeccion = async (
        titulo: string,
        tipoAnimal: string | null, // null para LANA
        tipoProducto: string,
        startRow: number
      ): Promise<number> => {
        // Filtrar ventas por tipo
        const ventasFiltradas = ventas.filter(v => {
          if (tipoProducto === 'LANA') {
            return v.tipoProducto === 'LANA'
          }
          // GANADO: incluye ventas con tipoProducto='GANADO' o null/undefined (ventas viejas)
          const esGanado = v.tipoProducto === 'GANADO' || !v.tipoProducto
          return esGanado && v.renglones.some(r => r.tipoAnimal === tipoAnimal)
        })

        if (ventasFiltradas.length === 0) {
          return startRow // No hay datos, no agregar sección
        }

        // Título de sección
        const tituloRow = sheet.getRow(startRow)
        sheet.mergeCells(startRow, 1, startRow, 19)
        tituloRow.getCell(1).value = titulo
        tituloRow.getCell(1).style = estiloSeccion
        tituloRow.height = 25
        startRow++

        // Encabezados de columna (incluye Cotiz. USD Día Ant después de Fecha)
        const headers = tipoProducto === 'LANA'
          ? ['Fecha', 'Cotiz. USD Día Ant', 'Nº Factura', 'Firma', 'Comprador', 'Consignatario', 'Categoría', 'Peso kg', '$/kg', 'Subtotal USD', 'IMEBA', 'INIA', 'MEVIR', 'Comisión', 'IVA', 'Otros', 'Total Imp', 'Neto USD', 'Ver Factura']
          : ['Fecha', 'Cotiz. USD Día Ant', 'Nº Factura', 'Firma', 'Comprador', 'Consignatario', 'Categoría', 'Cant', 'Peso kg', '$/kg', 'Subtotal USD', 'IMEBA', 'INIA', 'MEVIR', 'Comisión', 'IVA', 'Otros', 'Neto USD', 'Ver Factura']

        const headerRow = sheet.getRow(startRow)
        headers.forEach((h, i) => {
          headerRow.getCell(i + 1).value = h
        })
        aplicarEstiloEncabezado(headerRow)
        startRow++

        // Totales para subtotal
        let totalSubtotal = 0
        let totalImeba = 0
        let totalInia = 0
        let totalMevir = 0
        let totalComision = 0
        let totalIva = 0
        let totalOtros = 0
        let totalNeto = 0
        let totalCantidad = 0
        let totalPeso = 0

        // Pre-cargar cotizaciones para todas las fechas únicas
        const fechasUnicas = new Set<string>()
        ventasFiltradas.forEach(v => {
          const diaAnterior = getDiaAnterior(new Date(v.fecha))
          fechasUnicas.add(diaAnterior.toISOString().split('T')[0])
        })

        // Cache local de cotizaciones para esta sección
        const cotizacionesCache: Map<string, number | null> = new Map()
        for (const fechaStr of fechasUnicas) {
          const fecha = new Date(fechaStr + 'T12:00:00')
          const result = await getCotizacionDiaAnterior(new Date(fecha.getTime() + 86400000)) // Sumamos un día porque la función resta uno
          cotizacionesCache.set(fechaStr, result.valor)
          // Pequeño delay para no saturar el servicio
          await new Promise(resolve => setTimeout(resolve, 150))
        }

        // Datos - alternar color por VENTA (no por fila)
        let ventaIndex = 0
        for (const v of ventasFiltradas) {
          const impuestos = (v.impuestos as any) || {}

          // Filtrar renglones por tipo
          const renglonesDelTipo = tipoProducto === 'LANA'
            ? v.renglones.filter(r => r.tipo === 'LANA' || r.esVentaLana)
            : v.renglones.filter(r => r.tipoAnimal === tipoAnimal)

          if (renglonesDelTipo.length === 0) return

          // Color alternado por venta: gris (par) / blanco (impar)
          const esVentaGris = ventaIndex % 2 === 0
          const colorFondo = esVentaGris ? 'FFE5E7EB' : 'FFFFFFFF' // gris claro / blanco

          // Obtener cotización del día anterior para esta venta
          const diaAnterior = getDiaAnterior(new Date(v.fecha))
          const fechaCotizKey = diaAnterior.toISOString().split('T')[0]
          const cotizacion = cotizacionesCache.get(fechaCotizKey)
          const cotizacionStr = cotizacion !== null && cotizacion !== undefined
            ? formatNum(cotizacion)
            : 'N/D'

          renglonesDelTipo.forEach((r, renglonIndex) => {
            const row = sheet.getRow(startRow)
            const esPrimerRenglon = renglonIndex === 0

            if (tipoProducto === 'LANA') {
              // Calcular proporcionales de impuestos por renglón
              const proporcion = v.subtotalUSD > 0 ? r.importeBrutoUSD / v.subtotalUSD : 0
              const imebaRenglon = (impuestos.imeba || 0) * proporcion
              const iniaRenglon = (impuestos.inia || 0) * proporcion
              const mevirRenglon = (impuestos.mevir || 0) * proporcion
              const comisionRenglon = (impuestos.comision || 0) * proporcion
              const ivaRenglon = (impuestos.iva || 0) * proporcion
              const otrosRenglon = (impuestos.otros || 0) * proporcion
              const totalImpRenglon = imebaRenglon + iniaRenglon + mevirRenglon + comisionRenglon + ivaRenglon + otrosRenglon
              const netoRenglon = r.importeBrutoUSD - totalImpRenglon

              const pesoLana = r.esVentaLana ? (r.kgVellon || 0) + (r.kgBarriga || 0) : r.pesoTotalKg
              const precioLana = r.esVentaLana ? (r.precioKgVellon || r.precioKgUSD) : r.precioKgUSD

              // Solo mostrar datos de factura en el primer renglón (incluye cotización)
              row.values = [
                esPrimerRenglon ? formatearFecha(v.fecha) : '',
                esPrimerRenglon ? cotizacionStr : '',
                esPrimerRenglon ? (v.nroFactura || '') : '',
                esPrimerRenglon ? (v.firma?.razonSocial || '') : '',
                esPrimerRenglon ? v.comprador : '',
                esPrimerRenglon ? (v.consignatario || '') : '',
                r.categoria,
                formatNum(pesoLana),
                formatNum(precioLana),
                formatNum(r.importeBrutoUSD),
                imebaRenglon > 0 ? formatNeg(imebaRenglon) : '',
                iniaRenglon > 0 ? formatNeg(iniaRenglon) : '',
                mevirRenglon > 0 ? formatNeg(mevirRenglon) : '',
                comisionRenglon > 0 ? formatNeg(comisionRenglon) : '',
                ivaRenglon > 0 ? formatNeg(ivaRenglon) : '',
                otrosRenglon > 0 ? formatNeg(otrosRenglon) : '',
                totalImpRenglon > 0 ? formatNeg(totalImpRenglon) : '',
                formatNum(netoRenglon),
                '', // Placeholder para factura
              ]

              // Agregar link a la factura solo en el primer renglón (ahora columna 19)
              if (esPrimerRenglon && v.imageUrl) {
                const cell = row.getCell(19)
                cell.value = { text: '📎 Ver', hyperlink: v.imageUrl } as any
                cell.font = { color: { argb: 'FF0066CC' }, underline: true }
              }

              totalPeso += pesoLana
              totalSubtotal += r.importeBrutoUSD
              totalImeba += imebaRenglon
              totalInia += iniaRenglon
              totalMevir += mevirRenglon
              totalComision += comisionRenglon
              totalIva += ivaRenglon
              totalOtros += otrosRenglon
              totalNeto += netoRenglon
            } else {
              // GANADO (VACUNO/OVINO)
              const proporcion = v.subtotalUSD > 0 ? r.importeBrutoUSD / v.subtotalUSD : 0
              const imebaRenglon = (impuestos.imeba || 0) * proporcion
              const iniaRenglon = (impuestos.inia || 0) * proporcion
              const mevirRenglon = (impuestos.mevir || 0) * proporcion
              const comisionRenglon = (impuestos.comision || 0) * proporcion
              const ivaRenglon = (impuestos.iva || 0) * proporcion
              const otrosRenglon = (impuestos.otros || 0) * proporcion
              const totalImpRenglon = imebaRenglon + iniaRenglon + mevirRenglon + comisionRenglon + ivaRenglon + otrosRenglon
              const netoRenglon = r.importeBrutoUSD - totalImpRenglon

              // Solo mostrar datos de factura en el primer renglón (incluye cotización)
              row.values = [
                esPrimerRenglon ? formatearFecha(v.fecha) : '',
                esPrimerRenglon ? cotizacionStr : '',
                esPrimerRenglon ? (v.nroFactura || '') : '',
                esPrimerRenglon ? (v.firma?.razonSocial || '') : '',
                esPrimerRenglon ? v.comprador : '',
                esPrimerRenglon ? (v.consignatario || '') : '',
                r.categoria,
                r.cantidad,
                formatNum(r.pesoTotalKg),
                formatNum(r.precioKgUSD),
                formatNum(r.importeBrutoUSD),
                imebaRenglon > 0 ? formatNeg(imebaRenglon) : '',
                iniaRenglon > 0 ? formatNeg(iniaRenglon) : '',
                mevirRenglon > 0 ? formatNeg(mevirRenglon) : '',
                comisionRenglon > 0 ? formatNeg(comisionRenglon) : '',
                ivaRenglon > 0 ? formatNeg(ivaRenglon) : '',
                otrosRenglon > 0 ? formatNeg(otrosRenglon) : '',
                formatNum(netoRenglon),
                '', // Placeholder para factura
              ]

              // Agregar link a la factura solo en el primer renglón (ahora columna 19)
              if (esPrimerRenglon && v.imageUrl) {
                const cell = row.getCell(19)
                cell.value = { text: '📎 Ver', hyperlink: v.imageUrl } as any
                cell.font = { color: { argb: 'FF0066CC' }, underline: true }
              }

              totalCantidad += r.cantidad
              totalPeso += r.pesoTotalKg
              totalSubtotal += r.importeBrutoUSD
              totalImeba += imebaRenglon
              totalInia += iniaRenglon
              totalMevir += mevirRenglon
              totalComision += comisionRenglon
              totalIva += ivaRenglon
              totalOtros += otrosRenglon
              totalNeto += netoRenglon
            }

            // Aplicar color de fondo a toda la fila (mismo color para toda la venta)
            row.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } }
            })
            startRow++
          })

          ventaIndex++ // Incrementar para alternar color en la siguiente venta
        }

        // Fila de TOTALES
        const totalRow = sheet.getRow(startRow)
        const totalImpuestos = totalImeba + totalInia + totalMevir + totalComision + totalIva + totalOtros

        if (tipoProducto === 'LANA') {
          totalRow.values = [
            '', '', '', '', '', 'TOTAL',
            '',
            formatNum(totalPeso),
            '',
            formatNum(totalSubtotal),
            totalImeba > 0 ? formatNeg(totalImeba) : '',
            totalInia > 0 ? formatNeg(totalInia) : '',
            totalMevir > 0 ? formatNeg(totalMevir) : '',
            totalComision > 0 ? formatNeg(totalComision) : '',
            totalIva > 0 ? formatNeg(totalIva) : '',
            totalOtros > 0 ? formatNeg(totalOtros) : '',
            totalImpuestos > 0 ? formatNeg(totalImpuestos) : '',
            formatNum(totalNeto),
            '', // Columna factura vacía en totales
          ]
        } else {
          totalRow.values = [
            '', '', '', '', '', 'TOTAL',
            '',
            totalCantidad,
            formatNum(totalPeso),
            '',
            formatNum(totalSubtotal),
            totalImeba > 0 ? formatNeg(totalImeba) : '',
            totalInia > 0 ? formatNeg(totalInia) : '',
            totalMevir > 0 ? formatNeg(totalMevir) : '',
            totalComision > 0 ? formatNeg(totalComision) : '',
            totalIva > 0 ? formatNeg(totalIva) : '',
            totalOtros > 0 ? formatNeg(totalOtros) : '',
            formatNum(totalNeto),
            '', // Columna factura vacía en totales
          ]
        }
        totalRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
          cell.font = { bold: true }
        })
        startRow++

        // Fila vacía de separación
        startRow += 2

        return startRow
      }

      // Agregar las 3 secciones
      let currentRow = 1
      currentRow = await agregarSeccion('🐄 VENTAS VACUNO', 'BOVINO', 'GANADO', currentRow)
      currentRow = await agregarSeccion('🐑 VENTAS OVINO', 'OVINO', 'GANADO', currentRow)
      currentRow = await agregarSeccion('🧶 VENTAS LANA', null, 'LANA', currentRow)

      // Ajustar anchos de columna
      sheet.getColumn(1).width = 12  // Fecha
      sheet.getColumn(2).width = 18  // Cotiz. USD Día Ant
      sheet.getColumn(3).width = 14  // Nº Factura
      sheet.getColumn(4).width = 22  // Firma
      sheet.getColumn(5).width = 22  // Comprador
      sheet.getColumn(6).width = 18  // Consignatario
      sheet.getColumn(7).width = 18  // Categoría
      sheet.getColumn(8).width = 10  // Cant/Peso
      sheet.getColumn(9).width = 12  // Peso/$/kg
      sheet.getColumn(10).width = 10 // $/kg/Subtotal
      sheet.getColumn(11).width = 14 // Subtotal/IMEBA
      sheet.getColumn(12).width = 12 // IMEBA/INIA
      sheet.getColumn(13).width = 12 // INIA/MEVIR
      sheet.getColumn(14).width = 12 // MEVIR/Comisión
      sheet.getColumn(15).width = 12 // Comisión/IVA
      sheet.getColumn(16).width = 12 // IVA/Otros
      sheet.getColumn(17).width = 12 // Otros/Total Imp
      sheet.getColumn(18).width = 14 // Neto USD
      sheet.getColumn(19).width = 12 // Ver Factura
    }

    // ========================================
    // HOJA: TRASLADOS
    // ========================================
    if (hojas.traslados) {
      const traslados = await prisma.traslado.findMany({
        where: {
          OR: [
            { campoOrigenId: usuario.campoId },
            { campoDestinoId: usuario.campoId },
          ],
          ...(fechaDesde || fechaHasta ? { fecha: filtroFecha } : {}),
        },
        include: {
      campoOrigen: { select: { nombre: true } },
      campoDestino: { select: { nombre: true } },
      potreroOrigen: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
      potreroDestino: { select: { nombre: true, moduloPastoreo: { select: { nombre: true } } } },
    },
        orderBy: { fecha: 'asc' },
      })

      const sheet = workbook.addWorksheet('Traslados')
      const columnas = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Tipo', key: 'tipoMov', width: 12 },
        { header: 'Campo Origen', key: 'campoOrigen', width: 18 },
        { header: 'Potrero Origen', key: 'potreroOrigen', width: 18 },
        { header: 'Campo Destino', key: 'campoDestino', width: 18 },
        { header: 'Potrero Destino', key: 'potreroDestino', width: 18 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Peso Prom (kg)', key: 'peso', width: 15 },
        { header: 'Precio USD/kg', key: 'precioKg', width: 15 },
        { header: 'Total USD', key: 'totalUSD', width: 15 },
        { header: 'Notas', key: 'notas', width: 30 },
      ]
      sheet.columns = columnas

      traslados.forEach((t) => {
        const esEgreso = t.campoOrigenId === usuario.campoId
        
        const nombrePotreroOrigen = t.potreroOrigen.moduloPastoreo?.nombre
          ? `${t.potreroOrigen.nombre} (${t.potreroOrigen.moduloPastoreo.nombre})`
          : t.potreroOrigen.nombre
          
        const nombrePotreroDestino = t.potreroDestino.moduloPastoreo?.nombre
          ? `${t.potreroDestino.nombre} (${t.potreroDestino.moduloPastoreo.nombre})`
          : t.potreroDestino.nombre
        
        sheet.addRow({
          fecha: formatearFecha(t.fecha),
          tipoMov: esEgreso ? 'Egreso' : 'Ingreso',
          campoOrigen: t.campoOrigen.nombre,
          potreroOrigen: nombrePotreroOrigen,
          campoDestino: t.campoDestino.nombre,
          potreroDestino: nombrePotreroDestino,
          categoria: t.categoria,
          cantidad: t.cantidad,
          peso: t.pesoPromedio || '',
          precioKg: t.precioKgUSD || '',
          totalUSD: t.totalUSD ? Number(t.totalUSD) : '',
          notas: t.notas || '',
        })
      })

      aplicarEstiloEncabezado(sheet.getRow(1))
      aplicarEstiloDatos(sheet, 2)
      autoAjustarColumnas(sheet, columnas)
      sheet.autoFilter = { from: 'A1', to: 'L1' }
    }

    // ========================================
    // GENERAR ARCHIVO
    // ========================================
    
    // Si no hay hojas, agregar una vacía
    if (workbook.worksheets.length === 0) {
      const sheet = workbook.addWorksheet('Sin datos')
      sheet.addRow(['No se seleccionaron datos para exportar'])
    }

    const buffer = await workbook.xlsx.writeBuffer()

    // Generar nombre del archivo
    const campo = await prisma.campo.findUnique({
      where: { id: usuario.campoId },
      select: { nombre: true },
    })
    const fechaHoy = new Date().toISOString().split('T')[0]
    const nombreArchivo = `${campo?.nombre || 'Campo'}-${fechaHoy}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nombreArchivo)}"`,
      },
    })
  } catch (error) {
    console.error('Error generando Excel:', error)
    return NextResponse.json(
      { error: 'Error al generar el archivo Excel', details: (error as Error).message },
      { status: 500 }
    )
  }
}