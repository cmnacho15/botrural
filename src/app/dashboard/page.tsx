import { getServerSession } from "next-auth"
export const dynamic = 'force-dynamic'

import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import DashboardMejorado from "@/app/components/DashboardMejorado"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return <DashboardMejorado session={session} />
}