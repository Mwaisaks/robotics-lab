/**
 * Navigation hooks between GameSystem (menu, Level 1) and ProgramSystem (Level 2),
 * so the two systems don't import each other. Each system fills in its own hooks.
 */
export const PHASE_MENU = 4;
export const PHASE_PROGRAM = 5;
export const PHASE_CIRCUIT = 6;
export const PHASE_BUILD = 7;

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
  /** Set by GameSystem: open a level (NEXT LEVEL buttons). 4 = Level 3 Part 2. */
  startLevel: (_level: 1 | 2 | 3 | 4): void => undefined,
};
