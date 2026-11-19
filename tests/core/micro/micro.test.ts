import { describe, expect, it } from 'vitest';
import {
  checkWiring,
  LED_A,
  LED_B,
  PIN_5V,
  PIN_D13,
  PIN_D7,
  PIN_D8,
  PIN_GND,
  SOLUTION_WIRES,
  S_ECHO,
  S_GND,
  S_TRIG,
  S_VCC,
} from '../../../src/core/micro/wiring.js';
import { addBlock, checkProgram, ledFor, MAX_MICRO_BLOCKS, RunTest, type MicroBlock } from '../../../src/core/micro/program.js';

type Wire = readonly [number, number];
const without = (drop: Wire): Wire[] => SOLUTION_WIRES.filter((w) => w !== drop);
const SENSOR: Wire[] = [
  [S_VCC, PIN_5V],
  [S_GND, PIN_GND],
  [S_TRIG, PIN_D7],
  [S_ECHO, PIN_D8],
];

describe('checkWiring', () => {
  it('accepts the solution, with wire ends in either order', () => {
    expect(checkWiring(SOLUTION_WIRES, false)).toEqual({ ok: true });
    expect(checkWiring(SOLUTION_WIRES.map(([a, b]) => [b, a] as const), false)).toEqual({ ok: true });
  });

  it('accepts the flipped LED wired the other way', () => {
    const wires: Wire[] = [[LED_B, PIN_D13], [LED_A, PIN_GND], ...SENSOR];
    expect(checkWiring(wires, true)).toEqual({ ok: true });
  });

  it('reports nothing wired as LED_WRONG_PIN first', () => {
    expect(checkWiring([], false)).toMatchObject({ ok: false, code: 'LED_WRONG_PIN' });
  });

  it('SHORT_CIRCUIT when 5V meets GND, even through a part terminal', () => {
    expect(checkWiring([...SOLUTION_WIRES, [PIN_5V, PIN_GND]], false)).toMatchObject({ code: 'SHORT_CIRCUIT' });
    expect(checkWiring([[S_VCC, PIN_5V], [S_VCC, PIN_GND]], false)).toMatchObject({ code: 'SHORT_CIRCUIT' });
  });

  it('LED_REVERSED when the legs are swapped', () => {
    expect(checkWiring(SOLUTION_WIRES, true)).toMatchObject({ code: 'LED_REVERSED' });
  });

  it('NO_GND when the LED short leg is not on GND', () => {
    expect(checkWiring(without(SOLUTION_WIRES[1]), false)).toMatchObject({ code: 'NO_GND', detail: 'LED' });
  });

  it('LED_WRONG_PIN when the long leg goes to another pin', () => {
    const wires: Wire[] = [[LED_A, PIN_D7], [LED_B, PIN_GND], ...SENSOR];
    expect(checkWiring(wires, false)).toMatchObject({ code: 'LED_WRONG_PIN' });
  });

  it('NO_GND for the sensor ground', () => {
    expect(checkWiring(without(SOLUTION_WIRES[3]), false)).toMatchObject({ code: 'NO_GND', detail: 'sensor' });
  });

  it('SENSOR_MISWIRED names the pin', () => {
    expect(checkWiring(without(SOLUTION_WIRES[2]), false)).toMatchObject({ code: 'SENSOR_MISWIRED', detail: 'VCC' });
    const swapped: Wire[] = [[LED_A, PIN_D13], [LED_B, PIN_GND], [S_VCC, PIN_5V], [S_GND, PIN_GND], [S_TRIG, PIN_D8], [S_ECHO, PIN_D7]];
    expect(checkWiring(swapped, false)).toMatchObject({ code: 'SENSOR_MISWIRED', detail: 'TRIG' });
  });

  it('SENSOR_MISWIRED when two signal pins are joined', () => {
    expect(checkWiring([...SOLUTION_WIRES, [PIN_D7, PIN_D8]], false)).toMatchObject({ code: 'SENSOR_MISWIRED', detail: 'TRIG' });
  });

  it('a shared GND net is fine (LED and sensor GND wired together, one to GND)', () => {
    const wires: Wire[] = [[LED_A, PIN_D13], [LED_B, S_GND], [S_GND, PIN_GND], [S_VCC, PIN_5V], [S_TRIG, PIN_D7], [S_ECHO, PIN_D8]];
    expect(checkWiring(wires, false)).toEqual({ ok: true });
  });
});

describe('checkProgram', () => {
  const good: MicroBlock[] = ['if_near', 'led_on', 'else', 'led_off'];

  it('accepts IF NEAR, LED ON, ELSE, LED OFF', () => {
    expect(checkProgram(good)).toEqual({ ok: true, rule: { near: true, far: false } });
  });

  it('PROGRAM_INCOMPLETE for empty, short or misordered programs', () => {
    expect(checkProgram([])).toMatchObject({ code: 'PROGRAM_INCOMPLETE' });
    expect(checkProgram(['if_near', 'led_on'])).toMatchObject({ code: 'PROGRAM_INCOMPLETE' });
    expect(checkProgram(['led_on', 'if_near', 'else', 'led_off'])).toMatchObject({ code: 'PROGRAM_INCOMPLETE' });
    expect(checkProgram(['if_near', 'else', 'led_on', 'led_off'])).toMatchObject({ code: 'PROGRAM_INCOMPLETE' });
  });

  it('LOGIC_REVERSED when the branches are swapped or the same', () => {
    expect(checkProgram(['if_near', 'led_off', 'else', 'led_on'])).toMatchObject({ code: 'LOGIC_REVERSED' });
    expect(checkProgram(['if_near', 'led_on', 'else', 'led_on'])).toMatchObject({ code: 'LOGIC_REVERSED' });
  });

  it('ledFor switches at 20 cm', () => {
    const rule = { near: true, far: false };
    expect(ledFor(rule, 5)).toBe(true);
    expect(ledFor(rule, 19.9)).toBe(true);
    expect(ledFor(rule, 20)).toBe(false);
    expect(ledFor(rule, 60)).toBe(false);
  });

  it('addBlock stops at the slot limit', () => {
    let blocks: readonly MicroBlock[] = [];
    for (let i = 0; i < MAX_MICRO_BLOCKS + 2; i++) blocks = addBlock(blocks, 'led_on');
    expect(blocks).toHaveLength(MAX_MICRO_BLOCKS);
  });
});

describe('RunTest', () => {
  it('passes only after ON then OFF', () => {
    const t = new RunTest();
    expect(t.update(false)).toBe(false);
    expect(t.update(true)).toBe(false);
    expect(t.update(true)).toBe(false);
    expect(t.update(false)).toBe(true);
    expect(t.done).toBe(true);
    expect(t.update(true)).toBe(true);
  });
});
