import { fromPkgA } from 'pkg-a'
export function fromPkgB(): string { return 'b/' + fromPkgA() }
