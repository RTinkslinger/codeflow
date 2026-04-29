// Default import
import defaultGreeting from 'pkg-a'

// Named import
import { namedGreeting, reExportedFn } from 'pkg-a'

// Type-only import
import type { Greeter } from 'pkg-a'

// Barrel-style re-export
export { namedGreeting } from 'pkg-a'

class MyGreeter implements Greeter {
  greet(): string {
    return defaultGreeting() + ' / ' + namedGreeting() + ' / ' + reExportedFn()
  }
}

export const greeter = new MyGreeter()
