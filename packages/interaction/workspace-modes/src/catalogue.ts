/**
 * The model-facing catalogue: the ids the tool accepts and the one line each of
 * them means. What a layout *looks* like belongs to the browser half — this
 * module owns only what the model may ask for, so the tool description and the
 * accepted enum cannot drift apart.
 *
 * The ids are device-shaped jobs as well as desk shapes: a person on a phone is
 * offered capture and read, a person at a desk is offered focus and studio. The
 * model may ask for any of them — a layout is a specification the shell renders
 * wherever it can — and the browser half decides which ones a given device's
 * picker shows.
 */
import type { WorkspaceLayoutId } from './types.ts'

/** Every layout this build accepts, in the order the tool description lists them. */
export const WORKSPACE_LAYOUTS = [
  'default', 'capture', 'read', 'focus', 'zen', 'workbench', 'counter', 'studio', 'wall',
] as const satisfies readonly WorkspaceLayoutId[]

/** One model-facing sentence per layout, carried into the tool description. */
export const WORKSPACE_LAYOUT_PURPOSES: Record<WorkspaceLayoutId, string> = {
  default: 'the shell\'s own shape: the session list open, the composer at the bottom, the pane closed',
  capture: 'the composer leads and the session list becomes a page the person pulls in (a phone shape)',
  read: 'the composer is out of the way and the writing takes the screen in roomier type (a phone shape)',
  focus: 'the session list out, with the pane opened wide beside the work',
  zen: 'both side surfaces out, the text held to a narrow reading measure',
  workbench: 'the pane stays beside the work instead of being opened each time',
  counter: 'a shape for showing someone: no navigation, no composer, and leaving takes a deliberate move',
  studio: 'dense chrome with the pane opened wide, for long making sessions',
  wall: 'edge to edge, with no composer and no navigation — a screen nobody is sitting at',
}
