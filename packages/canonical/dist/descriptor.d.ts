export interface DescriptorParts {
    scheme: string;
    manager: string;
    pkg: string;
    descriptor: string;
}
export declare function buildDescriptor(parts: DescriptorParts): string;
export declare function parseDescriptor(id: string): DescriptorParts;
//# sourceMappingURL=descriptor.d.ts.map