/**
 * Level 4 step 1: check the wiring (spec: docs/activities/microcontroller.md).
 * Pure: terminals are numbers, wires are pairs, the LED can be flipped.
 */

/** Board pins. */
export const PIN_5V = 0;
export const PIN_GND = 1;
export const PIN_D13 = 2;
export const PIN_D7 = 3;
export const PIN_D8 = 4;
/** LED legs, as placed (before any flip): A is the long leg (+) unless flipped. */
export const LED_A = 5;
export const LED_B = 6;
/** Sensor pins. */
export const S_VCC = 7;
export const S_TRIG = 8;
export const S_ECHO = 9;
export const S_GND = 10;
export const TERMINAL_COUNT = 11;

export const BOARD_PINS = [PIN_5V, PIN_GND, PIN_D13, PIN_D7, PIN_D8] as const;
export const PIN_NAMES = ['5V', 'GND', 'D13', 'D7', 'D8', 'LED', 'LED', 'VCC', 'TRIG', 'ECHO', 'GND'] as const;

export type WiringCode = 'SHORT_CIRCUIT' | 'LED_REVERSED' | 'NO_GND' | 'LED_WRONG_PIN' | 'SENSOR_MISWIRED';

export type WiringResult =
  | { ok: true }
  | { ok: false; code: WiringCode; detail?: string };

/** The long leg (+) after flips. */
export function ledAnode(ledFlipped: boolean): number {
  return ledFlipped ? LED_B : LED_A;
}

export function ledCathode(ledFlipped: boolean): number {
  return ledFlipped ? LED_A : LED_B;
}

/** For each terminal, the set of board pins on the same net (wires join terminals into nets). */
export function boardPinsByTerminal(wires: ReadonlyArray<readonly [number, number]>): ReadonlyArray<ReadonlySet<number>> {
  const parent = Array.from({ length: TERMINAL_COUNT }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of wires) {
    if (a < 0 || b < 0 || a >= TERMINAL_COUNT || b >= TERMINAL_COUNT) continue;
    parent[find(a)] = find(b);
  }
  const pinsOfRoot = new Map<number, Set<number>>();
  for (const pin of BOARD_PINS) {
    const root = find(pin);
    if (!pinsOfRoot.has(root)) pinsOfRoot.set(root, new Set());
    pinsOfRoot.get(root)!.add(pin);
  }
  return parent.map((_, t) => pinsOfRoot.get(find(t)) ?? new Set<number>());
}

function only(set: ReadonlySet<number>, pin: number): boolean {
  return set.size === 1 && set.has(pin);
}

/** First wiring problem, in the spec's order, or ok. */
export function checkWiring(wires: ReadonlyArray<readonly [number, number]>, ledFlipped: boolean): WiringResult {
  const pins = boardPinsByTerminal(wires);
  if (pins[PIN_5V].has(PIN_GND)) return { ok: false, code: 'SHORT_CIRCUIT' };

  const anode = pins[ledAnode(ledFlipped)];
  const cathode = pins[ledCathode(ledFlipped)];
  if (!(only(anode, PIN_D13) && only(cathode, PIN_GND))) {
    if (only(anode, PIN_GND) && only(cathode, PIN_D13)) return { ok: false, code: 'LED_REVERSED' };
    if (only(anode, PIN_D13)) return { ok: false, code: 'NO_GND', detail: 'LED' };
    return { ok: false, code: 'LED_WRONG_PIN' };
  }

  if (!only(pins[S_GND], PIN_GND)) return { ok: false, code: 'NO_GND', detail: 'sensor' };
  const expected: [number, number, string][] = [
    [S_VCC, PIN_5V, 'VCC'],
    [S_TRIG, PIN_D7, 'TRIG'],
    [S_ECHO, PIN_D8, 'ECHO'],
  ];
  for (const [terminal, pin, name] of expected) {
    if (!only(pins[terminal], pin)) return { ok: false, code: 'SENSOR_MISWIRED', detail: name };
  }
  return { ok: true };
}

/** The correct wiring (for tests and the spec). */
export const SOLUTION_WIRES: ReadonlyArray<readonly [number, number]> = [
  [LED_A, PIN_D13],
  [LED_B, PIN_GND],
  [S_VCC, PIN_5V],
  [S_GND, PIN_GND],
  [S_TRIG, PIN_D7],
  [S_ECHO, PIN_D8],
];
