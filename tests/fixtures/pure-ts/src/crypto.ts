export function hashPassword(plain: string): string { return plain }
export function verifyPassword(plain: string, hash: string): boolean { return plain === hash }
