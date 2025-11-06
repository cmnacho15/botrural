// lib/renew-whatsapp-token.ts

export async function renewWhatsAppToken(): Promise<{
  success: boolean;
  newToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const currentToken = process.env.WHATSAPP_TOKEN;

    console.log("🔍 Verificando credenciales...");
    console.log("App ID:", appId ? "✅" : "❌");
    console.log("App Secret:", appSecret ? "✅" : "❌");
    console.log("Current Token:", currentToken ? "✅" : "❌");

    if (!appId || !appSecret || !currentToken) {
      throw new Error("Faltan credenciales de Meta en .env");
    }

    console.log("🔄 Solicitando nuevo token a Meta...");

    // Construir URL con parámetros
    const url = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
    url.searchParams.append("grant_type", "fb_exchange_token");
    url.searchParams.append("client_id", appId);
    url.searchParams.append("client_secret", appSecret);
    url.searchParams.append("fb_exchange_token", currentToken);

    console.log("📡 URL:", url.toString().replace(appSecret, "***"));

    const response = await fetch(url.toString());
    const data = await response.json();

    console.log("📥 Respuesta de Meta:", response.status);

    if (!response.ok || !data.access_token) {
      console.error("❌ Error en respuesta:", data);
      return {
        success: false,
        error: data.error?.message || JSON.stringify(data),
      };
    }

    const expiresInDays = Math.floor((data.expires_in || 0) / 86400);

    console.log("✅ Token renovado exitosamente");
    console.log("🔑 Nuevo token (primeros 30 chars):", data.access_token.substring(0, 30) + "...");
    console.log("⏰ Expira en:", expiresInDays, "días");

    return {
      success: true,
      newToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("❌ Error fatal en renovación:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}