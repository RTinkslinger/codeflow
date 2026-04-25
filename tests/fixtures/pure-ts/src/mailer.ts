import type { User } from './types.js'
export class Mailer {
  async send(to: User, subject: string, body: string): Promise<void> {}
}
