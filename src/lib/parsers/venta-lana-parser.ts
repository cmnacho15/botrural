// lib/parsers/venta-lana-parser.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaLanaRenglonParsed {
  tipo: "LANA";
  categoria: string;        // "Vellón", "Barriga", "Barriguera", "Pedacería"
  pesoKg: number;          // Peso total en kg de esta categoría
  precioKgUSD: number;     // Precio por kg
  importeBrutoUSD: number; // Importe total del renglón
}

export interface ImpuestosVentaLana {
  imeba?: number;
  mevir?: number;
  inia?: number;
  otros?: number;
}

export interface ParsedVentaLana {
  tipo: "VENTA";
  tipoProducto: "LANA";
  
  // Datos del comprador
  comprador: string;
  compradorDireccion?: string;
  
  // Datos del productor (vendedor)
  productor: string;
  productorRut?: string;
  rutEmisor?: string;
  
  // Consignatario (intermediario)
  consignatario?: string;
  consignatarioRut?: string;
  
  // Datos de la operación
  fecha: string;            // "YYYY-MM-DD"
  nroFactura: string;
  
  // Renglones de lana
  renglones: VentaLanaRenglonParsed[];
  
  // Totales
  pesoTotalKg: number;      // Suma de todos los kg
  subtotalUSD: number;      // Suma de importes brutos
  
  // Impuestos
  impuestos: ImpuestosVentaLana;
  totalImpuestosUSD: number;
  
  // Total final
  totalNetoUSD: number;
  
  // Condiciones de pago
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
}

/**
 * Procesar factura de VENTA DE LANA
 */
export async function processVentaLanaImage(imageUrl: string, campoId?: string): Promise<ParsedVentaLana | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `INSTRUCCIÓN CRÍTICA: Debes responder ÚNICAMENTE con un objeto JSON válido. NO incluyas texto explicativo, disculpas, ni markdown.

Eres un experto en procesar facturas de venta de LANA de Uruguay.

⚠️⚠️⚠️ REGLA CRÍTICA DE EXTRACCIÓN ⚠️⚠️⚠️

Para CADA renglón de lana:

1. **PESO (kg):** Lee la columna "P.NETO" o "Kilos"
   Ejemplos: 9.271 → 9271, 1.030 → 1030

2. **IMPORTE TOTAL:** Lee la columna "IMPORTE" (última columna de números grandes)
   ⚠️ CRÍTICO: Este es el número MÁS IMPORTANTE
   Ejemplos: 53.771,80 → 53771.8, 1.030,00 → 1030.0
   
3. **PRECIO/KG:** CALCULA desde el importe, NO leas directamente
   Formula: precioKgUSD = importeBrutoUSD / pesoKg
   Ejemplo: Si importe = 1030 y peso = 1030kg → precio = 1.00/kg
   
⚠️ NO confundir columna "PREC. POR KG" con el precio real

CONTEXTO:
- Estas facturas son de venta de lana esquilada
- El PRODUCTOR/VENDEDOR vende la lana a un COMPRADOR
- NO hay cantidad de animales, solo PESO en kg
- Puede haber CONSIGNATARIO (intermediario como ROMUALDO)

ESTRUCTURA TÍPICA:
- Header: Logo del consignatario
- Fecha, Nº Factura
- RUT COMPRADOR + nombre
- Productor/Vendedor
- Tabla: Categoría, Peso (kg), Precio, Importe
- Totales: Subtotal, Impuestos, Total Neto

====== EXTRACCIÓN ======

Para cada categoría de lana:
- categoria: normalizado ("Vellón", "Barriga", "Barriguera", "Ajuste Barriga")
- pesoKg: de columna P.NETO (ej: 9.271 → 9271)
- importeBrutoUSD: de columna IMPORTE (ej: 53.771,80 → 53771.8)
- precioKgUSD: CALCULAR = importeBrutoUSD / pesoKg

TOTALES:
- subtotalUSD: suma de importeBrutoUSD de todos los renglones
- impuestos: IMEBA, MEVIR, INIA
- totalNetoUSD: subtotalUSD - totalImpuestosUSD

RESPONDE SOLO JSON:
{
  "tipo": "VENTA",
  "tipoProducto": "LANA",
  "comprador": "...",
  "productor": "...",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "...",
  "renglones": [
    {
      "tipo": "LANA",
      "categoria": "Vellón",
      "pesoKg": 9271,
      "precioKgUSD": 5.80,
      "importeBrutoUSD": 53771.8
    }
  ],
  "pesoTotalKg": 10301,
  "subtotalUSD": 54801.8,
  "totalImpuestosUSD": 1647.78,
  "totalNetoUSD": 53154.02,
  "metodoPago": "Plazo"
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae todos los datos de esta factura de venta de lana:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.05
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    // Limpiar markdown
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr) as ParsedVentaLana;

    // Validaciones
    console.log("✅ Validando factura de LANA...")

    if (!data.renglones?.length) {
      throw new Error("No se encontraron renglones de lana");
    }

    // ✅ VALIDACIÓN CRÍTICA: Recalcular totales desde renglones
    console.log("🔍 Validando y recalculando totales...")

    // 1. Recalcular precio/kg desde importe (por si GPT lo leyó mal)
    data.renglones = data.renglones.map(r => {
      const precioCalculado = r.importeBrutoUSD / r.pesoKg
      
      // Si el precio calculado difiere mucho del parseado, usar el calculado
      if (Math.abs(precioCalculado - r.precioKgUSD) > 0.5) {
        console.warn(`⚠️ ${r.categoria}: Precio parseado ($${r.precioKgUSD}/kg) difiere del calculado ($${precioCalculado.toFixed(2)}/kg). Usando calculado.`)
        r.precioKgUSD = precioCalculado
      }
      
      return r
    })

    // 2. Recalcular subtotal desde suma de importes
    const subtotalCalculado = data.renglones.reduce((sum, r) => sum + r.importeBrutoUSD, 0)

    if (Math.abs(subtotalCalculado - data.subtotalUSD) > 1) {
      console.warn(`⚠️ Subtotal parseado ($${data.subtotalUSD}) difiere del calculado ($${subtotalCalculado.toFixed(2)}). Usando calculado.`)
      data.subtotalUSD = subtotalCalculado
    }

    // 3. Recalcular total neto
    const totalNetoCalculado = data.subtotalUSD - data.totalImpuestosUSD

    if (Math.abs(totalNetoCalculado - data.totalNetoUSD) > 1) {
      console.warn(`⚠️ Total neto parseado ($${data.totalNetoUSD}) difiere del calculado ($${totalNetoCalculado.toFixed(2)}). Usando calculado.`)
      data.totalNetoUSD = totalNetoCalculado
    }

    console.log("✅ Totales validados:", {
      subtotal: data.subtotalUSD.toFixed(2),
      impuestos: data.totalImpuestosUSD.toFixed(2),
      totalNeto: data.totalNetoUSD.toFixed(2)
    })

    // Normalizar categorías
    data.renglones = data.renglones.map(r => ({
      ...r,
      categoria: normalizarCategoriaLana(r.categoria)
    }));

    // Calcular totales si faltan
    if (!data.pesoTotalKg) {
      data.pesoTotalKg = data.renglones.reduce((sum, r) => sum + r.pesoKg, 0);
    }

    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = Object.values(data.impuestos).reduce((sum, val) => sum + (val || 0), 0);
    }

    // Calcular método de pago
    if (data.fechaVencimiento) {
      const fechaFactura = new Date(data.fecha + 'T12:00:00Z');
      const fechaVenc = new Date(data.fechaVencimiento + 'T12:00:00Z');
      const diffMs = fechaVenc.getTime() - fechaFactura.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDias > 7) {
        data.metodoPago = "Plazo";
        data.diasPlazo = diffDias;
        console.log(`💳 LANA - Plazo: ${diffDias} días`);
      } else {
        data.metodoPago = "Contado";
      }
    } else {
      data.metodoPago = data.metodoPago || "Contado";
    }

    // Validación final
    if (data.productor === data.comprador) {
      throw new Error("El productor y el comprador no pueden ser la misma entidad");
    }

    console.log("✅ Factura de LANA procesada:", {
      comprador: data.comprador,
      productor: data.productor,
      renglones: data.renglones.length,
      pesoTotal: data.pesoTotalKg + " kg",
      totalNeto: data.totalNetoUSD + " USD"
    });

    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de lana:", error);
    return null;
  }
}

/**
 * Normalizar nombres de categorías de lana
 */
function normalizarCategoriaLana(categoria: string): string {
  const cat = categoria.toUpperCase().trim();
  
  if (cat.includes("VELLÓN") || cat.includes("VELLON")) return "Vellón";
  if (cat.includes("BARRIGA") && !cat.includes("AJUSTE")) return "Barriga";
  if (cat.includes("BARRIGUERA")) return "Barriguera";
  if (cat.includes("AJUSTE") && cat.includes("BARRIGA")) return "Ajuste Barriga";
  if (cat.includes("PEDACERÍA") || cat.includes("PEDACERIA")) return "Pedacería";
  
  // Si no reconoce, devolver capitalizado
  return categoria.charAt(0).toUpperCase() + categoria.slice(1).toLowerCase();
}