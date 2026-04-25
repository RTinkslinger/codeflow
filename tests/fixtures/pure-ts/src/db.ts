import type { Config } from './config.js'
export class Database {
  constructor(private config: Config) {}
  async query(sql: string): Promise<unknown[]> { return [] }
}
