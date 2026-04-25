type Handler<T> = (payload: T) => void
export class EventBus {
  private handlers = new Map<string, Handler<unknown>[]>()
  on(event: string, handler: Handler<unknown>): void {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }
}
