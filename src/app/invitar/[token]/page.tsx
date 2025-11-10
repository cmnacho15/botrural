import { getServerSession } from "next-auth"
import { authOptions } from "@/src/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

type Props = { 
  params: Promise<{ token: string }> // Ahora es una Promise
}

export default async function AceptarInvitacionPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  const { token } = await params // Await params aquí
  
  const invitation = await prisma.invitation.findUnique({ where: { token } })
  
  if (!invitation) {
    return <div className="p-6">Invitación inválida o ya utilizada.</div>
  }
  if (invitation.usedAt) {
    return <div className="p-6">Esta invitación ya fue utilizada.</div>
  }
  if (invitation.expiresAt < new Date()) {
    return <div className="p-6">La invitación expiró.</div>
  }

  // Si no está logueado, lo mandamos a login y volvemos acá
  if (!session?.user?.id) {
    redirect(`/login?next=/invitar/${token}`)
  }

  // Usuario logueado: lo unimos al campo con el rol
  const userId = session.user.id

  await prisma.user.update({
    where: { id: userId },
    data: {
      campoId: invitation.campoId,
      role: invitation.role as Role,
    },
  })

  await prisma.invitation.update({
    where: { token },
    data: { usedAt: new Date(), usedById: userId },
  })

  redirect("/dashboard/equipo")
}