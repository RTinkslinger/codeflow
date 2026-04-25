import type { User } from './types.js'
import { Database } from './db.js'
export class UserRepo {
  constructor(private db: Database) {}
  async exists(email: string): Promise<boolean> { return false }
  async find(id: string): Promise<User | undefined> { return undefined }
}
