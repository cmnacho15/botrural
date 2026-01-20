// lib/parsers/venta-ganado-parser.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaGanadoRenglonParsed {
  categoria: string;
  tipoAnimal: string;
  raza: string | null;
  cantidad: number;
  pesoTotalKg: number;
  pesoPromedio: number;
  rendimiento: number | null;
  precioKgUSD: number;
  importeBrutoUSD: number;
  
  // Campos temporales para frigorífico
  pesoTotal2da4ta?: number;
  pesoTotalPie?: number;
  precio2da4ta?: number;
}

export interface ImpuestosVenta {
  mevir?: number;
  inia?: number;
  imeba?: number;
  decreto364_003?: number;
  decreto117_015?: number;
  mgap?: number;
  otros?: number;
}

export interface ParsedVentaGanado {
  tipo: "VENTA";
  tipoProducto: "GANADO";
  
  comprador: string;
  compradorDireccion?: string;
  
  productor: string;
  productorDicose?: string;
  productorRut?: string;
  rutEmisor?: string;
  
  consignatario?: string;
  consignatarioDicose?: string;
  consignatarioRut?: string;
  
  fecha: string;
  nroFactura: string;
  nroTropa: string | null;
  guias?: string;
  
  renglones: VentaGanadoRenglonParsed[];
  
  cantidadTotal: number;
  pesoTotalKg: number;
  subtotalUSD: number;
  
  impuestos: ImpuestosVenta;
  totalImpuestosUSD: number;
  
  totalNetoUSD: number;
  
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
  tipoCambio?: number;
  
  flete?: string;
}

/**
 * Procesar factura de VENTA DE GANADO
 */
export async function processVentaGanadoImage(imageUrl: string, campoId?: string): Promise<ParsedVentaGanado | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `INSTRUCCIÓN CRÍTICA: Debes responder ÚNICAMENTE con un objeto JSON válido. NO incluyas texto explicativo, disculpas, ni markdown. Si no podés extraer los datos, devolvé un JSON con campos vacíos pero SIEMPRE devolvé JSON.

Eres un experto en procesar facturas de venta de GANADO (hacienda) de Uruguay.

CONTEXTO:
- Estas facturas son de frigoríficos que COMPRAN animales a productores
- El PRODUCTOR es quien VENDE sus animales
- El frigorífico es el COMPRADOR
- Puede haber un CONSIGNATARIO (intermediario)

ESTRUCTURA TÍPICA:
- Header: Logo del frigorífico
- TROPA, Fecha, PRODUCTOR, Consignatario
- Tabla de animales con columnas de peso, precio, rendimiento
- Totales: Subtotal, Impuestos, Total Neto

====== TIPOS DE VENTA ======

TIPO A - FRIGORÍFICO:
- Tiene balanzas: "Primera Balanza", "Segunda Balanza" (ovinos) o "4ta Balanza" (bovinos)
- Tiene "Rendimiento"
- Impuestos: MEVIR, INIA, IMEBA

TIPO B - CAMPO A CAMPO:
- NO tiene balanzas
- Precio directo en kg EN PIE
- Puede tener columna "% Destare"

====== EXTRACCIÓN SEGÚN TIPO ======

TIPO A (FRIGORÍFICO):
- Ignorar renglones de "BONIFICACIÓN"
- Solo extraer categorías principales: NOVILLOS, VACAS, OVEJAS, etc.
- Extraer de cada renglón:
  * categoria: nombre del animal
  * tipoAnimal: "OVINO" | "BOVINO" | "EQUINO"
  * cantidad: número de animales
  * pesoTotalPie: peso total en Primera Balanza
  * pesoTotal2da4ta: peso total en Segunda/Cuarta Balanza
  * rendimiento: porcentaje
  * precio2da4ta: precio por kg en balanza post-faena
  * importeBrutoUSD: importe total del renglón

TIPO B (CAMPO A CAMPO):
- Si tiene "% Destare":
  * Aplicar: pesoFinal = pesoOriginal × (1 - %destare/100)
- Extraer:
  * pesoTotalKg: peso total DESTAREADO
  * precioKgUSD: precio/kg (NO aplicar destare al precio)
  * importeBrutoUSD: pesoTotalKg × precioKgUSD

====== ROLES ======
⚠️ CRÍTICO: Nunca comprador y vendedor pueden ser iguales

- rutEmisor: SIEMPRE del RUT VENDEDOR/EMISOR
- productor: nombre asociado al RUT VENDEDOR
- comprador: de la sección "Comprador:"
- consignatario: empresa del logo/header (ej: MEGAAGRO)

RESPONDE SOLO JSON (sin markdown):
{
  "tipo": "VENTA",
  "tipoProducto": "GANADO",
  "comprador": "...",
  "productor": "...",
  "rutEmisor": "...",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "...",
  "renglones": [...],
  "subtotalUSD": 0,
  "totalImpuestosUSD": 0,
  "totalNetoUSD": 0,
  "metodoPago": "Contado"
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae todos los datos de esta factura de venta de ganado:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.05
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr) as ParsedVentaGanado;

    // Validaciones y conversiones (código existente)
    console.log("🔄 Procesando renglones para conversión a datos EN PIE...")
    
    for (let i = 0; i < data.renglones.length; i++) {
      const r = data.renglones[i];
      
      if (r.pesoTotal2da4ta && r.pesoTotalPie && r.precio2da4ta) {
        const importeCalculado = r.pesoTotal2da4ta * r.precio2da4ta;
        r.pesoTotalKg = r.pesoTotalPie;
        r.pesoPromedio = r.pesoTotalPie / r.cantidad;
        r.precioKgUSD = r.importeBrutoUSD / r.pesoTotalPie;
        
        delete (r as any).pesoTotal2da4ta;
        delete (r as any).pesoTotalPie;
        delete (r as any).precio2da4ta;
      }
    }

    // Calcular totales si faltan
    if (!data.cantidadTotal) {
      data.cantidadTotal = data.renglones.reduce((sum, r) => sum + r.cantidad, 0);
    }
    if (!data.pesoTotalKg) {
      data.pesoTotalKg = data.renglones.reduce((sum, r) => sum + r.pesoTotalKg, 0);
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

    data.tipoProducto = "GANADO";
    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de ganado:", error);
    return null;
  }
}