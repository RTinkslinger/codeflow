// Default export
export default function defaultGreeting(): string {
  return 'hello from pkg-a default'
}

// Named export
export function namedGreeting(): string {
  return 'hello from pkg-a named'
}

// Type export
export interface Greeter {
  greet(): string
}

// Re-export from sub-module
export * from './sub.js'
