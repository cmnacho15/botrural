import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ campoNombre: null })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { campo: true },
    })

    return NextResponse.json({ campoNombre: user?.campo?.nombre || null })
  } catch {
    return NextResponse.json({ campoNombre: null })
  }
}