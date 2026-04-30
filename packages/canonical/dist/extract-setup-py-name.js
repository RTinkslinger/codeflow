export function extractSetupPyName(content) {
    // Match name="..." or name='...' anywhere in setup() args.
    // Must be a literal string — variables and expressions return warning.
    const m = content.match(/(?<!\w)name\s*=\s*(['"])([^'"]+)\1/);
    if (m)
        return { name: m[2] ?? null };
    return { name: null, warning: 'SETUP_PY_NAME_UNRESOLVED' };
}
//# sourceMappingURL=extract-setup-py-name.js.map