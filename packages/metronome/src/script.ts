import { defineModuleScript } from '@loop/core'
import { createDropScene } from './drop'
import type { setup } from './setup'

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(({ root, module, core, on, signal }) => {
  const volume = root.querySelector<HTMLInputElement>('[name=volume]')!
  const accent = root.querySelector<HTMLInputElement>('[name=accent]')!
  const dots = [...root.querySelectorAll<HTMLElement>('.beat')]
  const canvas = root.querySelector('canvas')!

  // A drop falls and lands on every beat. Accented beats get a bigger drop.
  const scene = createDropScene(canvas, { now: () => core.context.currentTime })
  if (!scene) canvas.hidden = true
  signal.addEventListener('abort', () => scene?.destroy())
  const strong = (beatInBar: number) => module.accent && beatInBar === 0

  volume.addEventListener('input', () => module.setVolume(volume.valueAsNumber), { signal })
  accent.addEventListener('change', () => module.setAccent(accent.checked), { signal })

  const showBeat = (index: number) => dots.forEach((dot, i) => dot.classList.toggle('on', i === index))

  // Beat events arrive a bit early (the clock schedules ahead).
  // Wait until the beat really plays, then light the dot.
  on('beat', ({ beatInBar, time }) => {
    // This beat, plus a guess for the next one, so its drop can start to fall in time.
    // The guess is replaced when the real beat event arrives.
    const next = time + 60 / core.clock.bpm
    scene?.plan([
      { time, strong: strong(beatInBar) },
      { time: next, strong: strong((beatInBar + 1) % core.clock.beatsPerBar) },
    ])

    const delay = Math.max(0, (time - core.context.currentTime) * 1000)
    setTimeout(() => core.playing && !signal.aborted && showBeat(beatInBar), delay)
  })
  on('stop', () => {
    showBeat(-1)
    scene?.plan([])
  })
})
