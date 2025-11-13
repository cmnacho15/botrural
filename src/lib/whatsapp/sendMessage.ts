export async function sendWhatsAppMessage(to: string, text: string) {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN
  
  if (!phoneId || !token) {
    console.error('❌ WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados')
    throw new Error('WhatsApp no configurado')
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`
  
  console.log('📤 Preparando envío...')
  console.log('  → Destinatario:', to)
  console.log('  → Mensaje:', text.substring(0, 50) + '...')
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  })
  
  const responseData = await response.json()
  console.log('📤 Respuesta WhatsApp API:', JSON.stringify(responseData, null, 2))
  
  if (!response.ok) {
    console.error('❌ Error API WhatsApp:', responseData)
    throw new Error(`WhatsApp API error: ${response.statusText}`)
  }
  
  console.log('✅ Mensaje enviado exitosamente')
  return responseData
}