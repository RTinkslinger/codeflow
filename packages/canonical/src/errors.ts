export class InvariantError extends Error {
  readonly code = 'CANONICAL_ID_COLLISION'
  readonly category = 'invariant'
  readonly diagPayload: Record<string, unknown>

  constructor(message: string, payload: Record<string, unknown>) {
    super(message)
    this.name = 'InvariantError'
    this.diagPayload = payload
  }
}
