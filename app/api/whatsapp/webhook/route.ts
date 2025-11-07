import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  const data = await req.json();

  console.log("📩 NUEVO MENSAJE RECIBIDO:", JSON.stringify(data, null, 2));

  const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = message?.from;
  const text = message?.text?.body;

  if (from && text) {
    console.log(`📨 Mensaje de ${from}: ${text}`);
  }

  return NextResponse.json({ success: true });
}
