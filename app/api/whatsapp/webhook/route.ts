import { NextResponse } from "next/server";

// ✅ Verificación del webhook (cuando Meta hace GET)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK VERIFICADO");
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.warn("❌ Verificación de webhook fallida");
    return new NextResponse("Forbidden", { status: 403 });
  }
}

// 📩 Manejo de mensajes entrantes desde WhatsApp
export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("📩 NUEVO MENSAJE RECIBIDO:", JSON.stringify(data, null, 2));

    const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      console.log("⚠️ No se encontró mensaje en el body.");
      return NextResponse.json({ received: true });
    }

    const from = message.from; // número del remitente
    const type = message.type; // tipo de mensaje: text, image, audio, etc.

    // 📝 Texto
    if (type === "text") {
      const text = message.text?.body;
      console.log(`📝 Texto recibido de ${from}: ${text}`);
    }

    // 🎤 Audio
    if (type === "audio") {
      const audioId = message.audio?.id;
      console.log(`🎤 Audio recibido de ${from}: ${audioId}`);
    }

    // 🖼️ Imagen
    if (type === "image") {
      const imageId = message.image?.id;
      console.log(`🖼️ Imagen recibida de ${from}: ${imageId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error procesando mensaje:", error);
    return NextResponse.json({ success: false, error: error }, { status: 500 });
  }
}