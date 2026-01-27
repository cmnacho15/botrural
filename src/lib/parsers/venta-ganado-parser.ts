// src/lib/parsers/venta-ganado-parser.ts
import OpenAI from "openai";
import { trackOpenAIChat } from "@/lib/ai-usage-tracker";

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
  iva?: number;
  imeba?: number;          // Ley 16736
  inia?: number;           // Ley 16065
  mevir?: number;          // Ley 15851
  comision?: number;       // Del consignatario
  otros?: number;          // Suma de todo lo demás
  
  // Detalle de "otros" (opcional, para el contador)
  otrosDetalle?: {
    concepto: string;
    monto: number;
  }[];
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
 * Procesar factura de VENTA DE GANADO con extracción automática de costos comerciales
 */
export async function processVentaGanadoImage(imageUrl: string, campoId?: string, userId?: string): Promise<ParsedVentaGanado | null> {
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
- Impuestos: MEVIR, INIA, IMEBA, D364, Ley 19300, Ley 19355, etc.

TIPO B - CAMPO A CAMPO:
- NO tiene balanzas
- Precio directo en kg EN PIE
- Puede tener columna "% Destare"
- Puede NO tener impuestos, o solo comisión

====== EXTRACCIÓN DE COSTOS COMERCIALES (CRÍTICO) ======

CLASIFICACIÓN DE COSTOS:
1. **IVA**: Si existe impuesto al valor agregado (22% en Uruguay)
2. **IMEBA**: Ley 16736 / A655 (Impuesto a la Enajenación de Bienes Agropecuarios)
3. **INIA**: Ley 16065 (Instituto Nacional de Investigación Agropecuaria)
4. **MEVIR**: Ley 15851 (Movimiento para Erradicar la Vivienda Insalubre Rural)
5. **Comisión**: Del consignatario o intermediario
6. **Otros**: TODO lo demás que reste del subtotal

EJEMPLOS DE "OTROS":
- D364/432/003
- Ley 19300/19438 SCEPB
- Ley 19355 Certif Elec
- Cualquier otro descuento no clasificado arriba

⚠️ IMPORTANTE: 
- Si hay costos/impuestos que NO son IVA, IMEBA, INIA, MEVIR, ni Comisión → van a "otros"
- Guardá el detalle en "otrosDetalle" con concepto y monto
- Si NO hay costos comerciales (venta campo a campo simple), todos los campos van en 0

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
- consignatario: empresa del logo/header (ej: MEGAAGRO, MARFRIG)

====== FORMATO DE RESPUESTA ======

RESPONDE SOLO JSON (sin markdown, sin explicaciones):
{
  "tipo": "VENTA",
  "tipoProducto": "GANADO",
  "comprador": "...",
  "productor": "...",
  "rutEmisor": "...",
  "consignatario": "...",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "...",
  "nroTropa": "...",
  "renglones": [
    {
      "categoria": "NOVILLO GORDO",
      "tipoAnimal": "BOVINO",
      "cantidad": 9,
      "pesoTotalKg": 4520,
      "pesoPromedio": 502,
      "precioKgUSD": 5.25,
      "importeBrutoUSD": 12650.95
    }
  ],
  "cantidadTotal": 9,
  "pesoTotalKg": 4520,
  "subtotalUSD": 84596.10,
  "impuestos": {
    "iva": 0,
    "imeba": 1649.05,
    "inia": 329.81,
    "mevir": 164.90,
    "comision": 0,
    "otros": 490.94,
    "otrosDetalle": [
      {"concepto": "D364/432/003", "monto": 340.62},
      {"concepto": "Ley 19300/19438 SCEPB", "monto": 142.00},
      {"concepto": "Ley 19355 Certif Elec", "monto": 8.32}
    ]
  },
  "totalImpuestosUSD": 2634.70,
  "totalNetoUSD": 81961.40,
  "metodoPago": "Plazo",
  "diasPlazo": 45,
  "fechaVencimiento": "2025-12-15"
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae TODOS los datos de esta factura de venta de ganado, incluyendo TODOS los costos comerciales e impuestos:" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ]
        }
      ],
      max_tokens: 3000,
      temperature: 0.05
    });

    // Trackear uso
    if (userId) {
      trackOpenAIChat(userId, 'VENTA_PARSER', response)
    }

    const content = response.choices[0].message.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonStr) as ParsedVentaGanado;

    console.log("✅ Datos extraídos de factura de ganado");
    console.log("📊 Costos comerciales detectados:", data.impuestos);

    // ====== CONVERSIÓN DE DATOS DE FRIGORÍFICO A EN PIE ======
    console.log("🔄 Procesando renglones para conversión a datos EN PIE...")
    
    for (let i = 0; i < data.renglones.length; i++) {
      const r = data.renglones[i];
      
      // Si tiene datos de balanza post-faena, convertir a EN PIE
      if (r.pesoTotal2da4ta && r.pesoTotalPie && r.precio2da4ta) {
        console.log(`  🔄 Convirtiendo renglón ${i + 1}: ${r.categoria}`);
        
        // El importe bruto ya está correcto (precio post-faena × peso post-faena)
        // Ahora calculamos precio EN PIE equivalente
        r.pesoTotalKg = r.pesoTotalPie;
        r.pesoPromedio = r.pesoTotalPie / r.cantidad;
        r.precioKgUSD = r.importeBrutoUSD / r.pesoTotalPie;
        
        console.log(`    ✅ Peso EN PIE: ${r.pesoTotalKg.toFixed(2)} kg`);
        console.log(`    ✅ Precio EN PIE equivalente: $${r.precioKgUSD.toFixed(4)}/kg`);
        
        // Limpiar campos temporales
        delete (r as any).pesoTotal2da4ta;
        delete (r as any).pesoTotalPie;
        delete (r as any).precio2da4ta;
      }
    }

    // ====== CALCULAR TOTALES SI FALTAN ======
    if (!data.cantidadTotal) {
      data.cantidadTotal = data.renglones.reduce((sum, r) => sum + r.cantidad, 0);
    }
    if (!data.pesoTotalKg) {
      data.pesoTotalKg = data.renglones.reduce((sum, r) => sum + r.pesoTotalKg, 0);
    }
    if (!data.subtotalUSD) {
      data.subtotalUSD = data.renglones.reduce((sum, r) => sum + r.importeBrutoUSD, 0);
    }
    
    // Calcular total de impuestos si falta
    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = 
        (data.impuestos.iva || 0) +
        (data.impuestos.imeba || 0) +
        (data.impuestos.inia || 0) +
        (data.impuestos.mevir || 0) +
        (data.impuestos.comision || 0) +
        (data.impuestos.otros || 0);
    }
    
    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - (data.totalImpuestosUSD || 0);
    }

    // ====== CALCULAR MÉTODO DE PAGO ======
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

    // ====== VALIDACIÓN FINAL ======
    if (data.productor === data.comprador) {
      throw new Error("El productor y el comprador no pueden ser la misma entidad");
    }

    data.tipoProducto = "GANADO";
    
    console.log("✅ Factura de ganado procesada exitosamente");
    console.log(`   Total animales: ${data.cantidadTotal}`);
    console.log(`   Subtotal: $${data.subtotalUSD.toFixed(2)} USD`);
    console.log(`   Costos comerciales: $${data.totalImpuestosUSD.toFixed(2)} USD`);
    console.log(`   Neto: $${data.totalNetoUSD.toFixed(2)} USD`);
    
    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de ganado:", error);
    return null;
  }
}