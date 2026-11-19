import { VisibilityState, type World } from '@iwsdk/core';
import { events } from './core/events.js';
import { ActivityTracker } from './core/tracker.js';
import type { Mode } from './core/events.js';

/**
 * App-wide tracker the levels report to. Events go out on `events`
 * (src/core/events.ts); Robo, progress and sync subscribe there.
 */
export const learning = new ActivityTracker(events, () => Date.now());

/** 'xr' inside an immersive session, 'web' on the flat page (browser mode). */
export function modeOf(world: World): Mode {
  return world.visibilityState.peek() === VisibilityState.NonImmersive ? 'web' : 'xr';
}

/** With ?debug=1, log every learning event to the console (for testing and for Robo/dashboard work). */
export function logEventsIfDebug(): void {
  try {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
  } catch {
    return;
  }
  events.on((e) => console.info('[Learning]', e.type, e));
}
