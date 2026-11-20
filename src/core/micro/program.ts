/**
 * Level 4 steps 2 and 3: the IF / ELSE program and the live test
 * (spec: docs/activities/microcontroller.md). Pure.
 */

export type MicroBlock = 'if_near' | 'else' | 'led_on' | 'led_off';
export const MAX_MICRO_BLOCKS = 4;
/** "Near" means closer than this. */
export const NEAR_CM = 20;

export type ProgramCode = 'PROGRAM_INCOMPLETE' | 'LOGIC_REVERSED';

/** What the program does: LED state when near and when far. */
export interface MicroRule {
  near: boolean;
  far: boolean;
}

export type ProgramResult = { ok: true; rule: MicroRule } | { ok: false; code: ProgramCode; rule?: MicroRule };

function isAction(b: MicroBlock | undefined): b is 'led_on' | 'led_off' {
  return b === 'led_on' || b === 'led_off';
}

/** Parses IF NEAR, action, ELSE, action. Anything else is incomplete. */
export function parseProgram(blocks: readonly MicroBlock[]): MicroRule | undefined {
  if (blocks.length !== 4) return undefined;
  const [a, b, c, d] = blocks;
  if (a !== 'if_near' || c !== 'else' || !isAction(b) || !isAction(d)) return undefined;
  return { near: b === 'led_on', far: d === 'led_on' };
}

export function checkProgram(blocks: readonly MicroBlock[]): ProgramResult {
  const rule = parseProgram(blocks);
  if (!rule) return { ok: false, code: 'PROGRAM_INCOMPLETE' };
  if (!(rule.near && !rule.far)) return { ok: false, code: 'LOGIC_REVERSED', rule };
  return { ok: true, rule };
}

/** LED state for a distance in cm. */
export function ledFor(rule: MicroRule, distanceCm: number): boolean {
  return distanceCm < NEAR_CM ? rule.near : rule.far;
}

/** Adds a block if there is room; returns the same array when full. */
export function addBlock(blocks: readonly MicroBlock[], block: MicroBlock): readonly MicroBlock[] {
  return blocks.length >= MAX_MICRO_BLOCKS ? blocks : [...blocks, block];
}

/**
 * Step 3: the test is complete once the LED has been ON and then OFF again.
 * Feed it every LED state; it returns true from the moment the test is passed.
 */
export class RunTest {
  private sawOn = false;
  private passed = false;

  update(ledOn: boolean): boolean {
    if (ledOn) this.sawOn = true;
    else if (this.sawOn) this.passed = true;
    return this.passed;
  }

  get done(): boolean {
    return this.passed;
  }

  get hasBeenOn(): boolean {
    return this.sawOn;
  }
}
