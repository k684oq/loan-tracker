import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSessionToken, isCorrectPassword, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (typeof password !== 'string' || !isCorrectPassword(password)) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return NextResponse.json({ ok: true })
}
