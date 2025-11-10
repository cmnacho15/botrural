export async function sendWhatsAppMessage(to: string, text: string) {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN
  
  if (!phoneId || !token) {
    throw new Error('WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados')
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`
  
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
  
  if (!response.ok) {
    const error = await response.json()
    console.error('WhatsApp API error:', error)
    throw new Error(`WhatsApp API error: ${response.statusText}`)
  }
  
  return response.json()
}