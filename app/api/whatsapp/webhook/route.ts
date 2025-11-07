import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID!;

// ✅ Verificación inicial del webhook
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK VERIFICADO");
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.warn("❌ Verificación fallida");
    return new NextResponse("Forbidden", { status: 403 });
  }
}

// 📩 Procesamiento de mensajes entrantes
export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("📩 NUEVO MENSAJE RECIBIDO:", JSON.stringify(data, null, 2));

    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      console.log("⚠️ No hay mensaje en el payload");
      return NextResponse.json({ received: true });
    }

    const from = message.from;
    const type = message.type;

    console.log("📩 De:", from, "| Tipo:", type);

    let text = "";
    if (type === "text") {
      text = message.text?.body || "";
      console.log(`📝 Texto recibido de ${from}: ${text}`);
    }

    console.log("🔍 Buscando usuario con telefono:", from);

    // 🔍 Buscar usuario en base de datos
    const user = await prisma.user.findUnique({
      where: { telefono: from },
    });

    console.log("👤 Resultado búsqueda:", user ? `Encontrado: ${user.name}` : "No existe");

    if (!user) {
      console.log("🚀 Usuario no existe, creando nuevo...");
      
      // PRIMERO crear el usuario
      const newUser = await prisma.user.create({
        data: {
          telefono: from,
          role: "USUARIO",
          name: "Pendiente",
        },
      });
      
      console.log("✅ Usuario creado:", newUser.id);

      // DESPUÉS enviar mensaje
      await sendWhatsAppMessage(
        from,
        "👋 Hola, soy el asistente de tu campo.\nPor favor, decime tu *nombre y apellido* para registrarte."
      );
    } else {
      console.log("💬 Usuario existe, enviando saludo...");
      await sendWhatsAppMessage(from, `Hola ${user.name || "👤"} 👋\nTu mensaje fue: ${text}`);
    }

    console.log("✅ Procesamiento completado");
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("❌ ERROR FATAL en POST:", error);
    console.error("❌ Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json({ error: "Internal error", details: String(error) }, { status: 500 });
  }
}

// 🧩 Función para enviar mensajes por la API de WhatsApp
async function sendWhatsAppMessage(to: string, body: string) {
  try {
    console.log("📤 Preparando envío...");
    console.log("  → Destinatario:", to);
    console.log("  → Mensaje:", body.substring(0, 50) + "...");
    console.log("  → PHONE_ID:", PHONE_ID ? "✅" : "❌ FALTA");
    console.log("  → TOKEN:", WHATSAPP_TOKEN ? "✅" : "❌ FALTA");

    const url = `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`;
    console.log("  → URL:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    const responseData = await res.json();
    console.log("📤 Respuesta WhatsApp API:", JSON.stringify(responseData, null, 2));
    
    if (!res.ok) {
      console.error("❌ Error API WhatsApp:", responseData);
    } else {
      console.log("✅ Mensaje enviado exitosamente");
    }

    return responseData;
  } catch (error) {
    console.error("❌ ERROR en sendWhatsAppMessage:", error);
    throw error;
  }
}