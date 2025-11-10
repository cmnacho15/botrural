import { NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/whatsapp/botHandlers'
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendMessage'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!

// ✅ GET - Verificación del webhook
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('❌ Verificación fallida')
  return new NextResponse('Forbidden', { status: 403 })
}

// 📩 POST - Recibir mensajes
export async function POST(req: Request) {
  try {
    const data = await req.json()
    console.log('📩 Webhook recibido:', JSON.stringify(data, null, 2))

    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message) {
      console.log('⚠️ No hay mensaje en el payload')
      return NextResponse.json({ received: true })
    }

    const from = message.from
    const type = message.type
    let text = ''
    
    if (type === 'text') {
      text = message.text?.body || ''
    }

    console.log(`📨 Mensaje de ${from} (${type}): ${text}`)

    // Procesar con el bot
    const response = await handleIncomingMessage({
      from,
      text,
      type
    })

    // Enviar respuesta
    if (response.reply) {
      await sendWhatsAppMessage(from, response.reply)
      console.log(`✅ Respuesta enviada a ${from}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error en webhook:', error)
    return NextResponse.json(
      { error: 'Internal error', details: String(error) },
      { status: 500 }
    )
  }
}