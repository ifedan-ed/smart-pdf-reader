import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'smart-pdf-reader-secret-key-2024'
const JWT_EXPIRY = '7d'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string }
    return decoded
  } catch {
    return null
  }
}

export function getAuthFromRequest(request: Request): { userId: string; email: string; role: string } | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    return verifyToken(token)
  }

  // Try cookie
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, ...val] = cookie.trim().split('=')
      acc[key.trim()] = val.join('=')
      return acc
    }, {} as Record<string, string>)

    if (cookies['token']) {
      return verifyToken(cookies['token'])
    }
  }

  return null
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
