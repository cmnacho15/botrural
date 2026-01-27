// src/lib/parsers/venta-lana-parser.ts
import OpenAI from "openai";
import { trackOpenAIChat } from "@/lib/ai-usage-tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaLanaRenglonParsed {
  tipo: "LANA";
  categoria: string;
  pesoKg: number;
  precioKgUSD: number;
  importeBrutoUSD: number;
}

export interface ImpuestosVentaLana {
  iva?: number;
  comision?: number;
  imeba?: number;
  inia?: number;
  mevir?: number;
  otros?: number;
  
  otrosDetalle?: {
    concepto: string;
    monto: number;
  }[];
}

export interface ParsedVentaLana {
  tipo: "VENTA";
  tipoProducto: "LANA";
  comprador: string;
  compradorDireccion?: string;
  productor: string;
  productorRut?: string;
  rutEmisor?: string;
  consignatario?: string;
  consignatarioRut?: string;
  fecha: string;
  nroFactura: string;
  renglones: VentaLanaRenglonParsed[];
  pesoTotalKg: number;
  subtotalUSD: number;
  impuestos: ImpuestosVentaLana;
  totalImpuestosUSD: number;
  totalNetoUSD: number;
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
}

export async function processVentaLanaImage(imageUrl: string, campoId?: string, userId?: string): Promise<ParsedVentaLana | null> {
  try {
    // Dividir el prompt en partes para evitar errores de template string largo
    const promptParte1 = `INSTRUCCIÓN CRÍTICA: Debes responder ÚNICAMENTE con un objeto JSON válido. NO incluyas texto explicativo, disculpas, ni markdown.

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
- Tabla con categorías de lana: LANA VELLÓN, LANA BARRIGA, LANA BARRIGUERA, AJUSTE BARRIGA, etc.
- Cada renglón tiene: Categoría, Peso (kg), Precio, Importe
- Totales: TOTAL, COMISION, I.V.A., TOTAL DE GASTOS (IMEBA, MEVIR, INIA), Total final

ESTRUCTURA DE TABLA - LECTURA CRÍTICA DE COLUMNAS:
La tabla tiene MÚLTIPLES columnas numéricas. Es CRÍTICO identificar correctamente cada una:

ESTRUCTURA REAL DE COLUMNAS (de izquierda → derecha):
┌─────────────┬────────┬────────┬─────────────┬──────────────┐
│ CATEGORIA   │ P.NETO │ P.PROM │ PREC.POR... │ IMPORTE      │
├─────────────┼────────┼────────┼─────────────┼──────────────┤
│ LANA VELLÓN │ 4,327  │  0,00  │  58,00000   │  25.098,60   │ ← USAR 25.098,60
│ LANA BARRIGA│   685  │  0,00  │  10,00000   │     685,00   │ ← USAR 685,00
└─────────────┴────────┴────────┴─────────────┴──────────────┘

COLUMNAS EXPLICADAS:
1. CATEGORIA: tipo de lana (LANA VELLÓN, LANA BARRIGA, etc.)
2. P.NETO: peso neto en kilogramos
3. P.PROM: precio promedio por kg (generalmente 0,00)
4. PREC.POR... o columna sin nombre: valores grandes (IGNORAR ESTA COLUMNA)
5. IMPORTE: ⭐ ÚLTIMA COLUMNA - IMPORTE BRUTO REAL (LA CORRECTA) ⭐

REGLA CRÍTICA PARA importeBrutoUSD:
- SIEMPRE usar la ÚLTIMA columna numérica de la tabla
- Esta columna puede llamarse "IMPORTE" o "PREC. PRODUCTO" o estar sin nombre
- NO usar la columna "PREC.POR..." que tiene valores grandes
- Buscar visualmente la columna MÁS A LA DERECHA con valores monetarios

EJEMPLOS DE LECTURA CORRECTA:
❌ INCORRECTO: LANA VELLÓN → usar 58,00000 (columna del medio)
✅ CORRECTO: LANA VELLÓN → usar 25.098,60 (última columna)`;

    const promptParte2 = `
EXTRACCIÓN DE COSTOS COMERCIALES (CRÍTICO):
CLASIFICACIÓN DE COSTOS (SOLO LOS QUE EXISTEN):
1. IVA: "I.V.A." o "IVA" - Impuesto al Valor Agregado (si aparece)
2. Comisión: "COMISION" o "COMISIÓN" - Del consignatario (si aparece)
3. IMEBA: En "TOTAL DE GASTOS" - Impuesto a la Enajenación de Bienes Agropecuarios
4. INIA: En "TOTAL DE GASTOS" - Instituto Nacional de Investigación Agropecuaria
5. MEVIR: En "TOTAL DE GASTOS" - Movimiento para Erradicar la Vivienda Insalubre Rural
6. Otros: TODO lo demás que reste del subtotal y NO esté clasificado arriba

IMPORTANTE: 
- Todos los costos se encuentran DESPUÉS del "TOTAL:" inicial
- Si un campo (como COMISION o I.V.A.) está vacío o en blanco, poner 0
- Guardá el detalle de "otros" en "otrosDetalle" con concepto y monto
- Si NO hay costos comerciales, todos los campos van en 0

SECCIÓN TÍPICA DE COSTOS EN FACTURA:
TOTAL:                    U$S    25.992,60
COMISION:                        (puede estar vacío)
I.V.A.:                          (puede estar vacío)
TOTAL DE GASTOS:
  IMEBA                   U$S      -630,30
  MEVIR                   U$S       -50,42
  INIA                    U$S      -100,85

EXTRACCIÓN DE DATOS:
1. IDENTIFICAR ROLES:
   - RUT COMPRADOR: empresa que COMPRA la lana
   - Productor/Vendedor: quien VENDE la lana (puede estar en sección separada o header)
   - Consignatario: intermediario (logo de la empresa, ej: ROMUALDO & CIA)

2. EXTRAER CADA RENGLÓN DE LANA:
   IMPORTANTE: Solo extraer renglones de LANA, NO otras líneas
   
   Para cada categoría:
   - categoria: nombre exacto ("LANA VELLÓN", "LANA BARRIGA", etc.)
     Normalizar a: "Vellón", "Barriga", "Barriguera", "Pedacería", "Ajuste Barriga"
   
   - pesoKg: peso en kilogramos (columna P.NETO)
     CONVERSIÓN DE FORMATO:
     * 4,327 → 4327
     * 685 → 685
     * 180 → 180
   
   - importeBrutoUSD: CRÍTICO - SIEMPRE la ÚLTIMA columna de la tabla
     NO usar columnas intermedias como PREC.POR...
     CONVERSIÓN DE FORMATO:
     * 25.098,60 → 25098.60
     * 685,00 → 685.00
     * 180,00 → 180.00
   
   - precioKgUSD: precio por kg
     Si P.PROM está en 0,00, DEBES CALCULAR:
        precioKgUSD = importeBrutoUSD / pesoKg
     EJEMPLOS:
     * VELLÓN: 25.098,60 / 4.327 = 5.80 USD/kg
     * BARRIGA: 685,00 / 685 = 1.00 USD/kg
     NUNCA dejes precioKgUSD en 0.00`;

    const promptParte3 = `
3. EXTRAER COSTOS COMERCIALES:
   Buscar después del "TOTAL:" inicial:
   - COMISION: extraer monto (si existe y no está vacío, sino 0)
   - I.V.A.: extraer monto (si existe y no está vacío, sino 0)
   
   En "TOTAL DE GASTOS:" buscar:
   - IMEBA: extraer monto (valor absoluto, sin signo negativo)
   - MEVIR: extraer monto (valor absoluto)
   - INIA: extraer monto (valor absoluto)
   
   Cualquier otro concepto que aparezca va a "otros" con su detalle en "otrosDetalle"

4. TOTALES:
   - subtotalUSD: suma de todos los importeBrutoUSD (columna IMPORTE)
   - totalImpuestosUSD: suma de COMISION + IVA + IMEBA + MEVIR + INIA + otros
   - totalNetoUSD: buscar el monto final en la factura (después de TOTAL DE GASTOS)

5. CONDICIONES DE PAGO:
   - Si hay "VENCIMIENTO:" → es Plazo, extraer fecha y calcular días desde fecha factura
   - Si no hay vencimiento → Contado

CATEGORÍAS COMUNES DE LANA:
- LANA VELLÓN → "Vellón"
- LANA BARRIGA → "Barriga"
- LANA BARRIGUERA → "Barriguera"
- AJUSTE BARRIGA → "Ajuste Barriga"
- PEDACERÍA → "Pedacería"

VALIDACIONES:
- pesoTotalKg debe ser la suma de todos los pesoKg de renglones
- subtotalUSD debe ser la suma de todos los importeBrutoUSD
- totalNetoUSD = subtotalUSD - totalImpuestosUSD
- El comprador y el productor NO pueden ser la misma persona
- Si precioKgUSD es 0, DEBES calcularlo: importeBrutoUSD / pesoKg

RESPONDE SOLO JSON sin markdown.`;

    const systemPrompt = promptParte1 + promptParte2 + promptParte3;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae TODOS los datos de esta factura de venta de lana, incluyendo TODOS los costos comerciales que aparezcan:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.05
    });

    // Trackear uso
    if (userId) {
      trackOpenAIChat(userId, 'VENTA_PARSER', response)
    }

    const content = response.choices[0].message.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr) as ParsedVentaLana;

    console.log("✅ Datos extraídos de factura de lana");
    console.log("📊 Costos comerciales detectados:", data.impuestos);

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
      const precioCalculado = r.importeBrutoUSD / r.pesoKg;
      
      if (r.precioKgUSD === 0) {
        console.log(`⚠️ Recalculando precio de ${r.categoria}: 0.00 → ${precioCalculado.toFixed(2)}`);
        return { ...r, precioKgUSD: Number(precioCalculado.toFixed(2)) };
      }
      
      const diferenciaPorcentual = Math.abs((r.precioKgUSD - precioCalculado) / precioCalculado);
      if (diferenciaPorcentual > 0.1) {
        console.log(`⚠️ Precio incoherente de ${r.categoria}: ${r.precioKgUSD} → ${precioCalculado.toFixed(2)}`);
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
      data.totalImpuestosUSD = 
        (data.impuestos.iva || 0) +
        (data.impuestos.comision || 0) +
        (data.impuestos.imeba || 0) +
        (data.impuestos.inia || 0) +
        (data.impuestos.mevir || 0) +
        (data.impuestos.otros || 0);
    }

    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - data.totalImpuestosUSD;
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

    console.log("✅ Factura de LANA procesada exitosamente");
    console.log(`   Peso total: ${data.pesoTotalKg} kg`);
    console.log(`   Subtotal: $${data.subtotalUSD.toFixed(2)} USD`);
    console.log(`   Costos comerciales: -$${data.totalImpuestosUSD.toFixed(2)} USD`);
    console.log(`   Neto final: $${data.totalNetoUSD.toFixed(2)} USD`);

    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de lana:", error);
    return null;
  }
}

function normalizarCategoriaLana(categoria: string): string {
  const cat = categoria.toUpperCase().trim();
  
  if (cat.includes("VELLÓN") || cat.includes("VELLON")) return "Vellón";
  if (cat.includes("BARRIGA") && !cat.includes("AJUSTE")) return "Barriga";
  if (cat.includes("BARRIGUERA")) return "Barriguera";
  if (cat.includes("AJUSTE") && cat.includes("BARRIGA")) return "Ajuste Barriga";
  if (cat.includes("PEDACERÍA") || cat.includes("PEDACERIA")) return "Pedacería";
  
  return categoria.charAt(0).toUpperCase() + categoria.slice(1).toLowerCase();
}