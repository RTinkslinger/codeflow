export type SetupPyWarningCode = 'SETUP_PY_NAME_UNRESOLVED';
export interface ExtractSetupPyNameResult {
    name: string | null;
    warning?: SetupPyWarningCode;
}
export declare function extractSetupPyName(content: string): ExtractSetupPyNameResult;
//# sourceMappingURL=extract-setup-py-name.d.ts.map