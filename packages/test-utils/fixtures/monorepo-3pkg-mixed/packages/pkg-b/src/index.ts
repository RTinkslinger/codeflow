import { greet } from '@mixed/pkg-a'

export function welcome(name: string): string {
  return greet(name).toUpperCase()
}
