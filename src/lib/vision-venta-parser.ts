// lib/vision-venta-parser.ts
// Parser especializado para facturas de VENTA de hacienda (frigoríficos)

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VentaRenglonParsed {
  categoria: string;        // "OVEJAS", "CORDEROS DL", "NOVILLOS", etc.
  tipoAnimal: string;       // "OVINO" | "BOVINO" | "EQUINO"
  raza: string | null;      // "GEN S/Clasif", "HEREFORD", etc.
  cantidad: number;         // 130, 300
  pesoTotalKg: number;      // Peso en segunda balanza (2191.0, 4140.5)
  pesoPromedio: number;     // kg por animal
  rendimiento: number | null; // % de rendimiento (42.22%, 40.24%)
  precioKgUSD: number;      // precio por kg (4.7000, 5.5600)
  importeBrutoUSD: number;  // importe del renglón (10297.70, 23021.18)
}

export interface ImpuestosVenta {
  mevir?: number;           // 0.20%
  inia?: number;            // 0.40%
  imeba?: number;           // 2.00%
  decreto364_003?: number;
  decreto117_015?: number;
  mgap?: number;
  otros?: number;
}

export interface ParsedVenta {
  tipo: "VENTA";
  
  // Datos del comprador (frigorífico)
  comprador: string;        // "Frigo Salto"
  compradorDireccion?: string;
  
  // Datos del productor (vendedor)
  productor: string;        // "ERNESTO ESTEVEZ"
  productorDicose?: string; // "HH.07.19526"
  productorRut?: string;
  
  // Consignatario (intermediario)
  consignatario?: string;   // "CANEPA MARTINEZ FRANCISCO ANSELMO"
  consignatarioDicose?: string;
  consignatarioRut?: string;
  
  // Datos de la operación
  fecha: string;            // "2025-11-06"
  nroFactura: string;       // "6590"
  nroTropa: string | null;  // "28"
  guias?: string;           // "D 626465;d 626979"
  
  // Renglones de animales
  renglones: VentaRenglonParsed[];
  
  // Totales
  cantidadTotal: number;    // 430
  pesoTotalKg: number;      // 6331.5
  subtotalUSD: number;      // 33318.88
  
  // Impuestos (descuentos)
  impuestos: ImpuestosVenta;
  totalImpuestosUSD: number; // suma de todos los impuestos
  
  // Total final
  totalNetoUSD: number;     // 32469.21
  
  // Condiciones de pago
  metodoPago: "Contado" | "Plazo";
  diasPlazo?: number;
  fechaVencimiento?: string;
  tipoCambio?: number;      // T/C 39.8070
  
  // Otros
  flete?: string;           // "Por cuenta de Frigorífico"
}

/**
 * Detectar si una imagen es una factura de VENTA (no de gasto)
 */
export async function detectarTipoFactura(imageUrl: string): Promise<"VENTA" | "GASTO" | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analiza esta imagen y determina si es:
1. VENTA: Una factura/liquidación de VENTA de hacienda (animales) a un frigorífico o feria.
   - Tiene "Fact.Haciendas", "Liquidación", "Remito de hacienda"
   - Lista categorías de animales (ovejas, novillos, vacas, corderos)
   - Muestra pesos, rendimientos, precios por kg
   - El PRODUCTOR es quien VENDE, el frigorífico COMPRA

2. GASTO: Una factura de COMPRA/GASTO normal
   - Compra de insumos, combustible, alimento, servicios, etc.
   - NO es sobre venta de animales propios

3. null: No es una factura o no se puede determinar

Responde SOLO con: "VENTA", "GASTO" o "null" (sin comillas)`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const result = response.choices[0].message.content?.trim().toUpperCase();
    
    console.log("GPT respondió:", result)  // ← AGREGÁ ESTA LÍNEA
    
    if (result === "VENTA") return "VENTA";
    if (result === "GASTO") return "GASTO";
    return null;
    
  } catch (error) {
    console.error("Error detectando tipo de factura:", error);
    return null;
  }
}

/**
 * Procesar imagen de factura de VENTA de hacienda
 */
export async function processVentaImage(imageUrl: string): Promise<ParsedVenta | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un experto en procesar facturas de venta de hacienda de Uruguay.

CONTEXTO:
- Estas facturas son de frigoríficos (Frigo Salto, Marfrig, etc.) que COMPRAN animales a productores
- El PRODUCTOR es quien VENDE sus animales
- El frigorífico es el COMPRADOR
- Puede haber un CONSIGNATARIO (intermediario)

ESTRUCTURA TÍPICA:
- Header: Logo del frigorífico, datos de contacto
- Fact.Haciendas: número de factura
- TROPA: número de tropa
- Fecha
- PRODUCTOR: nombre del que vende, DICOSE, RUT
- Consignatario: intermediario (opcional)
- Tabla de animales: CATEGORÍA, Raza, Cantidad, Kilos, Precio/kg, Importe
- Totales: Subtotal, Impuestos (MEVIR, INIA, IMEBA, etc.), Total Neto
- Condiciones de pago: Contado/Plazo, Vencimiento, T/C

CATEGORÍAS COMUNES (mapear a tipoAnimal):
- OVEJAS, CORDEROS, CAPONES, CARNEROS, BORREGOS → OVINO
- NOVILLOS, VACAS, VAQUILLONAS, TERNEROS, TOROS → BOVINO
- YEGUAS, POTROS, CABALLOS → EQUINO

IMPUESTOS TÍPICOS (son DESCUENTOS del subtotal):
- MEVIR: 0.20%
- INIA: 0.40%
- IMEBA: 2.00%
- Decreto 364/003
- Decreto 117/015
- MGAP

IMPORTANTE:
- Los precios están en USD (U$S o US$)
- El peso puede estar en "Segunda Balanza" o "Primera Balanza"
- Calcular pesoPromedio = pesoTotalKg / cantidad

RESPONDE EN JSON (sin markdown):
{
  "tipo": "VENTA",
  "comprador": "nombre del frigorífico",
  "productor": "nombre del productor",
  "productorDicose": "XX.XX.XXXXX",
  "consignatario": "nombre o null",
  "fecha": "YYYY-MM-DD",
  "nroFactura": "número",
  "nroTropa": "número o null",
  "renglones": [
    {
      "categoria": "OVEJAS",
      "tipoAnimal": "OVINO",
      "raza": "GEN S/Clasif",
      "cantidad": 130,
      "pesoTotalKg": 2191.0,
      "pesoPromedio": 16.85,
      "rendimiento": 42.22,
      "precioKgUSD": 4.70,
      "importeBrutoUSD": 10297.70
    }
  ],
  "cantidadTotal": 430,
  "pesoTotalKg": 6331.5,
  "subtotalUSD": 33318.88,
  "impuestos": {
    "mevir": 64.95,
    "inia": 129.90,
    "imeba": 649.49,
    "mgap": 5.33
  },
  "totalImpuestosUSD": 849.67,
  "totalNetoUSD": 32469.21,
  "metodoPago": "Contado",
  "diasPlazo": null,
  "fechaVencimiento": null,
  "tipoCambio": 39.8070,
  "flete": "Por cuenta de Frigorífico"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrae todos los datos de esta factura de venta de hacienda:"
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" }
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.05
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    // Limpiar markdown si viene
    const jsonStr = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const data = JSON.parse(jsonStr) as ParsedVenta;

    // Validaciones
    if (!data.renglones?.length) {
      throw new Error("No se encontraron renglones de animales");
    }

    if (!data.comprador?.trim()) {
      data.comprador = "Frigorífico no identificado";
    }

    if (!data.productor?.trim()) {
      data.productor = "Productor no identificado";
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

    // Calcular total de impuestos
    if (!data.totalImpuestosUSD && data.impuestos) {
      data.totalImpuestosUSD = Object.values(data.impuestos).reduce((sum, val) => sum + (val || 0), 0);
    }

    if (!data.totalNetoUSD) {
      data.totalNetoUSD = data.subtotalUSD - (data.totalImpuestosUSD || 0);
    }

    // Asegurar que metodoPago tenga valor
    if (!data.metodoPago) {
      data.metodoPago = "Contado";
    }

    console.log("✅ Factura de VENTA procesada:", {
      comprador: data.comprador,
      productor: data.productor,
      renglones: data.renglones.length,
      totalNetoUSD: data.totalNetoUSD
    });

    return data;

  } catch (error) {
    console.error("❌ Error procesando factura de venta:", error);
    return null;
  }
}

/**
 * Mapear categoría de factura a categoría del sistema
 */
export function mapearCategoriaVenta(categoriaFactura: string): { categoria: string; tipoAnimal: string } {
  const cat = categoriaFactura.toUpperCase().trim();
  
  // OVINOS
  if (cat.includes("OVEJA")) return { categoria: "Oveja", tipoAnimal: "OVINO" };
  if (cat.includes("CORDERO")) return { categoria: "Cordero", tipoAnimal: "OVINO" };
  if (cat.includes("CAPON") || cat.includes("CAPÓN")) return { categoria: "Capón", tipoAnimal: "OVINO" };
  if (cat.includes("CARNERO")) return { categoria: "Carnero", tipoAnimal: "OVINO" };
  if (cat.includes("BORREGO")) return { categoria: "Borrego", tipoAnimal: "OVINO" };
  
  // BOVINOS
  if (cat.includes("NOVILLO")) return { categoria: "Novillo", tipoAnimal: "BOVINO" };
  if (cat.includes("VACA") && !cat.includes("VAQUILLONA")) return { categoria: "Vaca", tipoAnimal: "BOVINO" };
  if (cat.includes("VAQUILLONA")) return { categoria: "Vaquillona", tipoAnimal: "BOVINO" };
  if (cat.includes("TERNERO")) return { categoria: "Ternero", tipoAnimal: "BOVINO" };
  if (cat.includes("TERNERA")) return { categoria: "Ternera", tipoAnimal: "BOVINO" };
  if (cat.includes("TORO")) return { categoria: "Toro", tipoAnimal: "BOVINO" };
  
  // EQUINOS
  if (cat.includes("YEGUA")) return { categoria: "Yegua", tipoAnimal: "EQUINO" };
  if (cat.includes("POTRO")) return { categoria: "Potro", tipoAnimal: "EQUINO" };
  if (cat.includes("CABALLO")) return { categoria: "Caballo", tipoAnimal: "EQUINO" };
  
  // Por defecto, intentar capitalizar
  const palabras = categoriaFactura.toLowerCase().split(/\s+/);
  const categoriaCapitalizada = palabras
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  
  return { categoria: categoriaCapitalizada, tipoAnimal: "OTRO" };
}