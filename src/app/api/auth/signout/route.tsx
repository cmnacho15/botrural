// src/app/api/auth/signout/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })

  response.cookies.delete('next-auth.session-token')
  response.cookies.delete('__Secure-next-auth.session-token')

  return response
}