export type LaneState = 'idle' | 'extracting' | 'dirty' | 'error' | 'aborted';
export type PreviewStatus = 'extracting' | 'ready' | 'error' | 'aborted';
export declare class LaneStateMachine {
    private _state;
    get state(): LaneState;
    onSave(): void;
    onOk(): void;
    onFail(): void;
    onStop(): void;
}
export declare function derivePreviewStatus(laneStates: LaneState[]): PreviewStatus;
//# sourceMappingURL=state.d.ts.map