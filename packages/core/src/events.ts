/**
 * A typed event bus, built on the browser's own EventTarget and CustomEvent.
 *
 * `M` maps each event name to the data (the `detail`) it carries:
 *
 *   const events = createEmitter<{ beat: { time: number } }>()
 *   events.on('beat', ({ time }) => { ... })
 *   events.emit('beat', { time: 1.5 })
 */

export interface ListenOptions {
  once?: boolean
  /** Abort this signal to remove the listener. One signal can remove many listeners. */
  signal?: AbortSignal
}

export type Listener<T> = (detail: T) => void

export interface Emitter<M extends object> {
  /** Listen to an event. Returns a function that removes the listener. */
  on<K extends keyof M & string>(type: K, listener: Listener<M[K]>, options?: ListenOptions): () => void
  /** Listen to an event one time only. */
  once<K extends keyof M & string>(type: K, listener: Listener<M[K]>, options?: Omit<ListenOptions, 'once'>): () => void
  /**
   * Send an event to all listeners, in the order they were added.
   * If one listener throws, the error is reported and the other listeners still run.
   */
  emit<K extends keyof M & string>(type: K, detail: M[K]): void
}

export function createEmitter<M extends object>(): Emitter<M> {
  const target = new EventTarget()

  const on: Emitter<M>['on'] = (type, listener, options) => {
    const handler = (event: Event) => listener((event as CustomEvent).detail)
    target.addEventListener(type, handler, options)
    return () => target.removeEventListener(type, handler)
  }

  return {
    on,
    once: (type, listener, options) => on(type, listener, { ...options, once: true }),
    emit: (type, detail) => {
      target.dispatchEvent(new CustomEvent(type, { detail }))
    },
  }
}
