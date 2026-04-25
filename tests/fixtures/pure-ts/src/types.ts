export interface User { id: string; email: string; role: 'admin' | 'user' }
export interface Session { token: string; userId: string; expiresAt: Date }
