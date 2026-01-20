// lib/detectors/venta-especifico-detector.ts
// Detecta si una venta es de GANADO, LANA o GRANO

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detectar el tipo específico de venta
 * Retorna: "GANADO" | "LANA" | "GRANO"
 */
export async function detectarTipoVentaEspecifico(imageUrl: string): Promise<"GANADO" | "LANA" | "GRANO"> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un clasificador de facturas de venta agropecuaria en Uruguay.

PREGUNTA: ¿Esta factura es de venta de GANADO, LANA o GRANO?

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

====== SEÑALES DE GRANO (FUTURO) ======
- Menciona: TRIGO, MAÍZ, SORGO, SOJA, CEBADA
- Toneladas o kg de cereal
- Puede tener: Humedad, Impurezas, Proteína
- NO tiene animales ni lana

====== REGLAS DE DECISIÓN ======
1. Si encuentra "LANA VELLÓN" o "LANA BARRIGA" → es LANA
2. Si encuentra nombres de animales (OVEJAS, VACAS, etc.) → es GANADO
3. Si encuentra nombres de cereales (TRIGO, MAÍZ, etc.) → es GRANO
4. Si no está seguro → responder GANADO por defecto

RESPONDE SOLO UNA PALABRA:
- "LANA" si es venta de lana
- "GANADO" si es venta de animales
- "GRANO" si es venta de cereales

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

    const respuesta = response.choices[0].message.content?.toUpperCase().trim() || "";
    
    console.log(`🔍 Tipo específico detectado: ${respuesta}`);
    
    if (respuesta.includes("LANA")) {
      return "LANA";
    }
    
    if (respuesta.includes("GRANO")) {
      return "GRANO";
    }
    
    // Por defecto: GANADO
    return "GANADO";
    
  } catch (error) {
    console.warn("⚠️ Error detectando tipo específico, asumiendo GANADO:", error);
    return "GANADO";
  }
}
