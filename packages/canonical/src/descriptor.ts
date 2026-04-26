export interface DescriptorParts {
  scheme: string      // e.g. "tsc" | "scip-py"
  manager: string     // e.g. "typescript" | "python"
  pkg: string         // e.g. "src/auth"
  descriptor: string  // e.g. "AuthService#login(string)"
}

export function buildDescriptor(parts: DescriptorParts): string {
  return `${parts.scheme}:${parts.manager}:${parts.pkg}:${parts.descriptor}`
}

export function parseDescriptor(id: string): DescriptorParts {
  const segments = id.split(':')
  if (segments.length < 4) throw new Error(`Invalid Symbol.Descriptor: "${id}" — expected scheme:manager:package:descriptor`)
  const [scheme, manager, pkg, ...rest] = segments as [string, string, string, ...string[]]
  return { scheme, manager, pkg, descriptor: rest.join(':') }
}
