import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, message } = body;

    console.log("=== 🚀 INICIO DE REQUEST ===");
    console.log("📱 Número destino:", to);
    console.log("💬 Mensaje:", message);

    // Validación de datos
    if (!to || !message) {
      console.error("❌ Faltan datos en el request");
      return NextResponse.json(
        { error: "Faltan datos requeridos (to o message)" },
        { status: 400 }
      );
    }

    // Obtener variables de entorno
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    console.log("🔑 Token presente:", !!token);
    console.log("🔑 Token length:", token?.length);
    console.log("📞 Phone ID:", phoneId);

    // Validación de variables de entorno
    if (!token || !phoneId) {
      console.error("❌ FALTAN VARIABLES DE ENTORNO");
      console.error("Token definido:", !!token);
      console.error("PhoneID definido:", !!phoneId);
      return NextResponse.json(
        { 
          error: "Configuración de WhatsApp incompleta",
          debug: {
            hasToken: !!token,
            hasPhoneId: !!phoneId
          }
        },
        { status: 500 }
      );
    }

    // Limpiar número (quitar +, espacios, guiones)
    const cleanNumber = to.replace(/[\+\s\-]/g, "");
    console.log("📞 Número limpio:", cleanNumber);

    // URL de la API de WhatsApp
    const whatsappUrl = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
    console.log("🌐 URL:", whatsappUrl);

    // Payload
    const payload = {
      messaging_product: "whatsapp",
      to: cleanNumber,
      type: "text",
      text: { body: message },
    };

    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    // Hacer request a WhatsApp API
    const response = await fetch(whatsappUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("📡 Status code:", response.status);

    const data = await response.json();
    console.log("📥 Respuesta de WhatsApp:", JSON.stringify(data, null, 2));

    // Si hay error en la respuesta de WhatsApp
    if (!response.ok) {
      console.error("❌ ERROR EN WHATSAPP API");
      console.error("Detalles:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { 
          success: false, 
          error: "Error al enviar mensaje a WhatsApp", 
          details: data,
          statusCode: response.status
        },
        { status: response.status }
      );
    }

    console.log("✅ MENSAJE ENVIADO EXITOSAMENTE");
    console.log("ID del mensaje:", data.messages?.[0]?.id);

    return NextResponse.json({ 
      success: true, 
      data,
      messageId: data.messages?.[0]?.id 
    });

  } catch (error) {
    console.error("❌ ERROR FATAL:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}