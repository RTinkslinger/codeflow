export function buildDescriptor(parts) {
    return `${parts.scheme}:${parts.manager}:${parts.pkg}:${parts.descriptor}`;
}
export function parseDescriptor(id) {
    const segments = id.split(':');
    if (segments.length < 4)
        throw new Error(`Invalid Symbol.Descriptor: "${id}" — expected scheme:manager:package:descriptor`);
    const [scheme, manager, pkg, ...rest] = segments;
    return { scheme, manager, pkg, descriptor: rest.join(':') };
}
//# sourceMappingURL=descriptor.js.map