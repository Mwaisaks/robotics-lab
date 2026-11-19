import type { Entity } from '@iwsdk/core';

/**
 * Browser mode (mouse/touch, no headset) shared state. Kept in its own module so
 * level systems and the arm can read it without importing the browser systems.
 */
export const WEB = {
  /** True after PLAY IN BROWSER, until the player goes back to the start screen. */
  active: false,
  /** The part being dragged with mouse/touch (the arm follows it like a held part). */
  dragged: null as Entity | null,
  /** Set by BuildSystem: a Build-the-robot part was dropped with mouse/touch (same as a hand release). */
  onBuildDrop: (_part: Entity): void => undefined,
  /** Set by BuildSystem: a mouse/touch drag of a Build part was cancelled; put it back. */
  onBuildCancel: (_part: Entity): void => undefined,
};
