// src/lib/whatsapp/services/messageService.ts

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID

/**
 * Envía un mensaje de texto simple
 */
export async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando mensaje:", error)
    }
  } catch (error) {
    console.error("Error en sendWhatsAppMessage:", error)
  }
}

/**
 * Envía un mensaje con botones estándar (Confirmar, Editar, Cancelar)
 */
export async function sendWhatsAppMessageWithButtons(
  to: string,
  bodyText: string
) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText,
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "btn_confirmar",
                    title: "Confirmar",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_editar",
                    title: "Editar",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "btn_cancelar",
                    title: "Cancelar",
                  },
                },
              ],
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando botones:", error)
      await sendWhatsAppMessage(
        to,
        bodyText +
          "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
      )
    }
  } catch (error) {
    console.error("Error en sendWhatsAppMessageWithButtons:", error)
    await sendWhatsAppMessage(
      to,
      bodyText +
        "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
    )
  }
}

/**
 * Envía un mensaje con botones personalizados
 */
export async function sendCustomButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText,
            },
            action: {
              buttons: buttons.map((btn) => ({
                type: "reply",
                reply: {
                  id: btn.id,
                  title: btn.title,
                },
              })),
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error("Error enviando botones personalizados:", error)
      await sendWhatsAppMessage(
        to,
        bodyText +
          "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
      )
    }
  } catch (error) {
    console.error("Error en sendCustomButtons:", error)
    await sendWhatsAppMessage(
      to,
      bodyText +
        "\n\n¿Es correcto?\nRespondé: *confirmar*, *editar* o *cancelar*"
    )
  }
}