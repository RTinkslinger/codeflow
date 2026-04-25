export declare class InvariantError extends Error {
    readonly code = "CANONICAL_ID_COLLISION";
    readonly category = "invariant";
    readonly diagPayload: Record<string, unknown>;
    constructor(message: string, payload: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map