export class AppError extends Error {
  constructor(public code: string, message: string) { super(message) }
}
export class AuthError extends AppError {
  constructor(message: string) { super('AUTH_ERROR', message) }
}
