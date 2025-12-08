// src/lib/whatsapp/handlers/tokenHandler.ts

import { prisma } from "@/lib/prisma"

/**
 * Verifica si un mensaje es un token de invitación válido
 */
export async function isToken(message: string): Promise<boolean> {
  if (message.length < 20 || message.length > 50) return false

  const invitation = await prisma.invitation.findUnique({
    where: { token: message },
  })

  return !!invitation
}