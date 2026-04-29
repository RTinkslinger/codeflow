export type SetupPyWarningCode = 'SETUP_PY_NAME_UNRESOLVED'

export interface ExtractSetupPyNameResult {
  name: string | null
  warning?: SetupPyWarningCode
}

export function extractSetupPyName(content: string): ExtractSetupPyNameResult {
  // Match name="..." or name='...' anywhere in setup() args.
  // Must be a literal string — variables and expressions return warning.
  const m = content.match(/(?<!\w)name\s*=\s*(['"])([^'"]+)\1/)
  if (m) return { name: m[2] ?? null }
  return { name: null, warning: 'SETUP_PY_NAME_UNRESOLVED' }
}
