import fs from 'node:fs';
import path from 'node:path';
export function canonicalizePath(p) {
    try {
        // fs.realpathSync resolves symlinks; fallback to normalize if path doesn't exist
        return fs.realpathSync(path.normalize(p)).split(path.sep).join('/');
    }
    catch {
        return path.normalize(p).split(path.sep).join('/');
    }
}
export function posixRelative(root, absPath) {
    const canonRoot = canonicalizePath(root);
    const canonAbs = canonicalizePath(absPath);
    if (!canonAbs.startsWith(canonRoot + '/') && canonAbs !== canonRoot) {
        throw new Error(`Path "${canonAbs}" is not under root "${canonRoot}"`);
    }
    return canonAbs.slice(canonRoot.length + 1);
}
//# sourceMappingURL=canonicalizer.js.map