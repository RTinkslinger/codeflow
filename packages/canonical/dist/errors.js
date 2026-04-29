export class InvariantError extends Error {
    code = 'CANONICAL_ID_COLLISION';
    category = 'invariant';
    diagPayload;
    constructor(message, payload) {
        super(message);
        this.name = 'InvariantError';
        this.diagPayload = payload;
        Object.setPrototypeOf(this, InvariantError.prototype);
    }
}
//# sourceMappingURL=errors.js.map