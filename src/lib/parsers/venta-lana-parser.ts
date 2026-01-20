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

CONTEXTO:
- Estas facturas son de venta de lana esquilada
- El PRODUCTOR/VENDEDOR vende la lana a un COMPRADOR
- NO hay cantidad de animales, solo PESO en kg
- Puede haber un CONSIGNATARIO (intermediario como ROMUALDO, etc.)

ESTRUCTURA TÍPICA:
- Header: Logo del consignatario
- Fecha, Nº Factura
- RUT COMPRADOR + nombre del comprador
- Productor/Vendedor (puede estar en header o sección específica)
- Tabla con categorías de lana:
  * LANA VELLÓN
  * LANA BARRIGA
  * LANA BARRIGUERA
  * AJUSTE BARRIGA
  * Etc.
- Cada renglón tiene: Categoría, Peso (kg), Precio, Importe
- Totales: Subtotal, Impuestos (IMEBA, MEVIR, INIA), Total Neto

⚠️⚠️⚠️ ESTRUCTURA DE TABLA - LECTURA CRÍTICA DE COLUMNAS ⚠️⚠️⚠️

La tabla tiene MÚLTIPLES columnas numéricas. Es CRÍTICO identificar correctamente cada una:

ESTRUCTURA REAL DE COLUMNAS (de izquierda → derecha):
┌─────────────┬────────┬────────┬─────────────┬──────────────┐
│ CATEGORIA   │ P.NETO │ P.PROM │ PREC.POR... │ IMPORTE      │
├─────────────┼────────┼────────┼─────────────┼──────────────┤
│ LANA VELLÓN │ 9,271  │  0,00  │  58,000.00  │  53.771,80   │ ← USAR 53.771,80
│ LANA BARRIGA│ 1,030  │  0,00  │  10,000.00  │   1.030,00   │ ← USAR 1.030,00
└─────────────┴────────┴────────┴─────────────┴──────────────┘

COLUMNAS EXPLICADAS:
1. CATEGORIA: tipo de lana (LANA VELLÓN, LANA BARRIGA, etc.)
2. P.NETO: peso neto en kilogramos
3. P.PROM: precio promedio por kg (generalmente 0,00)
4. PREC.POR... o columna sin nombre: valores grandes (IGNORAR ESTA COLUMNA)
5. IMPORTE: ⭐ ÚLTIMA COLUMNA - IMPORTE BRUTO REAL (LA CORRECTA) ⭐

⚠️ REGLA CRÍTICA PARA importeBrutoUSD:
- SIEMPRE usar la ÚLTIMA columna numérica de la tabla
- Esta columna puede llamarse "IMPORTE" o "PREC. PRODUCTO" o estar sin nombre
- NO usar la columna "PREC.POR..." que tiene valores grandes
- Buscar visualmente la columna MÁS A LA DERECHA con valores monetarios

EJEMPLOS DE LECTURA CORRECTA:
❌ INCORRECTO: LANA VELLÓN → usar 58,000.00 (columna del medio)
✅ CORRECTO: LANA VELLÓN → usar 53.771,80 (última columna)

❌ INCORRECTO: LANA BARRIGA → usar 10,000.00 (columna del medio)
✅ CORRECTO: LANA BARRIGA → usar 1.030,00 (última columna)

====== EXTRACCIÓN DE DATOS ======

1. IDENTIFICAR ROLES:
   - RUT COMPRADOR: empresa que COMPRA la lana
   - Productor/Vendedor: quien VENDE la lana (puede estar en sección separada o header)
   - Consignatario: intermediario (logo de la empresa, ej: ROMUALDO & CIA)

2. EXTRAER CADA RENGLÓN DE LANA:
   ⚠️ IMPORTANTE: Solo extraer renglones de LANA, NO otras líneas
   
   Para cada categoría:
   - categoria: nombre exacto ("LANA VELLÓN", "LANA BARRIGA", etc.)
     Normalizar a: "Vellón", "Barriga", "Barriguera", "Pedacería", "Ajuste Barriga"
   
   - pesoKg: peso en kilogramos (columna P.NETO)
     CONVERSIÓN DE FORMATO:
     * 9,271 → 9271
     * 1,030 → 1030
     * 685 → 685
   
   - importeBrutoUSD: ⭐ CRÍTICO - SIEMPRE la ÚLTIMA columna de la tabla ⭐
     NO usar columnas intermedias como PREC.POR...
     CONVERSIÓN DE FORMATO:
     * 53.771,80 → 53771.8
     * 1.030,00 → 1030.0
     * 98.000,00 → 98000.0
   
   - precioKgUSD: precio por kg
     ⚠️ Si P.PROM está en 0,00, DEBES CALCULAR:
        precioKgUSD = importeBrutoUSD / pesoKg
     EJEMPLOS:
     * VELLÓN: 53.771,80 / 9.271 = 5.80 USD/kg
     * BARRIGA: 1.030,00 / 1.030 = 1.00 USD/kg
     NUNCA dejes precioKgUSD en 0.00
     NUNCA inventes precios si no puedes calcularlos

3. TOTALES:
   - subtotalUSD: suma de todos los importeBrutoUSD (columna IMPORTE)
   - impuestos: extraer IMEBA, MEVIR, INIA de "TOTAL DE GASTOS"
   - totalNetoUSD: buscar "TOTAL:" o el valor final en la factura

4. CONDICIONES DE PAGO:
   - Si hay "VENCIMIENTO:" → es Plazo, extraer fecha y calcular días desde fecha factura
   - Si no hay vencimiento → Contado

====== CATEGORÍAS COMUNES DE LANA ======
- LANA VELLÓN → "Vellón"
- LANA BARRIGA → "Barriga"
- LANA BARRIGUERA → "Barriguera"
- AJUSTE BARRIGA → "Ajuste Barriga"
- PEDACERÍA → "Pedacería"

====== IMPUESTOS TÍPICOS ======
En facturas de lana aparecen como descuentos en "TOTAL DE GASTOS":
- IMEBA: ~1-2%
- MEVIR: ~0.2%
- INIA: ~0.4%

====== VALIDACIONES ======
- pesoTotalKg debe ser la suma de todos los pesoKg de renglones
- subtotalUSD debe ser la suma de todos los importeBrutoUSD
- totalNetoUSD = subtotalUSD - totalImpuestosUSD
- El comprador y el productor NO pueden ser la misma persona
- Si precioKgUSD es 0, DEBES calcularlo: importeBrutoUSD / pesoKg

RESPONDE SOLO JSON (sin markdown ni explicaciones):
{
  "tipo": "VENTA",
  "tipoProducto": "LANA",
  "comprador": "MENGHI, Juan Diego y Luisiana",
  "compradorDireccion": "Asencio 209, Salto",
  "productor": "ESTANCIAS PURRO S.A.",
  "productorRut": "160377440019",
  "rutEmisor": "160377440019",
  "consignatario": "ROMUALDO & CIA",
  "consignatarioRut": "211234567890",
  "fecha": "2024-12-04",
  "nroFactura": "A-022502",
  "renglones": [
    {
      "tipo": "LANA",
      "categoria": "Vellón",
      "pesoKg": 9271,
      "precioKgUSD": 5.80,
      "importeBrutoUSD": 53771.8
    },
    {
      "tipo": "LANA",
      "categoria": "Barriga",
      "pesoKg": 1030,
      "precioKgUSD": 1.00,
      "importeBrutoUSD": 1030.0
    }
  ],
  "pesoTotalKg": 10301,
  "subtotalUSD": 54801.8,
  "impuestos": {
    "imeba": 1328.85,
    "mevir": 106.31,
    "inia": 212.42
  },
  "totalImpuestosUSD": 1647.58,
  "totalNetoUSD": 53154.22,
  "metodoPago": "Plazo",
  "diasPlazo": 122,
  "fechaVencimiento": "2025-04-05"
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

    // Validaciones y correcciones
    console.log("✅ Validando factura de LANA...")

    if (!data.renglones?.length) {
      throw new Error("No se encontraron renglones de lana");
    }

    // Normalizar categorías
    data.renglones = data.renglones.map(r => ({
      ...r,
      categoria: normalizarCategoriaLana(r.categoria)
    }));

    // Validar y recalcular precios si es necesario
    data.renglones = data.renglones.map(r => {
      // Si el precio es 0 o parece incorrecto, recalcular
      const precioCalculado = r.importeBrutoUSD / r.pesoKg;
      
      if (r.precioKgUSD === 0) {
        console.log(`⚠️ Recalculando precio de ${r.categoria}: 0.00 → ${precioCalculado.toFixed(2)}`);
        return { ...r, precioKgUSD: Number(precioCalculado.toFixed(2)) };
      }
      
      // Verificar coherencia (diferencia mayor a 10%)
      const diferenciaPorcentual = Math.abs((r.precioKgUSD - precioCalculado) / precioCalculado);
      if (diferenciaPorcentual > 0.1) {
        console.log(`⚠️ Precio incoherente de ${r.categoria}: ${r.precioKgUSD} → ${precioCalculado.toFixed(2)} (diff: ${(diferenciaPorcentual * 100).toFixed(1)}%)`);
        return { ...r, precioKgUSD: Number(precioCalculado.toFixed(2)) };
      }
      
      return r;
    });

    // Calcular totales si faltan
    if (!data.pesoTotalKg) {
      data.pesoTotalKg = data.renglones.reduce((sum, r) => sum + r.pesoKg, 0);
    }

    if (!data.subtotalUSD) {
      data.subtotalUSD = data.renglones.reduce((sum, r) => sum + r.importeBrutoUSD, 0);
    }

    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = Object.values(data.impuestos).reduce((sum, val) => sum + (val || 0), 0);
    }

    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - (data.totalImpuestosUSD || 0);
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