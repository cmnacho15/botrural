// lib/detectors/es-documento-detector.ts
// Detecta si una imagen es un documento/factura o una foto normal (campo, animales, etc.)

import OpenAI from "openai";
import { trackOpenAIChat } from "@/lib/ai-usage-tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TipoImagen = "DOCUMENTO" | "FOTO" | "INCIERTO";

/**
 * Detecta si una imagen es un documento/factura o una foto normal
 * Usa un modelo rápido y barato para esta clasificación inicial
 */
export async function esDocumento(imageUrl: string, userId?: string): Promise<TipoImagen> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Modelo rápido y barato para clasificación simple
      messages: [
        {
          role: "system",
          content: `Clasifica esta imagen en una de estas categorías:

DOCUMENTO - Si es:
- Factura, boleta, ticket, recibo
- e-Factura, liquidación
- Estado de cuenta, resumen
- Documento con texto formal, tablas de números, RUT, fechas
- Papel impreso con información comercial

FOTO - Si es:
- Foto de animales (vacas, ovejas, terneros, etc.)
- Foto de campo, pasturas, cultivos
- Foto de maquinaria, instalaciones
- Foto de personas trabajando
- Cualquier imagen que NO sea un documento escrito
- Captura de pantalla de chat o mensaje

RESPONDE SOLO UNA PALABRA:
- "DOCUMENTO" si es claramente un documento/factura
- "FOTO" si es claramente una foto normal
- "INCIERTO" si no podés determinar`
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } }
          ]
        }
      ],
      max_tokens: 15,
      temperature: 0
    });

    // Trackear uso
    if (userId) {
      trackOpenAIChat(userId, 'DOCUMENTO_DETECTOR', response);
    }

    const respuesta = response.choices[0].message.content?.toUpperCase().trim() || "";
    console.log("📷 ¿Es documento o foto?:", respuesta);

    if (respuesta.includes("DOCUMENTO")) return "DOCUMENTO";
    if (respuesta.includes("FOTO")) return "FOTO";
    return "INCIERTO";

  } catch (error) {
    console.error("Error detectando tipo de imagen:", error);
    return "INCIERTO";
  }
}
