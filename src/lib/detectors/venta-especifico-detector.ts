// lib/detectors/venta-especifico-detector.ts
// Detecta si una venta es de GANADO, LANA o GRANOS

import OpenAI from "openai";
import { trackOpenAIChat } from "@/lib/ai-usage-tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detectar el tipo específico de venta
 * Retorna: "GANADO" | "LANA" | "GRANOS"
 */
export async function detectarTipoVentaEspecifico(imageUrl: string, userId?: string): Promise<"GANADO" | "LANA" | "GRANOS"> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un clasificador de facturas de venta agropecuaria en Uruguay.

PREGUNTA: ¿Esta factura es de venta de GANADO, LANA o GRANOS?

====== SEÑALES DE LANA ======
- Menciona: "LANA VELLÓN", "LANA BARRIGA", "LANA BARRIGUERA", "LANAS"
- Categorías son TIPOS DE LANA (no animales)
- Solo tiene PESO en kg, NO cantidad de animales
- Puede decir "LANAS" en el título o encabezado
- NO tiene columna "Cantidad de animales"
- Título puede ser: "Liquidación de Lana", "Venta de Lanas", etc.

EJEMPLOS DE LANA:
- "LANA VELLÓN: 4,367 kg"
- "LANA BARRIGA: 685 kg"
- "Categoría: LANA BARRIGUERA"

====== SEÑALES DE GANADO ======
- Menciona ANIMALES: OVEJAS, VACAS, NOVILLOS, CORDEROS, CAPONES, VAQUILLONAS, etc.
- Tiene columna "Cantidad" con NÚMERO DE ANIMALES
- Puede tener "Rendimiento", "Balanzas" (1ra, 2da, 4ta)
- Tiene DICOSE, TROPA
- Columnas típicas: Cant, Kilos, Precio, Rendimiento

EJEMPLOS DE GANADO:
- "OVEJAS: 130 cabezas, 5190 kg"
- "NOVILLOS: 9 animales"
- "Categoría: VACAS GORDAS"

====== SEÑALES DE GRANOS ⭐ ======
- Título dice: "LIQUIDACIÓN PRODUCTOR", "COMPRA DE GRANO", "LIQUIDACIÓN DE CEREALES"
- Menciona CEREALES: TRIGO, MAÍZ, SOJA, SORGO, CEBADA, GIRASOL, AVENA, ARROZ
- Mercadería: nombre de cereal
- Usa TONELADAS o kg grandes (400.000+ kg)
- Tiene conceptos como:
  * "Cantidad Recibida (kg)"
  * "Descuentos (kg)" por humedad/impurezas
  * "Precio (US$/tm)" - precio por tonelada métrica
  * "Monto Bruto (US$)"
- Servicios típicos: SECADO, FLETE, PRELIMPEZA, DAP-FLETE
- Retenciones: IMEBA, INIA, MEVIR
- Puede tener: Humedad %, Proteína %, Impurezas %
- NO tiene animales
- NO es lana

PALABRAS CLAVE DE GRANOS:
- "LIQUIDACIÓN PRODUCTOR - COMPRA DE GRANO"
- "Mercadería: TRIGO" / "MAÍZ" / "SOJA"
- "Cant. Recibida (kg)"
- "Precio (US$/tm)"
- "Secado (US$)"
- "Zafra"

====== REGLAS DE DECISIÓN ======
1. Si encuentra "LIQUIDACIÓN" + "GRANO" o "COMPRA DE GRANO" → es GRANOS
2. Si encuentra "TRIGO", "MAÍZ", "SOJA", "CEBADA" como mercadería → es GRANOS
3. Si encuentra "LANA VELLÓN" o "LANA BARRIGA" → es LANA
4. Si encuentra nombres de animales (OVEJAS, VACAS, etc.) → es GANADO
5. Si no está seguro → responder GANADO por defecto

RESPONDE SOLO UNA PALABRA:
- "GRANOS" si es liquidación de cereales/granos
- "LANA" si es venta de lana
- "GANADO" si es venta de animales

Si no estás 100% seguro, responde "GANADO" por defecto.`
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl, detail: "low" } }]
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    // Trackear uso
    if (userId) {
      trackOpenAIChat(userId, 'VENTA_DETECTOR', response)
    }

    const respuesta = response.choices[0].message.content?.toUpperCase().trim() || "";

    console.log(`🔍 Tipo específico detectado: ${respuesta}`);
    
    if (respuesta.includes("GRANO")) {
      return "GRANOS";
    }
    
    if (respuesta.includes("LANA")) {
      return "LANA";
    }
    
    // Por defecto: GANADO
    return "GANADO";
    
  } catch (error) {
    console.warn("⚠️ Error detectando tipo específico, asumiendo GANADO:", error);
    return "GANADO";
  }
}