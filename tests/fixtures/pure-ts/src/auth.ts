import { UserRepo } from './user.js'
import { SessionStore } from './session.js'
import { hashPassword, verifyPassword } from './crypto.js'
import { AuthError } from './errors.js'
import { MAX_LOGIN_ATTEMPTS } from './constants.js'
export class AuthService {
  constructor(private users: UserRepo, private sessions: SessionStore) {}
  async login(email: string, password: string): Promise<string> {
    const user = await this.users.find(email)
    if (!user) throw new AuthError('User not found')
    return this.sessions.create(user.id).token
  }
}
