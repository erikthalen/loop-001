import { defineModuleScript } from '@loop/core'
import { createOdometer } from '@loop/ui'
import { COUNTER_WHEELS, drawReels, packRadius, type ReelColors } from './reels'
import type { setup } from './setup'

/** How much tape a full reel holds, in seconds at full speed (the packs change size slowly). */
const REEL_SECONDS = 180
/** How long the counter takes to slide back to 0 when a rewind starts, in ms. */
const RESET_MS = 1000
/** How many px the tape moves in one second at full speed (how fast the reels turn). */
const TAPE_PX = 110

// JS: connect the HTML to the module. Everything is removed for us on unmount.
export const script = defineModuleScript<typeof setup>(
  ({ root, module, core, on, signal }) => {
    const play = root.querySelector<HTMLInputElement>('[name=play]')!
    const rewind = root.querySelector<HTMLButtonElement>('[name=rewind]')!
    const volume = root.querySelector<HTMLInputElement>('[name=volume]')!
    const display = root.querySelector<HTMLElement>('.display')!
    const canvas = root.querySelector<HTMLCanvasElement>('.reels')!
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

    // Play: checked = the core plays. The checkbox follows the core, so it is right also when
    // something else starts or stops it (for example another Master module).
    // While the tape slows down after a stop, it is not checked (it stops).
    // Rewind: pressed while the tape rewinds to the start. Click it again to stop the rewind there.
    const showPlaying = () => {
      play.checked = core.playing && !core.stopping
      rewind.setAttribute('aria-pressed', String(core.rewinding))
    }
    rewind.addEventListener(
      'click',
      async () => {
        if (core.rewinding) {
          core.stop()
        } else {
          try {
            await core.rewind()
          } catch (error) {
            console.error('Could not rewind:', error)
          }
        }
        showPlaying()
      },
      { signal },
    )
    play.addEventListener(
      'change',
      async () => {
        if (play.checked) {
          try {
            await core.start()
          } catch (error) {
            console.error('Could not start playback:', error)
          }
        } else {
          core.stop()
        }
        showPlaying()
      },
      { signal },
    )
    on('start', showPlaying)
    on('stop', showPlaying)
    on('speedchange', showPlaying)
    on('rewindend', showPlaying)
    showPlaying()

    // The master volume: 0 to 100 on the slider, 0 to 1 in the module.
    const showVolume = () =>
      volume.setAttribute(
        'aria-valuetext',
        `${Math.round(module.volume * 100)} percent`,
      )
    volume.addEventListener(
      'input',
      () => {
        module.setVolume(volume.valueAsNumber / 100)
        showVolume()
      },
      { signal },
    )
    showVolume()

    // ——— The reels (reels.ts) ———
    // The canvas cannot use CSS variables, so read the colors from the CSS.
    // A hidden element turns any CSS color (also light-dark()) into rgb().
    // Read them again when the page switches between light and dark mode.
    const probe = document.createElement('span')
    probe.hidden = true
    display.append(probe)
    const resolve = (color: string) => {
      probe.style.color = color
      return getComputedStyle(probe).color
    }
    let colors: ReelColors
    const readColors = () => {
      colors = {
        screen: resolve('var(--screen)'),
        ink: resolve('var(--ink)'),
        line: resolve('var(--line)'),
        dim: resolve('var(--dim)'),
        muted: resolve('var(--muted)'),
        primary: resolve('var(--loop-primary)'),
        red: resolve('var(--red)'),
        font: getComputedStyle(display).fontFamily,
      }
    }
    readColors()
    matchMedia('(prefers-color-scheme: dark)').addEventListener(
      'change',
      readColors,
      { signal },
    )

    // The reels turn with the tape: each frame, as far as the tape really moved (with the speed
    // ramps and the rewind). A reel with less tape on it turns faster. Less motion: they stand still.
    const turns: [number, number] = [0, 0]
    let travel = 0
    let last = core.context.currentTime
    let said = ''
    // The counter counts steps from where the last rewind went to, on digit wheels that roll (see
    // createOdometer in @loop/ui: the higher wheels roll too, not only the last one). When a rewind
    // starts, each wheel slides back to 0 in RESET_MS (ease-out), like a counter's reset button; it
    // stays at 0 until the rewind is over. (It does not follow the tape on the way back: this looks
    // better.) Then it rolls on from 0. Less motion: the wheels show the steps as they are.
    let origin = 0
    const counter = createOdometer(COUNTER_WHEELS)
    let wheels: readonly number[] = counter.wheels
    let reset: { from: readonly number[]; start: number } | null = null
    let lastFrame = performance.now()
    on('rewind', ({ step }) => {
      origin = step
      reset = { from: [...wheels], start: performance.now() }
    })
    let frame = 0
    const draw = () => {
      const frameTime = performance.now()
      const seconds = Math.min(0.05, (frameTime - lastFrame) / 1000)
      lastFrame = frameTime
      const now = core.context.currentTime
      const position = core.clock.positionAt(now)
      const tape = Math.min(1, Math.max(0, position / REEL_SECONDS))
      const moved = reducedMotion.matches
        ? 0
        : core.clock.travel(last, now) * TAPE_PX
      last = now
      // The tape goes from the left reel to the right one: both turn counterclockwise.
      turns[0] -= moved / packRadius(1 - tape)
      turns[1] -= moved / packRadius(tape)
      travel += moved
      const speed = core.clock.speedAt(now)
      const transport =
        speed < -0.001 ? 'rewind' : speed > 0.001 ? 'play' : 'still'
      if (reset) {
        const t = reducedMotion.matches
          ? 1
          : Math.min(1, (performance.now() - reset.start) / RESET_MS)
        const eased = 1 - (1 - t) ** 3
        wheels = reset.from.map((wheel) => wheel * (1 - eased))
        // Back to counting (from 0) when the slide is done and the rewind is over (or was stopped).
        if (t === 1 && !core.rewinding) {
          reset = null
          counter.jump(0)
        }
      } else {
        const steps = core.clock.stepsAt(now) - origin
        if (reducedMotion.matches) counter.jump(steps)
        else counter.roll(steps, seconds)
        wheels = counter.wheels
      }
      drawReels(canvas, { turns, tape, travel, wheels, transport }, colors)
      // For screen readers: what the tape does, in words (only when it changes).
      const words = {
        play: 'Tape reels: playing',
        rewind: 'Tape reels: rewinding',
        still: 'Tape reels: still',
      }[transport]
      if (words !== said) canvas.setAttribute('aria-label', (said = words))
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    signal.addEventListener('abort', () => cancelAnimationFrame(frame))
  },
)
