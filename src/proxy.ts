import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/login']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (isValidSessionToken(token)) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  if (pathname !== '/') loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
