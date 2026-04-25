declare module 'pino-roll' {
  import type { SonicBoom } from 'sonic-boom'
  function pinroll(dest: string, opts?: { size?: string; dateFormat?: string }): SonicBoom
  export = pinroll
}
