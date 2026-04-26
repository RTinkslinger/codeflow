export class Cache {
  private store = new Map<string, unknown>()
  set(key: string, value: unknown): void { this.store.set(key, value) }
  get(key: string): unknown { return this.store.get(key) }
}
