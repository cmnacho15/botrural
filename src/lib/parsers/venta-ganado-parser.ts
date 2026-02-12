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
  esBonificacion?: boolean; // true si es bonificación/descuento

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
⚠️ CRÍTICO: EXTRAER TODOS LOS RENGLONES incluyendo BONIFICACIONES/DESCUENTOS
- Extraer categorías principales: NOVILLOS, VACAS, OVEJAS, etc.
- Extraer BONIFICACIONES como renglones separados (ver instrucciones abajo)
- De cada renglón PRINCIPAL extraer:
  * categoria: nombre del animal
  * tipoAnimal: "OVINO" | "BOVINO" | "EQUINO"
  * cantidad: número de animales
  * pesoTotalPie: peso total EN PIE (columna "Kgs. en pie" o "Primera Balanza") - OBLIGATORIO
  * pesoTotal2da4ta: peso total en Segunda/Cuarta Balanza - OBLIGATORIO
  * rendimiento: porcentaje - OBLIGATORIO
  * precio2da4ta: precio por kg en balanza post-faena (columna "Precio") - OBLIGATORIO
  * importeBrutoUSD: importe total del renglón

⚠️ BONIFICACIONES/DESCUENTOS:
- Si hay renglones como "BONIFICACIÓN", "DESCUENTO", "BONIF.", etc.
- Extraerlos como renglones separados con:
  * categoria: texto completo (ej: "BONIFICACIÓN VACA ECO")
  * tipoAnimal: mismo que el renglón principal
  * cantidad: 0 (o copiar del renglón principal si aplica)
  * pesoTotalPie: 0 (o copiar del renglón principal si usa el mismo peso)
  * pesoTotal2da4ta: peso si está en la factura, sino 0
  * rendimiento: null
  * precio2da4ta: precio de la bonificación (puede ser positivo o negativo)
  * importeBrutoUSD: importe de la bonificación (positivo suma, negativo resta)

TIPO B (CAMPO A CAMPO):
- Si tiene "% Destare":
  * Aplicar: pesoFinal = pesoOriginal × (1 - %destare/100)
- Extraer:
  * pesoTotalKg: peso total DESTAREADO
  * precioKgUSD: precio/kg (NO aplicar destare al precio)
  * importeBrutoUSD: pesoTotalKg × precioKgUSD

====== FECHAS ======
⚠️ CRÍTICO: Extraer fecha EXACTA como aparece en la factura
- Si dice "05/02/2026" → usar "2026-02-05"
- Si dice "23/03/2025" → usar "2025-03-23"
- NO "corregir" fechas que parezcan futuras - usar el año EXACTO que aparece
- Buscar en: "Fecha pesada", "Fecha", "Fecha factura", cabecera del documento

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
      "categoria": "VACA GORDA",
      "tipoAnimal": "BOVINO",
      "raza": "HEREFORD",
      "cantidad": 40,
      "pesoTotalPie": 19130,
      "pesoTotal2da4ta": 9363.80,
      "rendimiento": 48.95,
      "precio2da4ta": 5.10,
      "importeBrutoUSD": 47755.38,
      "esBonificacion": false
    },
    {
      "categoria": "BONIFICACIÓN VACA ECO",
      "tipoAnimal": "BOVINO",
      "raza": null,
      "cantidad": 0,
      "pesoTotalPie": 0,
      "pesoTotal2da4ta": 9363.80,
      "rendimiento": null,
      "precio2da4ta": 0.03,
      "importeBrutoUSD": 280.91,
      "esBonificacion": true
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
        console.log(`    📊 Peso en pie: ${r.pesoTotalPie} kg`);
        console.log(`    📊 Peso 4ta: ${r.pesoTotal2da4ta} kg`);
        console.log(`    📊 Precio 4ta: $${r.precio2da4ta}/kg`);
        console.log(`    📊 Importe: $${r.importeBrutoUSD}`);

        // El importe bruto ya está correcto (precio post-faena × peso post-faena)
        // Ahora calculamos precio EN PIE equivalente
        r.pesoTotalKg = r.pesoTotalPie;
        r.pesoPromedio = r.cantidad > 0 ? r.pesoTotalPie / r.cantidad : 0;
        r.precioKgUSD = r.pesoTotalPie > 0 ? r.importeBrutoUSD / r.pesoTotalPie : 0;

        console.log(`    ✅ Peso EN PIE: ${r.pesoTotalKg.toFixed(2)} kg`);
        console.log(`    ✅ Precio EN PIE equivalente: $${r.precioKgUSD.toFixed(4)}/kg`);

        // Guardar rendimiento antes de limpiar
        r.rendimiento = r.rendimiento || null;

        // Limpiar campos temporales
        delete (r as any).pesoTotal2da4ta;
        delete (r as any).pesoTotalPie;
        delete (r as any).precio2da4ta;
      } else if (r.cantidad > 0) {
        // Si NO tiene datos de frigorífico, es venta campo a campo
        console.log(`  ℹ️  Renglón ${i + 1} (${r.categoria}): Venta campo a campo - datos ya en PIE`);

        // Asegurar que tiene los campos básicos
        if (!r.pesoTotalKg && r.pesoPromedio && r.cantidad) {
          r.pesoTotalKg = r.pesoPromedio * r.cantidad;
        }
        if (!r.pesoPromedio && r.pesoTotalKg && r.cantidad) {
          r.pesoPromedio = r.pesoTotalKg / r.cantidad;
        }
        if (!r.precioKgUSD && r.importeBrutoUSD && r.pesoTotalKg) {
          r.precioKgUSD = r.importeBrutoUSD / r.pesoTotalKg;
        }
      } else {
        // Es una bonificación u otro item sin cantidad de animales
        console.log(`  ℹ️  Renglón ${i + 1} (${r.categoria}): Bonificación/Descuento - $${r.importeBrutoUSD}`);

        // Asegurar valores por defecto
        r.pesoTotalKg = r.pesoTotalKg || 0;
        r.pesoPromedio = 0;
        r.precioKgUSD = 0;
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