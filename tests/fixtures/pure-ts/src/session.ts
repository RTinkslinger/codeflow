import type { Session } from './types.js'
import { Cache } from './cache.js'
import { SESSION_TTL_MS } from './constants.js'
export class SessionStore {
  constructor(private cache: Cache) {}
  create(userId: string): Session {
    return { token: Math.random().toString(36), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
  }
}
