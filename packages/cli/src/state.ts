export type LaneState = 'idle' | 'extracting' | 'dirty' | 'error' | 'aborted'
export type PreviewStatus = 'extracting' | 'ready' | 'error' | 'aborted'

export class LaneStateMachine {
  private _state: LaneState = 'idle'

  get state(): LaneState { return this._state }

  onSave(): void {
    if (this._state === 'aborted') return
    if (this._state === 'extracting') { this._state = 'dirty'; return }
    if (this._state === 'dirty') return // coalesce: already queued one re-run
    this._state = 'extracting'
  }

  onOk(): void {
    if (this._state === 'dirty') { this._state = 'extracting'; return } // depth-1 re-run
    if (this._state === 'extracting') { this._state = 'idle'; return }
  }

  onFail(): void {
    if (this._state === 'extracting' || this._state === 'dirty') {
      this._state = 'error'
    }
  }

  onStop(): void {
    this._state = 'aborted'
  }
}

export function derivePreviewStatus(laneStates: LaneState[]): PreviewStatus {
  if (laneStates.every(s => s === 'aborted')) return 'aborted'
  if (laneStates.some(s => s === 'aborted')) return 'aborted'
  // ALL non-aborted lanes must be in error to surface as error (spec §7 lane-scoped rule)
  const nonAborted = laneStates.filter(s => s !== 'aborted')
  if (nonAborted.length > 0 && nonAborted.every(s => s === 'error')) return 'error'
  if (laneStates.some(s => s === 'extracting' || s === 'dirty')) return 'extracting'
  // One lane error + other lane active → 'extracting' (fast-view survives verified failure)
  if (laneStates.some(s => s === 'error')) return 'extracting'
  return 'ready'
}
