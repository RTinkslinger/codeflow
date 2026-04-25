import { describe, it, expect } from 'vitest'
import { LaneStateMachine, derivePreviewStatus } from './state.js'

describe('LaneStateMachine', () => {
  it('transitions idle → extracting on save', () => {
    const sm = new LaneStateMachine()
    sm.onSave()
    expect(sm.state).toBe('extracting')
  })

  it('transitions extracting → idle on ok', () => {
    const sm = new LaneStateMachine()
    sm.onSave()
    sm.onOk()
    expect(sm.state).toBe('idle')
  })

  it('save during extracting → dirty (coalesce, not queue)', () => {
    const sm = new LaneStateMachine()
    sm.onSave()
    sm.onSave() // second save during extraction
    expect(sm.state).toBe('dirty')
    sm.onSave() // third save still dirty, depth stays 1
    expect(sm.state).toBe('dirty')
  })

  it('dirty → extracting after ok (depth-1 re-run)', () => {
    const sm = new LaneStateMachine()
    sm.onSave(); sm.onSave() // → dirty
    sm.onOk()                 // completes first, triggers re-run
    expect(sm.state).toBe('extracting')
  })

  it('error is sticky until next save', () => {
    const sm = new LaneStateMachine()
    sm.onSave(); sm.onFail()
    expect(sm.state).toBe('error')
    sm.onSave()
    expect(sm.state).toBe('extracting')
  })

  it('aborted is terminal', () => {
    const sm = new LaneStateMachine()
    sm.onStop()
    expect(sm.state).toBe('aborted')
    sm.onSave()
    expect(sm.state).toBe('aborted') // terminal
  })
})

describe('derivePreviewStatus', () => {
  it('any lane error + all lanes failed → error', () => {
    expect(derivePreviewStatus(['error', 'error'])).toBe('error')
  })

  it('one lane error, other lane idle → dirty (fast view survives)', () => {
    expect(derivePreviewStatus(['error', 'idle'])).toBe('extracting')
  })

  it('all idle with output → ready', () => {
    expect(derivePreviewStatus(['idle', 'idle'])).toBe('ready')
  })

  it('any extracting → extracting', () => {
    expect(derivePreviewStatus(['extracting', 'idle'])).toBe('extracting')
  })
})
