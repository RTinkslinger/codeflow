declare module 'pino-roll' {
  import type { SonicBoom } from 'sonic-boom'
  function pinroll(opts: { file: string; size?: string; dateFormat?: string; frequency?: string }): Promise<SonicBoom>
  export = pinroll
}
