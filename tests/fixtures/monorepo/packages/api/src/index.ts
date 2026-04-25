import type { User } from '../../shared/src/types.js'
export function getUser(id: string): User { return { id, email: 'test@example.com' } }
