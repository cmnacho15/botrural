// src/lib/currency.ts

/**
 * Obtiene la cotización de USD → UYU desde una API pública gratuita:
 * https://open.er-api.com/v6/latest/USD
 *
 * Se cachea por 1 hora para no saturar la API.
 */

export async function getUSDToUYU(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }, // cache 1 hora
    });

    const data = await res.json();

    if (!data || !data.rates || !data.rates.UYU) {
      console.error("⚠️ Cotización UYU no encontrada:", data);
      return 40; // fallback seguro si falla la API
    }

    return data.rates.UYU; // Ej: 39.81
  } catch (error) {
    console.error("❌ Error obteniendo USD→UYU:", error);
    return 40; // fallback razonable
  }
}