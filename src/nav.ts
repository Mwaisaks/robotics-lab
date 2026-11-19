/**
 * Navigation hooks between GameSystem (menu, Level 1) and ProgramSystem (Level 2),
 * so the two systems don't import each other. Each system fills in its own hooks.
 */
/** Level 1 phases that allow moving parts (GameSystem). */
export const PHASE_PLAYING = 1;
export const PHASE_TUTORIAL = 3;
export const PHASE_MENU = 4;
export const PHASE_PROGRAM = 5;
export const PHASE_CIRCUIT = 6;
export const PHASE_BUILD = 7;
export const PHASE_MICRO = 8;
/** Level 4 (Microcontroller lab) switch: false shows "4  COMING SOON" in the menu and the button does nothing. */
export const MICRO_ENABLED = true;

export const NAV = {
  /** Set by GameSystem: show the level menu. */
  toMenu: (): void => undefined,
  /** Set by ProgramSystem: start Level 2. */
  startProgram: (): void => undefined,
  /** Set by ProgramSystem: clean up Level 2 objects. */
  stopProgram: (): void => undefined,
  /** Set by CircuitSystem: start / clean up Level 3. */
  startCircuit: (): void => undefined,
  stopCircuit: (): void => undefined,
  /** Set by BuildSystem: start / clean up Level 3 Part 2. */
  startBuild: (): void => undefined,
  stopBuild: (): void => undefined,
  /** Set by MicroSystem: start / clean up Level 4, Microcontroller lab. */
  startMicro: (): void => undefined,
  stopMicro: (): void => undefined,
  /** Set by GameSystem: open a level (NEXT LEVEL buttons). 4 = Level 3 Part 2, 5 = Level 4 (microcontroller). */
  startLevel: (_level: 1 | 2 | 3 | 4 | 5): void => undefined,
  /** Set by the start screen: browser mode EXIT goes back to it. */
  exitToStart: (): void => undefined,
};
