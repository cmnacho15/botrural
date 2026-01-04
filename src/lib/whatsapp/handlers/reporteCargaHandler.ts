// src/lib/whatsapp/handlers/reporteCargaHandler.ts

import { prisma } from "@/lib/prisma"
import { calcularUGTotales } from "@/lib/ugCalculator"
import { sendWhatsAppMessage, sendWhatsAppDocument } from "../sendMessage"
import { getEquivalenciasUG } from "@/lib/getEquivalenciasUG"
import { createClient } from "@supabase/supabase-js"

function limpiarNombreCategoria(nombre: string): string {
  return nombre
    .replace(' años', '')
    .replace(' año', '')
}


// Función para obtener cliente Supabase (lazy init)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Obtener equivalencia UG de una categoría (usa pesos personalizados si existen)
function getEquivalenciaUGLocal(categoria: string, pesos: Record<string, number>): number {
  if (pesos[categoria] !== undefined) {
    return pesos[categoria] / 380
  }
  // Si no hay peso personalizado, usar 1 UG por defecto
  return 1.0
}

/**
 * Genera el PDF de carga en el servidor usando jsPDF
 */
async function generarPDFCarga(campoId: string): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const campo = await prisma.campo.findUnique({ where: { id: campoId } })
    if (!campo) return null

    // Obtener equivalencias personalizadas del campo
    const pesosPersonalizados = await getEquivalenciasUG(campoId)

    const categoriasDB = await prisma.categoriaAnimal.findMany({
      where: { campoId, activo: true },
      orderBy: [{ tipoAnimal: 'asc' }, { nombreSingular: 'asc' }]
    })

    const categoriasBovinas = categoriasDB
  .filter(c => c.tipoAnimal === 'BOVINO')
  .map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUGLocal(c.nombreSingular, pesosPersonalizados) }))
  .sort((a, b) => {
    const orden = [
      'Vacas gordas', 'Vacas', 'Vaquillonas +2', 'Vaquillonas 1-2', 
      'Terneras', 'Terneros', 'Terneros nacidos', 'Toros', 
      'Nov 1-2', 'Nov 2-3', 'Nov +3'
    ];
    return orden.indexOf(a.nombre) - orden.indexOf(b.nombre);
  })
const categoriasOvinas = categoriasDB.filter(c => c.tipoAnimal === 'OVINO').map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUGLocal(c.nombreSingular, pesosPersonalizados) }))
const categoriasEquinas = categoriasDB.filter(c => c.tipoAnimal === 'EQUINO').map(c => ({ nombre: c.nombreSingular, equivalenciaUG: getEquivalenciaUGLocal(c.nombreSingular, pesosPersonalizados) }))

    function procesarPotrero(lote: any) {
  const animalesPorCategoria: Record<string, number> = {}
  categoriasDB.forEach(cat => { animalesPorCategoria[cat.nombreSingular] = 0 })

  let vacunosTotales = 0, ovinosTotales = 0, equinosTotales = 0

  // 🔥 Convertir animalesLote a formato para calcularUGTotales
  const animalesParaCalculo = lote.animalesLote.map((animal: any) => ({
    categoria: animal.categoria,
    cantidad: animal.cantidad
  }))

  // 🎯 USAR LA FUNCIÓN QUE APLICA LA LÓGICA ESPECIAL DE VACAS CON TERNEROS
  const ugTotales = calcularUGTotales(animalesParaCalculo, pesosPersonalizados)

  lote.animalesLote.forEach((animal: any) => {
    if (animalesPorCategoria[animal.categoria] !== undefined) {
      animalesPorCategoria[animal.categoria] += animal.cantidad
    }
    const catDB = categoriasDB.find(c => c.nombreSingular === animal.categoria)
    if (catDB?.tipoAnimal === 'BOVINO') vacunosTotales += animal.cantidad
    else if (catDB?.tipoAnimal === 'OVINO') ovinosTotales += animal.cantidad
    else if (catDB?.tipoAnimal === 'EQUINO') equinosTotales += animal.cantidad
  })

      return {
        nombre: lote.nombre,
        hectareas: lote.hectareas,
        animalesPorCategoria,
        ugPorHa: lote.hectareas > 0 ? ugTotales / lote.hectareas : 0,
        ugTotales,
        vacunosTotales,
        ovinosTotales,
        equinosTotales,
        tieneAnimales: vacunosTotales + ovinosTotales + equinosTotales > 0
      }
    }

    // Verificar si hay módulos con potreros
    const modulos = await prisma.moduloPastoreo.findMany({
      where: { campoId },
      include: { lotes: { include: { animalesLote: true }, orderBy: { nombre: 'asc' } } },
      orderBy: { nombre: 'asc' }
    })

    const modulosConPotreros = modulos.filter(m => m.lotes.length > 0)
    const hayModulosActivos = modulosConPotreros.length > 0

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    function dibujarMarcaAgua() {
      doc.setFontSize(30)
      doc.setTextColor(235, 235, 235)
      doc.setFont('helvetica', 'bold')
      doc.text('BOTRURAL', pageWidth / 2, 16, { align: 'center' })
    }

    if (hayModulosActivos) {
      // ========== FORMATO POR MÓDULOS ==========
      const potrerosSinModulo = await prisma.lote.findMany({
        where: { campoId, esPastoreable: true, moduloPastoreoId: null },
        include: { animalesLote: true },
        orderBy: { nombre: 'asc' }
      })

      const modulosData = modulosConPotreros.map(modulo => {
  const potrerosProcesados = modulo.lotes.map(procesarPotrero)
  const potrerosConAnimales = potrerosProcesados.filter(p => p.tieneAnimales)
  const hectareasModulo = potrerosProcesados.reduce((s, p) => s + p.hectareas, 0)
  const ugModulo = potrerosProcesados.reduce((s, p) => s + p.ugTotales, 0)
  return {
    nombre: modulo.nombre,
    hectareas: hectareasModulo,
    ugPorHa: hectareasModulo > 0 ? ugModulo / hectareasModulo : 0,
    cantidadPotreros: modulo.lotes.length, // 👈 TOTAL REAL
    potreros: potrerosConAnimales
  }
}).filter(m => m.potreros.length > 0)

      const potrerosRestoProcesados = potrerosSinModulo.map(procesarPotrero)
let restoDelCampo = null
if (potrerosRestoProcesados.length > 0) {
  const hectareasResto = potrerosRestoProcesados.reduce((s, p) => s + p.hectareas, 0)
  const ugResto = potrerosRestoProcesados.reduce((s, p) => s + p.ugTotales, 0)
  restoDelCampo = {
    nombre: 'Resto del campo',
    hectareas: hectareasResto,
    ugPorHa: hectareasResto > 0 ? ugResto / hectareasResto : 0,
    cantidadPotreros: potrerosSinModulo.length, // 👈 TOTAL REAL
    potreros: potrerosRestoProcesados // 👈 TODOS LOS POTREROS
  }
}

      // 🔥 Calcular totales sobre TODOS los potreros pastoreables (no solo los que tienen animales)
const todosLosPotrerosPastoreables = [
  ...modulosConPotreros.flatMap(m => m.lotes.map(procesarPotrero)),
  ...potrerosRestoProcesados
]
const todosLosPotreros = [...modulosData.flatMap(m => m.potreros), ...(restoDelCampo?.potreros || [])]
const totalHectareas = todosLosPotrerosPastoreables.reduce((s, p) => s + p.hectareas, 0)
const totalUG = todosLosPotrerosPastoreables.reduce((s, p) => s + p.ugTotales, 0)
const ugPorHaGlobal = totalHectareas > 0 ? totalUG / totalHectareas : 0

      // Header
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(`Establecimiento: ${campo.nombre}`, margin, 15)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`TOTAL UG/ha: ${ugPorHaGlobal.toFixed(2)}`, pageWidth - margin - 50, 15)
      const fecha = new Date()
      doc.setFontSize(10)
      doc.text(`Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - margin - 50, 22)
      dibujarMarcaAgua()

      let currentY = 30

      function generarTablaModulo(modulo: any, startY: number): number {
        if (startY > pageHeight - 60) {
          doc.addPage()
          dibujarMarcaAgua()
          startY = 20
        }

       doc.setFontSize(11)
doc.setFont('helvetica', 'bold')
doc.setTextColor(0, 0, 0)
const titulo = modulo.nombre === 'Resto del campo' ? modulo.nombre : `MODULO: ${modulo.nombre}`
doc.text(titulo, margin, startY)

startY += 5

doc.setFontSize(9)
doc.setFont('helvetica', 'normal')
doc.setTextColor(100, 100, 100)
doc.text(`${modulo.cantidadPotreros} potrero${modulo.cantidadPotreros !== 1 ? 's' : ''} | ${modulo.hectareas.toFixed(0)} ha | ${modulo.ugPorHa.toFixed(2)} UG/ha`, margin, startY)

startY += 5

        const catBov = categoriasBovinas
  .sort((a, b) => {
    const orden = [
      'Vacas gordas', 'Vacas', 'Vaquillonas +2', 'Vaquillonas 1-2', 
      'Terneras', 'Terneros', 'Terneros nacidos', 'Toros', 
      'Nov 1-2', 'Nov 2-3', 'Nov +3'
    ];
    const nombreA = a.nombre.replace(' años', '').replace(' año', '');
    const nombreB = b.nombre.replace(' años', '').replace(' año', '');
    return orden.indexOf(nombreA) - orden.indexOf(nombreB);
  })
  .filter(cat => modulo.potreros.some((p: any) => (p.animalesPorCategoria[cat.nombre] || 0) > 0))
        const catOvi = categoriasOvinas.filter(cat => modulo.potreros.some((p: any) => (p.animalesPorCategoria[cat.nombre] || 0) > 0))
        const catEqu = categoriasEquinas.filter(cat => modulo.potreros.some((p: any) => (p.animalesPorCategoria[cat.nombre] || 0) > 0))

        // VACUNOS
        if (catBov.length > 0) {
          const headers = ['Potrero', 'Ha', ...catBov.map(c => limpiarNombreCategoria(c.nombre)), 'Total', 'UG/Ha']
          const tieneTermerosNacidos = modulo.potreros.some((p: any) => 
  (p.animalesPorCategoria['Terneros nacidos'] || 0) > 0
);

const filaEq = ['UG x Cat', '', ...catBov.map(c => {
  if (c.nombre === 'Vacas' && tieneTermerosNacidos) {
    return `${c.equivalenciaUG.toFixed(2)} (+0.20 con ter.nac.)`;
  }
  return c.equivalenciaUG.toFixed(2);
}), '', '']
          const filasDatos = modulo.potreros.map((p: any) => [p.nombre, p.hectareas.toFixed(0), ...catBov.map(c => { const cant = p.animalesPorCategoria[c.nombre] || 0; return cant > 0 ? cant.toString() : '' }), p.vacunosTotales.toString(), p.ugPorHa.toFixed(2)])
          const totMod = { ha: modulo.potreros.reduce((s: number, p: any) => s + p.hectareas, 0), vac: modulo.potreros.reduce((s: number, p: any) => s + p.vacunosTotales, 0), cat: {} as Record<string, number> }
          catBov.forEach(c => { totMod.cat[c.nombre] = modulo.potreros.reduce((s: number, p: any) => s + (p.animalesPorCategoria[c.nombre] || 0), 0) })
          const filaTot = ['TOTAL', totMod.ha.toFixed(0), ...catBov.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''), totMod.vac.toString(), modulo.ugPorHa.toFixed(2)]

          autoTable(doc, {
            head: [headers, filaEq], body: [...filasDatos, filaTot], startY, theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
            columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
            didParseCell: function(cellData: any) {
              if (cellData.section === 'head' && cellData.row.index === 1) { cellData.cell.styles.fillColor = [255, 255, 200]; cellData.cell.styles.fontStyle = 'normal' }
              if (cellData.section === 'body' && cellData.row.index === filasDatos.length) { cellData.cell.styles.fillColor = [200, 255, 200]; cellData.cell.styles.fontStyle = 'bold' }
              if (cellData.section === 'body' && cellData.column.index === headers.length - 1) {
                const valor = parseFloat(cellData.cell.raw) || 0
                if (valor === 0) cellData.cell.styles.textColor = [150, 150, 150]
                else if (valor < 0.7) cellData.cell.styles.textColor = [0, 100, 200]
                else if (valor <= 1.5) cellData.cell.styles.textColor = [0, 150, 0]
                else if (valor <= 2.0) cellData.cell.styles.textColor = [200, 150, 0]
                else cellData.cell.styles.textColor = [200, 0, 0]
              }
            },
            margin: { left: margin, right: margin }
          })
          startY = (doc as any).lastAutoTable.finalY + 3
        }

        // OVINOS
        if (catOvi.length > 0) {
          if (startY > pageHeight - 40) { doc.addPage(); dibujarMarcaAgua(); startY = 20 }
          const headers = ['Potrero', 'Ha', ...catOvi.map(c => c.nombre), 'Total']
          const filaEq = ['UG x Cat', '', ...catOvi.map(c => c.equivalenciaUG.toFixed(2)), '']
          const filasDatos = modulo.potreros.map((p: any) => [p.nombre, p.hectareas.toFixed(0), ...catOvi.map(c => { const cant = p.animalesPorCategoria[c.nombre] || 0; return cant > 0 ? cant.toString() : '' }), p.ovinosTotales.toString()])
          const totMod = { ha: modulo.potreros.reduce((s: number, p: any) => s + p.hectareas, 0), ovi: modulo.potreros.reduce((s: number, p: any) => s + p.ovinosTotales, 0), cat: {} as Record<string, number> }
          catOvi.forEach(c => { totMod.cat[c.nombre] = modulo.potreros.reduce((s: number, p: any) => s + (p.animalesPorCategoria[c.nombre] || 0), 0) })
          const filaTot = ['TOTAL', totMod.ha.toFixed(0), ...catOvi.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''), totMod.ovi.toString()]

          doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80); doc.text('Ovinos:', margin, startY); startY += 3

          autoTable(doc, {
            head: [headers, filaEq], body: [...filasDatos, filaTot], startY, theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [220, 235, 245], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
            columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
            didParseCell: function(cellData: any) {
              if (cellData.section === 'head' && cellData.row.index === 1) { cellData.cell.styles.fillColor = [235, 245, 255]; cellData.cell.styles.fontStyle = 'normal' }
              if (cellData.section === 'body' && cellData.row.index === filasDatos.length) { cellData.cell.styles.fillColor = [200, 255, 200]; cellData.cell.styles.fontStyle = 'bold' }
            },
            margin: { left: margin, right: margin }
          })
          startY = (doc as any).lastAutoTable.finalY + 3
        }

        // EQUINOS
        if (catEqu.length > 0) {
          if (startY > pageHeight - 40) { doc.addPage(); dibujarMarcaAgua(); startY = 20 }
          const headers = ['Potrero', 'Ha', ...catEqu.map(c => c.nombre), 'Total']
          const filaEq = ['UG x Cat', '', ...catEqu.map(c => c.equivalenciaUG.toFixed(2)), '']
          const filasDatos = modulo.potreros.map((p: any) => [p.nombre, p.hectareas.toFixed(0), ...catEqu.map(c => { const cant = p.animalesPorCategoria[c.nombre] || 0; return cant > 0 ? cant.toString() : '' }), p.equinosTotales.toString()])
          const totMod = { ha: modulo.potreros.reduce((s: number, p: any) => s + p.hectareas, 0), equ: modulo.potreros.reduce((s: number, p: any) => s + p.equinosTotales, 0), cat: {} as Record<string, number> }
          catEqu.forEach(c => { totMod.cat[c.nombre] = modulo.potreros.reduce((s: number, p: any) => s + (p.animalesPorCategoria[c.nombre] || 0), 0) })
          const filaTot = ['TOTAL', totMod.ha.toFixed(0), ...catEqu.map(c => totMod.cat[c.nombre] > 0 ? totMod.cat[c.nombre].toString() : ''), totMod.equ.toString()]

          doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80); doc.text('Equinos:', margin, startY); startY += 3

          autoTable(doc, {
            head: [headers, filaEq], body: [...filasDatos, filaTot], startY, theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [245, 235, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
            columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 10 } },
            didParseCell: function(cellData: any) {
              if (cellData.section === 'head' && cellData.row.index === 1) { cellData.cell.styles.fillColor = [255, 245, 230]; cellData.cell.styles.fontStyle = 'normal' }
              if (cellData.section === 'body' && cellData.row.index === filasDatos.length) { cellData.cell.styles.fillColor = [200, 255, 200]; cellData.cell.styles.fontStyle = 'bold' }
            },
            margin: { left: margin, right: margin }
          })
          startY = (doc as any).lastAutoTable.finalY + 3
        }

        return startY + 8
      }

      for (const modulo of modulosData) { currentY = generarTablaModulo(modulo, currentY) }
      if (restoDelCampo && restoDelCampo.potreros.length > 0) { currentY = generarTablaModulo(restoDelCampo, currentY) }

      if (currentY > pageHeight - 15) { doc.addPage(); dibujarMarcaAgua(); currentY = 20 }
      doc.setFontSize(8); doc.setTextColor(128, 128, 128); doc.text('Generado por Bot Rural - botrural.vercel.app', margin, currentY + 5)

    } else {
      // ========== FORMATO ORIGINAL SIN MÓDULOS ==========
      const lotes = await prisma.lote.findMany({ where: { campoId, esPastoreable: true }, include: { animalesLote: true }, orderBy: { nombre: 'asc' } })
      const potrerosData = lotes.map(procesarPotrero)

      const totalesPorCategoria: Record<string, number> = {}
      categoriasDB.forEach(c => { totalesPorCategoria[c.nombreSingular] = 0 })
      potrerosData.forEach(p => { for (const [cat, cant] of Object.entries(p.animalesPorCategoria)) { if (totalesPorCategoria[cat] !== undefined) totalesPorCategoria[cat] += cant } })

      const totalHectareas = potrerosData.reduce((s, p) => s + p.hectareas, 0)
      const totalUG = potrerosData.reduce((s, p) => s + p.ugTotales, 0)
      const totalVacunos = potrerosData.reduce((s, p) => s + p.vacunosTotales, 0)
      const totalOvinos = potrerosData.reduce((s, p) => s + p.ovinosTotales, 0)
      const ugPorHaGlobal = totalHectareas > 0 ? totalUG / totalHectareas : 0

      // Header
      doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold')
      doc.text(`Establecimiento: ${campo.nombre}`, margin, 15)
      doc.setFontSize(12); doc.setFont('helvetica', 'normal')
      doc.text(`TOTAL UG/ha: ${ugPorHaGlobal.toFixed(2)}`, pageWidth - margin - 50, 15)
      const fecha = new Date()
      doc.setFontSize(10)
      doc.text(`Generado: ${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - margin - 50, 22)

      // VACUNOS
      const catBovFiltradas = categoriasBovinas
  .sort((a, b) => {
    const orden = [
      'Vacas gordas', 'Vacas', 'Vaquillonas +2', 'Vaquillonas 1-2', 
      'Terneras', 'Terneros', 'Terneros nacidos', 'Toros', 
      'Nov 1-2', 'Nov 2-3', 'Nov +3'
    ];
    const nombreA = a.nombre.replace(' años', '').replace(' año', '');
    const nombreB = b.nombre.replace(' años', '').replace(' año', '');
    return orden.indexOf(nombreA) - orden.indexOf(nombreB);
  })
  .filter(c => totalesPorCategoria[c.nombre] > 0)
      const headersBovinos = ['Potreros', 'Ha', ...catBovFiltradas.map(c => limpiarNombreCategoria(c.nombre)), 'Total Vacunos', 'UG/Ha (Vac+Ovi+Equ)']
      const tieneTermerosNacidosOriginal = potrerosData.some(p => 
  (p.animalesPorCategoria['Terneros nacidos'] || 0) > 0
);

const filaEquivalenciasBovinos = ['UG x Categoría', '', ...catBovFiltradas.map(c => {
  if (c.nombre === 'Vacas' && tieneTermerosNacidosOriginal) {
    return `${c.equivalenciaUG.toFixed(2)} (+0.20 con ter.nac.)`;
  }
  return c.equivalenciaUG.toFixed(2);
}), '', '']
      const filasDatosBovinos = potrerosData.map(p => [p.nombre, p.hectareas.toFixed(0), ...catBovFiltradas.map(c => { const cant = p.animalesPorCategoria[c.nombre] || 0; return cant > 0 ? cant.toString() : '' }), p.vacunosTotales.toString(), p.ugPorHa.toFixed(2)])
      const filaTotalesBovinos = ['TOTAL:', totalHectareas.toFixed(0), ...catBovFiltradas.map(c => { const total = totalesPorCategoria[c.nombre] || 0; return total > 0 ? total.toString() : '' }), totalVacunos.toString(), ugPorHaGlobal.toFixed(2)]

      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('VACUNOS', margin, 30)

      autoTable(doc, {
        head: [headersBovinos, filaEquivalenciasBovinos], body: [...filasDatosBovinos, filaTotalesBovinos], startY: 35, theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
        columnStyles: { 0: { halign: 'left', cellWidth: 25 }, 1: { cellWidth: 12 } },
        didParseCell: function(data: any) {
          if (data.section === 'head' && data.row.index === 1) { data.cell.styles.fillColor = [255, 255, 200]; data.cell.styles.fontStyle = 'normal' }
          if (data.section === 'body' && data.row.index === filasDatosBovinos.length) { data.cell.styles.fillColor = [200, 255, 200]; data.cell.styles.fontStyle = 'bold' }
          if (data.section === 'body' && data.column.index === headersBovinos.length - 1) {
            const valor = parseFloat(data.cell.raw) || 0
            if (valor === 0) data.cell.styles.textColor = [150, 150, 150]
            else if (valor < 0.7) data.cell.styles.textColor = [0, 100, 200]
            else if (valor <= 1.5) data.cell.styles.textColor = [0, 150, 0]
            else if (valor <= 2.0) data.cell.styles.textColor = [200, 150, 0]
            else data.cell.styles.textColor = [200, 0, 0]
          }
        },
        didDrawPage: function() { dibujarMarcaAgua() },
        margin: { left: margin, right: margin }
      })

      // OVINOS
      const catOviFiltradas = categoriasOvinas.filter(c => totalesPorCategoria[c.nombre] > 0)
      if (catOviFiltradas.length > 0) {
        const headersOvinos = ['Potreros', 'Ha', ...catOviFiltradas.map(c => c.nombre), 'Total Ovinos']
        const filaEquivalenciasOvinos = ['UG x Categoría', '', ...catOviFiltradas.map(c => c.equivalenciaUG.toFixed(2)), '']
        const filasDatosOvinos = potrerosData.map(p => [p.nombre, p.hectareas.toFixed(0), ...catOviFiltradas.map(c => { const cant = p.animalesPorCategoria[c.nombre] || 0; return cant > 0 ? cant.toString() : '' }), p.ovinosTotales.toString()])
        const filaTotalesOvinos = ['TOTAL:', totalHectareas.toFixed(0), ...catOviFiltradas.map(c => { const total = totalesPorCategoria[c.nombre] || 0; return total > 0 ? total.toString() : '' }), totalOvinos.toString()]

        const startYOvinos = (doc as any).lastAutoTable.finalY + 10
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('OVINOS', margin, startYOvinos)

        autoTable(doc, {
          head: [headersOvinos, filaEquivalenciasOvinos], body: [...filasDatosOvinos, filaTotalesOvinos], startY: startYOvinos + 5, theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [245, 245, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
          columnStyles: { 0: { halign: 'left', cellWidth: 25 }, 1: { cellWidth: 12 } },
          didParseCell: function(data: any) {
            if (data.section === 'head' && data.row.index === 1) { data.cell.styles.fillColor = [255, 255, 200]; data.cell.styles.fontStyle = 'normal' }
            if (data.section === 'body' && data.row.index === filasDatosOvinos.length) { data.cell.styles.fillColor = [200, 255, 200]; data.cell.styles.fontStyle = 'bold' }
          },
          didDrawPage: function() { dibujarMarcaAgua() },
          margin: { left: margin, right: margin }
        })
      }

      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(8); doc.setTextColor(128, 128, 128); doc.text('Generado por Bot Rural - botrural.vercel.app', margin, finalY)
    }

    return Buffer.from(doc.output('arraybuffer'))
  } catch (error) {
    console.error('❌ Error generando PDF:', error)
    return null
  }
}

/**
 * Sube el PDF a Supabase Storage y retorna la URL pública
 */
async function subirPDFaSupabase(pdfBuffer: Buffer, nombreCampo: string): Promise<string | null> {
  try {
    const fecha = new Date().toISOString().split('T')[0]
    const nombreArchivo = `reportes/carga_${nombreCampo.replace(/\s+/g, '_')}_${fecha}_${Date.now()}.pdf`

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      })

    if (error) {
      console.error('❌ Error subiendo PDF a Supabase:', error)
      return null
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(nombreArchivo)

    console.log('✅ PDF subido a Supabase:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('❌ Error en subirPDFaSupabase:', error)
    return null
  }
}

/**
 * Handler principal: genera y envía el PDF de carga actual por WhatsApp
 */
export async function handleReporteCarga(telefono: string) {
  try {
    // 1. Obtener usuario y campo
    const usuario = await prisma.user.findUnique({
      where: { telefono },
      include: { campo: true }
    })

    if (!usuario?.campoId || !usuario.campo) {
      await sendWhatsAppMessage(
        telefono,
        "❌ No tenés un campo configurado. Configuralo primero desde la web."
      )
      return
    }

    await sendWhatsAppMessage(
      telefono,
      "⏳ Generando PDF de carga actual... Un momento."
    )

    // 2. Generar el PDF
    const pdfBuffer = await generarPDFCarga(usuario.campoId)

    if (!pdfBuffer) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error generando el PDF. Intentá de nuevo más tarde."
      )
      return
    }

    // 3. Subir a Supabase
    const pdfUrl = await subirPDFaSupabase(pdfBuffer, usuario.campo.nombre)

    if (!pdfUrl) {
      await sendWhatsAppMessage(
        telefono,
        "❌ Error subiendo el archivo. Intentá de nuevo más tarde."
      )
      return
    }

    // 4. Enviar el PDF por WhatsApp
    const fecha = new Date().toLocaleDateString('es-UY', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
    
    const nombreArchivo = `Carga_${usuario.campo.nombre.replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`
    
    await sendWhatsAppDocument(
      telefono,
      pdfUrl,
      nombreArchivo,
      `📊 Reporte de Carga Actual - ${usuario.campo.nombre}\n📅 ${fecha}`
    )

    console.log(`✅ PDF de carga enviado a ${telefono}`)

  } catch (error) {
    console.error("❌ Error en handleReporteCarga:", error)
    await sendWhatsAppMessage(
      telefono,
      "❌ Hubo un error generando el reporte. Intentá de nuevo más tarde."
    )
  }
}