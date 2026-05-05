import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

/** Hash a plain-text password using bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

/** Compare a plain-text password against a stored bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
}
