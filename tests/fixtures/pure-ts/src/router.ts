type Handler = (path: string) => void
export class Router {
  private routes = new Map<string, Handler>()
  get(path: string, handler: Handler): void { this.routes.set(path, handler) }
}
