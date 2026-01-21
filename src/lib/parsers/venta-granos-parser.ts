// lib/parsers/venta-granos-parser.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaGranosRenglonParsed {
  tipo: "GRANOS";
  tipoCultivoNombre: string;    // "Trigo", "Soja", "Maíz", etc.
  cantidadToneladas: number;    // 455.256 ton
  precioToneladaUSD: number;    // 182.00 USD/ton
  kgRecibidos: number;          // 466,260.00
  kgDescuentos: number;         // -11,004.52
  kgNetosLiquidar: number;      // 455,255.48
  importeBrutoUSD: number;      // 82,856.50
}

export interface ServicioGrano {
  concepto: string;             // "Secado", "Flete", "Prelimpeza", etc.
  importeUSD: number;           // -1,673.25
}

export interface ImpuestosVentaGranos {
  imeba?: number;
  mevir?: number;
  inia?: number;
  otros?: number;
}

export interface ParsedVentaGranos {
  tipo: "VENTA";
  tipoProducto: "GRANOS";
  
  // Datos del comprador
  comprador: string;
  compradorDireccion?: string;
  
  // Datos del productor (vendedor)
  productor: string;
  productorRut?: string;
  rutEmisor?: string;
  
  // Datos de la operación
  fecha: string;                // "YYYY-MM-DD"
  nroLiquidacion?: string;      // "4152"
  nroContrato?: string;         // "910-NG AGRICULTURA..."
  zafra?: string;               // "2526"
  
  // Renglón único (granos)
  renglones: VentaGranosRenglonParsed[];
  
  // Servicios deducibles
  servicios: ServicioGrano[];
  totalServiciosUSD: number;
  
  // Retenciones
  impuestos: ImpuestosVentaGranos;
  totalImpuestosUSD: number;
  
  // Totales
  subtotalUSD: number;          // Monto bruto
  totalNetoUSD: number;         // Monto final
  
  // Condiciones de pago
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
}

/**
 * Procesar liquidación de VENTA DE GRANOS
 */
export async function processVentaGranosImage(imageUrl: string, campoId?: string): Promise<ParsedVentaGranos | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `INSTRUCCIÓN CRÍTICA: Debes responder ÚNICAMENTE con un objeto JSON válido. NO incluyas texto explicativo, disculpas, ni markdown.

Eres un experto en procesar liquidaciones de VENTA DE GRANOS de Uruguay.

CONTEXTO:
- Estas liquidaciones son de venta de cereales (trigo, soja, maíz, etc.)
- El PRODUCTOR/VENDEDOR vende el grano a un COMPRADOR (acopiador/exportador)
- La liquidación muestra: kg recibidos, descuentos por calidad, kg netos, precio, servicios, retenciones

ESTRUCTURA TÍPICA DE LIQUIDACIÓN:
- Header: Logo del comprador (GRANOSUR, SAMAN, etc.)
- Título: "LIQUIDACIÓN PRODUCTOR - COMPRA DE GRANO"
- Nro. Liquidación, Fecha
- Mercadería: tipo de grano (TRIGO, SOJA, etc.)
- Zafra: año de cosecha
- Comprador: empresa que compra
- Vendedor/Productor: quien vende + RUT
- Nro. Contrato

RESUMEN (datos a extraer):
- Cant. Recibida (kg): cantidad bruta recibida
- Descuentos (kg): por humedad, impurezas, etc. (NEGATIVO)
- Cant. neta a liquidar (kg): cantidad final a pagar
- Precio (US$/tm): precio por tonelada métrica
- Monto bruto (US$): cantidad neta × precio

SERVICIOS (descuentos del monto bruto):
- Secado (US$)
- Prelimpeza (US$)
- Flete (US$)
- DAP-Flete (US$)
- Otros servicios
→ Total servicios (US$)

Monto neto sin retenciones (US$) = Monto bruto - Total servicios

RETENCIONES (descuentos adicionales):
- IMEBA (US$)
- INIA (US$)
- MEVIR (US$)
→ Total retenciones (US$)

Monto final (US$) = Monto neto sin retenciones - Total retenciones

====== EXTRACCIÓN DE DATOS ======

1. IDENTIFICAR ROLES:
   - Comprador: empresa que COMPRA el grano (header/logo)
   - Productor/Vendedor: quien VENDE el grano + RUT

2. EXTRAER DATOS DE LA OPERACIÓN:
   - fecha: formato "YYYY-MM-DD"
   - nroLiquidacion: número de liquidación
   - nroContrato: número de contrato (si existe)
   - zafra: año de cosecha (ej: "2526" para 2025-2026)

3. EXTRAER RENGLÓN DE GRANO:
   ⚠️ CONVERSIÓN CRÍTICA DE FORMATOS:
   
   tipoCultivoNombre: normalizar a capitalizado
   EJEMPLOS:
   * "TRIGO" → "Trigo"
   * "SOJA" → "Soja"
   * "MAÍZ" → "Maíz"
   * "CEBADA" → "Cebada"
   * "GIRASOL" → "Girasol"
   * "SORGO" → "Sorgo"
   
   kgRecibidos: cantidad bruta recibida
   CONVERSIÓN:
   * 466,260.00 → 466260.00
   * 466.260 → 466260.00
   
   kgDescuentos: descuentos por calidad (SIEMPRE NEGATIVO)
   CONVERSIÓN:
   * -11,004.52 → -11004.52
   * 11.004,52 → -11004.52 (agregar signo negativo)
   
   kgNetosLiquidar: kg netos a liquidar
   CONVERSIÓN:
   * 455,255.48 → 455255.48
   * 455.255,48 → 455255.48
   
   cantidadToneladas: convertir kg netos a toneladas
   FÓRMULA: kgNetosLiquidar / 1000
   EJEMPLO: 455,255.48 kg → 455.256 ton
   
   precioToneladaUSD: precio por tonelada métrica
   CONVERSIÓN:
   * 182.00 → 182.00
   * 182,00 → 182.00
   
   importeBrutoUSD: monto bruto
   CONVERSIÓN:
   * 82,856.50 → 82856.50
   * 82.856,50 → 82856.50

4. EXTRAER SERVICIOS:
   Para cada servicio (Secado, Flete, Prelimpeza, etc.):
   {
     concepto: "Secado",
     importeUSD: -1673.25  // SIEMPRE NEGATIVO
   }
   
   CONVERSIÓN DE IMPORTES:
   * -1,673.25 → -1673.25
   * 1.673,25 → -1673.25 (agregar signo negativo si falta)

5. EXTRAER RETENCIONES:
   impuestos: {
     imeba: 65.24,      // sin signo negativo
     inia: 260.98,      // sin signo negativo
     mevir: 130.49      // sin signo negativo
   }
   
   totalImpuestosUSD: suma de todas las retenciones

6. CALCULAR TOTALES:
   subtotalUSD: monto bruto (antes de servicios)
   totalServiciosUSD: suma de todos los servicios (valor absoluto)
   totalNetoUSD: monto final después de todo

7. CONDICIONES DE PAGO:
   - Si no hay fecha de vencimiento → Contado
   - Si hay fecha de vencimiento futura → Plazo

====== TIPOS DE GRANOS COMUNES ======
- Trigo
- Soja
- Maíz
- Cebada
- Girasol
- Sorgo
- Avena
- Arroz

====== SERVICIOS TÍPICOS ======
- Secado
- Prelimpeza
- Flete
- DAP-Flete
- Limpieza
- Zarandeo
- Clasificación

====== RETENCIONES TÍPICAS ======
- IMEBA: ~0.08%
- INIA: ~0.3-0.4%
- MEVIR: ~0.15%

====== VALIDACIONES ======
- kgNetosLiquidar = kgRecibidos + kgDescuentos (descuentos es negativo)
- cantidadToneladas = kgNetosLiquidar / 1000
- importeBrutoUSD ≈ cantidadToneladas × precioToneladaUSD
- totalNetoUSD = subtotalUSD - totalServiciosUSD - totalImpuestosUSD
- El comprador y el productor NO pueden ser la misma entidad

RESPONDE SOLO JSON (sin markdown ni explicaciones):
{
  "tipo": "VENTA",
  "tipoProducto": "GRANOS",
  "comprador": "ROCALMAR SA - GRANOSUR",
  "productor": "NG AGRICULTURA SOCIEDAD RESPONSABILIDAD LIMITADA",
  "productorRut": "130185980013",
  "rutEmisor": "130185980013",
  "fecha": "2025-12-12",
  "nroLiquidacion": "4152",
  "nroContrato": "910-NG AGRICULTURA SOCIEDAD RESPONSABILIDAD LIMITADA-TRIGO-2526",
  "zafra": "2526",
  "renglones": [
    {
      "tipo": "GRANOS",
      "tipoCultivoNombre": "Trigo",
      "kgRecibidos": 466260.00,
      "kgDescuentos": -11004.52,
      "kgNetosLiquidar": 455255.48,
      "cantidadToneladas": 455.256,
      "precioToneladaUSD": 182.00,
      "importeBrutoUSD": 82856.50
    }
  ],
  "servicios": [
    {
      "concepto": "Secado",
      "importeUSD": -1673.25
    },
    {
      "concepto": "Prelimpeza",
      "importeUSD": -1328.30
    },
    {
      "concepto": "Flete",
      "importeUSD": -13987.80
    }
  ],
  "totalServiciosUSD": 16989.35,
  "impuestos": {
    "imeba": 65.24,
    "inia": 260.98,
    "mevir": 130.49
  },
  "totalImpuestosUSD": 456.71,
  "subtotalUSD": 82856.50,
  "totalNetoUSD": 65244.78,
  "metodoPago": "Contado"
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae todos los datos de esta liquidación de venta de granos:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.05
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    // Limpiar markdown
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr) as ParsedVentaGranos;

    // Validaciones y correcciones
    console.log("✅ Validando liquidación de GRANOS...")

    if (!data.renglones?.length) {
      throw new Error("No se encontraron renglones de granos");
    }

    // Normalizar nombre de cultivo
    data.renglones = data.renglones.map(r => ({
      ...r,
      tipoCultivoNombre: normalizarNombreCultivo(r.tipoCultivoNombre)
    }));

    // Validar y recalcular toneladas
    data.renglones = data.renglones.map(r => {
      const toneladasCalculadas = r.kgNetosLiquidar / 1000;
      
      if (Math.abs(r.cantidadToneladas - toneladasCalculadas) > 0.01) {
        console.log(`⚠️ Recalculando toneladas: ${r.cantidadToneladas} → ${toneladasCalculadas.toFixed(3)}`);
        return { ...r, cantidadToneladas: Number(toneladasCalculadas.toFixed(3)) };
      }
      
      return r;
    });

    // Validar que descuentos sean negativos
    data.renglones = data.renglones.map(r => {
      if (r.kgDescuentos > 0) {
        console.log(`⚠️ Corrigiendo signo de descuentos: ${r.kgDescuentos} → ${-r.kgDescuentos}`);
        return { ...r, kgDescuentos: -r.kgDescuentos };
      }
      return r;
    });

    // Validar que servicios sean negativos
    data.servicios = data.servicios.map(s => {
      if (s.importeUSD > 0) {
        console.log(`⚠️ Corrigiendo signo de servicio ${s.concepto}: ${s.importeUSD} → ${-s.importeUSD}`);
        return { ...s, importeUSD: -s.importeUSD };
      }
      return s;
    });

    // Calcular totales si faltan
    if (!data.subtotalUSD && data.renglones.length > 0) {
      data.subtotalUSD = data.renglones.reduce((sum, r) => sum + r.importeBrutoUSD, 0);
    }

    if (!data.totalServiciosUSD) {
      data.totalServiciosUSD = Math.abs(data.servicios.reduce((sum, s) => sum + s.importeUSD, 0));
    }

    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = Object.values(data.impuestos).reduce((sum, val) => sum + (val || 0), 0);
    }

    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - data.totalServiciosUSD - data.totalImpuestosUSD;
    }

    // Validación final
    if (data.productor === data.comprador) {
      throw new Error("El productor y el comprador no pueden ser la misma entidad");
    }

    console.log("✅ Liquidación de GRANOS procesada:", {
      comprador: data.comprador,
      productor: data.productor,
      grano: data.renglones[0].tipoCultivoNombre,
      toneladas: data.renglones[0].cantidadToneladas + " ton",
      totalNeto: data.totalNetoUSD + " USD"
    });

    return data;

  } catch (error) {
    console.error("❌ Error procesando liquidación de granos:", error);
    return null;
  }
}

/**
 * Normalizar nombres de cultivos
 */
function normalizarNombreCultivo(cultivo: string): string {
  const cult = cultivo.toUpperCase().trim();
  
  // Normalizar a formato capitalizado
  if (cult === "TRIGO") return "Trigo";
  if (cult === "SOJA") return "Soja";
  if (cult === "MAÍZ" || cult === "MAIZ") return "Maíz";
  if (cult === "CEBADA") return "Cebada";
  if (cult === "GIRASOL") return "Girasol";
  if (cult === "SORGO") return "Sorgo";
  if (cult === "AVENA") return "Avena";
  if (cult === "ARROZ") return "Arroz";
  
  // Si no reconoce, devolver capitalizado
  return cultivo.charAt(0).toUpperCase() + cultivo.slice(1).toLowerCase();
}