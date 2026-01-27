import { NextResponse } from 'next/server'
import { requireMegaAdmin } from '@/lib/admin-auth'

export async function GET() {
  const { error, user } = await requireMegaAdmin()

  if (error) return error

  return NextResponse.json({
    authorized: true,
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name
    }
  })
}
