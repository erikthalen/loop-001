/**
 * The step sequencer: 6 channels, 16 steps, 6 patterns. A module puts it in its own setup, template, styles
 * and script (see the sampler and the drum machine). It knows nothing about the module: the
 * module decides what a step does.
 */

export { connectSequencer, type SequencerScriptContext } from './script'
export {
  CHANNELS,
  createSequencer,
  PATTERNS,
  type Pattern,
  type SavedPattern,
  type SavedSequence,
  type Sequencer,
  type SequencerOptions,
  STEPS,
} from './sequencer'
export { sequencerStyles } from './styles'
export { sequencerTemplate } from './template'
