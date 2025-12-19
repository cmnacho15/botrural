//src/lib/whatsapp/sendMessage.ts

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

/**
 * 📤 Enviar mensaje con botones interactivos
 */
export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN

  if (!phoneId || !token) {
    console.error('❌ WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados')
    throw new Error('WhatsApp no configurado')
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: body },
            action: {
              buttons: buttons.map(btn => ({
                type: "reply",
                reply: {
                  id: btn.id,
                  title: btn.title.substring(0, 20)
                }
              }))
            }
          }
        }),
      }
    )

    const responseData = await response.json()

    if (!response.ok) {
      console.error("❌ Error enviando botones:", responseData)
    } else {
      console.log("✅ Botones enviados exitosamente")
    }

    return responseData
  } catch (error) {
    console.error("❌ Error enviando botones:", error)
  }
}

/**
 * 📄 Enviar documento (PDF) por WhatsApp
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
) {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN

  if (!phoneId || !token) {
    console.error('❌ WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados')
    throw new Error('WhatsApp no configurado')
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`

  console.log('📄 Enviando documento...')
  console.log('  → Destinatario:', to)
  console.log('  → Archivo:', filename)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        ...(caption && { caption })
      }
    })
  })

  const responseData = await response.json()

  if (!response.ok) {
    console.error('❌ Error enviando documento:', responseData)
    throw new Error(`WhatsApp API error: ${response.statusText}`)
  }

  console.log('✅ Documento enviado exitosamente')
  return responseData
}