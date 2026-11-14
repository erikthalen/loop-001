import { describe, expect, it, vi } from 'vitest'
import { createEmitter } from './events'

type Map = { ping: { n: number }; pong: { s: string } }

describe('createEmitter', () => {
  it('calls listeners with the detail, in order', () => {
    const events = createEmitter<Map>()
    const calls: string[] = []
    events.on('ping', ({ n }) => calls.push(`a${n}`))
    events.on('ping', ({ n }) => calls.push(`b${n}`))
    events.emit('ping', { n: 1 })
    expect(calls).toEqual(['a1', 'b1'])
  })

  it('only calls listeners of the same event type', () => {
    const events = createEmitter<Map>()
    const pong = vi.fn()
    events.on('pong', pong)
    events.emit('ping', { n: 1 })
    expect(pong).not.toHaveBeenCalled()
  })

  it('removes a listener with the returned function', () => {
    const events = createEmitter<Map>()
    const listener = vi.fn()
    const off = events.on('ping', listener)
    off()
    events.emit('ping', { n: 1 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('removes listeners with an AbortSignal', () => {
    const events = createEmitter<Map>()
    const controller = new AbortController()
    const a = vi.fn()
    const b = vi.fn()
    events.on('ping', a, { signal: controller.signal })
    events.on('pong', b, { signal: controller.signal })
    controller.abort()
    events.emit('ping', { n: 1 })
    events.emit('pong', { s: 'x' })
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })

  it('once() runs one time only', () => {
    const events = createEmitter<Map>()
    const listener = vi.fn()
    events.once('ping', listener)
    events.emit('ping', { n: 1 })
    events.emit('ping', { n: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ n: 1 })
  })
})
