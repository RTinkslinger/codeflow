import pino from 'pino';
export declare const LOG_DIR: string;
export declare function createLogger(level?: string, pretty?: boolean): Promise<pino.Logger<never, boolean>>;
export type Logger = pino.Logger;
//# sourceMappingURL=logger.d.ts.map