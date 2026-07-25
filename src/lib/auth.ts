import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_COOKIE = 'loan_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30日

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

function sign(expiresAt: number) {
  return createHmac('sha256', getAuthSecret()).update(String(expiresAt)).digest('hex')
}

export function createSessionToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS
  return `${expiresAt}.${sign(expiresAt)}`
}

export function isValidSessionToken(token: string | undefined | null) {
  if (!token) return false
  const [expiresAtStr, signature] = token.split('.')
  const expiresAt = Number(expiresAtStr)
  if (!expiresAt || !signature || Date.now() > expiresAt) return false

  const expected = Buffer.from(sign(expiresAt))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function isCorrectPassword(input: string) {
  const expected = process.env.APP_PASSWORD
  if (!expected) throw new Error('APP_PASSWORD is not set')

  const inputHash = createHmac('sha256', getAuthSecret()).update(input).digest()
  const expectedHash = createHmac('sha256', getAuthSecret()).update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

export { SESSION_COOKIE, SESSION_TTL_MS }
