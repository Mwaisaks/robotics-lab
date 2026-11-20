import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  createSystem,
  CylinderGeometry,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Pressed,
  QuadraticBezierCurve3,
  RayInteractable,
  SphereGeometry,
  TubeGeometry,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { CircuitTap, GameState } from './lab-components.js';
import { ARM_SIGNAL, LAYOUT, placeGamePanel, toWorld } from './lab.js';
import { NAV, PHASE_MICRO } from './nav.js';
import { playSfx } from './sfx.js';
import type { ActivityId, MistakeCode } from './core/events.js';
import { mistakeStars } from './core/stars.js';
import { learning, modeOf } from './learning.js';
import {
  checkWiring,
  LED_A,
  LED_B,
  ledAnode,
  ledCathode,
  PIN_5V,
  PIN_D13,
  PIN_D7,
  PIN_D8,
  PIN_GND,
  S_ECHO,
  S_GND,
  S_TRIG,
  S_VCC,
  TERMINAL_COUNT,
  type WiringCode,
} from './core/micro/wiring.js';
import {
  addBlock,
  checkProgram,
  ledFor,
  MAX_MICRO_BLOCKS,
  RunTest,
  type MicroBlock,
  type MicroRule,
  type ProgramCode,
} from './core/micro/program.js';

/**
 * Level 4, "Microcontroller lab" (spec: docs/activities/microcontroller.md).
 * Rules live in src/core/micro; this system builds the bench from simple shapes,
 * turns taps and button presses into core inputs and shows the result.
 * 1 Wire it (tap two dots = a wire, as Level 3) -> POWER.
 * 2 Program it (IF NEAR / LED ON / ELSE / LED OFF blocks, as Level 2) -> RUN.
 * 3 Test it: distance = closest fingertip to the sensor in the headset, or the
 *   DISTANCE buttons (browser, also in the headset). Done when the LED goes ON then OFF.
 */

/**
 * TODO(integrator): add 'micro' to ActivityId and the codes to MISTAKE / MISTAKE_CODES
 * in src/core/events.ts, then drop these casts.
 */
const MICRO = 'micro' as unknown as ActivityId;
type MicroCode = WiringCode | ProgramCode;
const asCode = (code: MicroCode) => code as unknown as MistakeCode;

/** TODO(i18n): move to src/shell/i18n.ts (en + sw). Max 5 words each. */
const TEXT = {
  wire: 'Wire the LED and sensor',
  pickAnother: 'Point + pinch another pin',
  added: 'Wire added',
  already: 'Already wired',
  tooMany: 'Too many wires. Try UNDO.',
  flipped: 'LED flipped',
  wired: 'Wired! Now program it.',
  program: 'IF NEAR: LED ON, ELSE OFF',
  programOk: 'Move your hand near it',
  testFar: 'Now move it away',
  done: 'It works!',
  step: (n: number) => `LEVEL 4  STEP ${n}/3`,
  wiring: {
    SHORT_CIRCUIT: '5V touches GND: short!',
    LED_REVERSED: 'Flip the LED',
    NO_GND: 'Connect GND',
    LED_WRONG_PIN: 'LED + goes to D13',
    SENSOR_MISWIRED: 'Check the sensor pins',
  } satisfies Record<WiringCode, string>,
  programErr: {
    PROGRAM_INCOMPLETE: 'IF NEAR, action, ELSE, action',
    LOGIC_REVERSED: 'LED is doing the opposite',
  } satisfies Record<ProgramCode, string>,
};

/** Table-local terminal positions (x, z). Board pins on the back header, LED left, sensor right. */
const BOARD_X = -0.02;
const BOARD_Z = -0.05;
const TERM_POS: [number, number][] = [];
TERM_POS[PIN_5V] = [-0.11, -0.095];
TERM_POS[PIN_GND] = [-0.07, -0.095];
TERM_POS[PIN_D13] = [0.0, -0.095];
TERM_POS[PIN_D7] = [0.04, -0.095];
TERM_POS[PIN_D8] = [0.08, -0.095];
TERM_POS[LED_A] = [-0.3, 0.07];
TERM_POS[LED_B] = [-0.22, 0.07];
TERM_POS[S_VCC] = [0.15, 0.07];
TERM_POS[S_TRIG] = [0.19, 0.07];
TERM_POS[S_ECHO] = [0.23, 0.07];
TERM_POS[S_GND] = [0.27, 0.07];
const LED_TAP = TERMINAL_COUNT;
const SENSOR_X = 0.21;
const SENSOR_Z = -0.01;
const TERM_Y = 0.02;
const TERM_R = 0.012;
const MAX_WIRES = 12;
/** DISTANCE buttons, cm. */
const DISTANCES = [5, 10, 15, 25, 40];
/** A fingertip closer than this to the sensor overrides the buttons (headset). */
const HAND_RANGE_CM = 60;

const RED = 0xe5484d;
const BLACK = 0x23252b;
const METAL = 0xb8bcc4;
const PIN_GOLD = 0xd8b04a;
const SELECTED = 0xffe14d;
const WIRE_COLORS = [0xe5484d, 0x3e8ef7, 0xf5c542, 0x3ddc84, 0xc678dd, 0xff9f43];
const BLOCK_COLOR: Record<MicroBlock, string> = {
  if_near: '#2f7de1',
  else: '#7c4fd0',
  led_on: '#d9822b',
  led_off: '#5b6170',
};
const BLOCK_TEXT: Record<MicroBlock, string> = {
  if_near: 'IF NEAR',
  else: 'ELSE',
  led_on: 'LED ON',
  led_off: 'LED OFF',
};
const BLOCKS: MicroBlock[] = ['if_near', 'led_on', 'else', 'led_off'];

type UIElement = NonNullable<ReturnType<UIKitMLAsset['getElementById']>>;

// Shared geometry and materials (module level, reused across visits).
const termGeo = new SphereGeometry(TERM_R, 12, 8);
const wireMats = WIRE_COLORS.map((color) => new MeshStandardMaterial({ color, roughness: 0.5 }));
const blackMat = new MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 });
const metalMat = new MeshStandardMaterial({ color: METAL, roughness: 0.3, metalness: 0.6 });

/** Board top: blue with printed pin names. No logos or brand names. */
function boardTexture(): CanvasTexture {
  const w = 512;
  const h = 336;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1f5fae';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8fb6e6';
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#ffffff';
  g.font = 'bold 38px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Board is 0.21 x 0.14 m centred on (BOARD_X, BOARD_Z); map pin x/z into the texture.
  const u = (x: number) => ((x - BOARD_X) / 0.21 + 0.5) * w;
  const v = (z: number) => ((z - BOARD_Z) / 0.14 + 0.5) * h;
  const names: [number, string][] = [
    [PIN_5V, '5V'],
    [PIN_GND, 'GND'],
    [PIN_D13, 'D13'],
    [PIN_D7, 'D7'],
    [PIN_D8, 'D8'],
  ];
  for (const [pin, name] of names) g.fillText(name, u(TERM_POS[pin][0]), v(TERM_POS[pin][1] + 0.025));
  g.font = 'bold 26px sans-serif';
  g.fillStyle = '#cfe0f5';
  g.fillText('MICROCONTROLLER', w * 0.62, h * 0.86);
  return new CanvasTexture(canvas);
}

function labelTexture(text: string, width = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(20,22,28,0.85)';
  g.fillRect(0, 0, width, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 32px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, width / 2, 34);
  return new CanvasTexture(canvas);
}

/** Sensor pin names spaced to sit under the four pins. */
function sensorPinTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(20,22,28,0.85)';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ['VCC', 'TRIG', 'ECHO', 'GND'].forEach((t, i) => g.fillText(t, 64 + i * 128, 34));
  return new CanvasTexture(canvas);
}

export class MicroSystem extends createSystem({
  game: { required: [GameState] },
  taps: { required: [CircuitTap, Pressed] },
}) {
  private ui: Record<string, UIElement | undefined> = {};
  private uiReady = false;
  private lastPress: Record<string, number> = {};
  private readyAt = 0;
  private entities: Entity[] = [];
  private wireRoot?: Group;
  private termMats: MeshStandardMaterial[] = [];
  private termMeshes: Mesh[] = [];
  private wires: [number, number][] = [];
  private wireMeshes: Mesh[] = [];
  private selected = -1;
  private tapAt: number[] = [];
  private ledFlipped = false;
  private ledGroup?: Group;
  private bulbMat?: MeshStandardMaterial;
  private halo?: Mesh;
  private sensorEye?: Mesh;
  private handBlock?: Group;
  private step = 1;
  private blocks: readonly MicroBlock[] = [];
  private rule: MicroRule | null = null;
  private test = new RunTest();
  private sliderCm = 40;
  private distanceCm = 40;
  private ledOn = false;
  private shownDist = -1;
  private shownLed = false;
  private finishIn = -1;
  private time = 0;
  private a = new Vector3();
  private b = new Vector3();
  private sensorPos = new Vector3();
  private tip = new Vector3();

  init(): void {
    NAV.startMicro = () => this.start();
    NAV.stopMicro = () => this.stop();
    this.queries.taps.subscribe('qualify', (e) => this.onTap(e.getValue(CircuitTap, 'id') ?? -1));
  }

  private phase(): number {
    for (const e of this.queries.game.entities) return e.getValue(GameState, 'phase') ?? 0;
    return 0;
  }

  /** pointerdown only, debounced, ignored for 0.6 s after the view opens (as in Levels 2-3). */
  private bind(id: string, fn: () => void): void {
    const handler = () => {
      if (this.phase() !== PHASE_MICRO) return;
      const now = performance.now();
      if (now < this.readyAt) return;
      if (now - (this.lastPress[id] ?? 0) < 350) return;
      this.lastPress[id] = now;
      fn();
    };
    this.ui[id]?.addEventListener('pointerdown', handler);
    this.cleanupFuncs.push(() => this.ui[id]?.removeEventListener('pointerdown', handler));
  }

  private wireUI(): void {
    if (this.uiReady) return;
    const panel = this.world.getSceneObject<UIKitMLAsset>('game-panel');
    if (panel == null) return;
    const ids = [
      'micro-step', 'micro-msg', 'micro-wire', 'micro-prog', 'micro-test', 'micro-done', 'micro-dist',
      'micro-undo', 'micro-clear', 'micro-power', 'micro-p-undo', 'micro-p-clear', 'micro-run',
      'menu-button-micro', 'menu-button-micro-done',
      ...BLOCKS.map((b) => `micro-b-${b}`),
      ...DISTANCES.map((_, i) => `micro-d-${i}`),
    ];
    for (let i = 0; i < MAX_MICRO_BLOCKS; i++) ids.push(`micro-slot-${i}`, `micro-slot-${i}-t`);
    for (const id of ids) this.ui[id] = panel.getElementById(id) ?? undefined;

    this.bind('micro-undo', () => {
      if (this.step !== 1) return;
      this.wires.pop();
      this.rebuildWires();
      this.setMsg(TEXT.wire);
      learning.action(MICRO, 'undo');
    });
    this.bind('micro-clear', () => {
      if (this.step !== 1) return;
      this.wires.length = 0;
      this.select(-1);
      this.rebuildWires();
      this.setMsg(TEXT.wire);
      learning.action(MICRO, 'clear');
    });
    this.bind('micro-power', () => this.power());
    for (const block of BLOCKS) {
      this.bind(`micro-b-${block}`, () => {
        if (this.step !== 2) return;
        const next = addBlock(this.blocks, block);
        if (next === this.blocks) return;
        this.blocks = next;
        playSfx('grab');
        learning.action(MICRO, `add_${block}`);
        this.renderSlots();
      });
    }
    this.bind('micro-p-undo', () => {
      if (this.step !== 2) return;
      this.blocks = this.blocks.slice(0, -1);
      this.renderSlots();
      learning.action(MICRO, 'undo');
    });
    this.bind('micro-p-clear', () => {
      if (this.step !== 2) return;
      this.blocks = [];
      this.renderSlots();
      learning.action(MICRO, 'clear');
    });
    this.bind('micro-run', () => this.run());
    DISTANCES.forEach((cm, i) => {
      this.bind(`micro-d-${i}`, () => {
        if (this.step !== 3) return;
        this.sliderCm = cm;
        learning.action(MICRO, `distance_${cm}`);
      });
    });
    this.bind('menu-button-micro', () => NAV.toMenu());
    this.bind('menu-button-micro-done', () => NAV.toMenu());
    this.uiReady = true;
  }

  private setMsg(text: string): void {
    this.ui['micro-msg']?.setProperties({ text });
  }

  private showStep(step: number): void {
    this.step = step;
    this.ui['micro-step']?.setProperties({ text: TEXT.step(Math.min(step, 3)) });
    this.ui['micro-wire']?.setProperties({ display: step === 1 ? 'flex' : 'none' });
    this.ui['micro-prog']?.setProperties({ display: step === 2 ? 'flex' : 'none' });
    this.ui['micro-test']?.setProperties({ display: step === 3 ? 'flex' : 'none' });
    this.ui['micro-done']?.setProperties({ display: step === 4 ? 'flex' : 'none' });
    if (this.handBlock) this.handBlock.visible = step === 3;
  }

  start(): void {
    this.wireUI();
    this.build();
    placeGamePanel(this.world);
    this.readyAt = performance.now() + 600;
    this.wires.length = 0;
    this.selected = -1;
    this.ledFlipped = false;
    this.blocks = [];
    this.rule = null;
    this.test = new RunTest();
    this.sliderCm = 40;
    this.distanceCm = 40;
    this.ledOn = false;
    this.shownDist = -1;
    this.finishIn = -1;
    this.applyLed();
    this.setLedLight(false);
    this.rebuildWires();
    this.renderSlots();
    this.showStep(1);
    this.setMsg(TEXT.wire);
    learning.start(MICRO, 0, modeOf(this.world));
  }

  stop(): void {
    if (learning.current === MICRO) learning.abandon();
    for (const m of this.wireMeshes) m.geometry.dispose();
    for (const e of this.entities) e.dispose();
    this.entities.length = 0;
    this.wireRoot = undefined;
    this.wireMeshes.length = 0;
    this.termMeshes.length = 0;
    this.termMats.length = 0;
    this.ledGroup = undefined;
    this.sensorEye = undefined;
    this.handBlock = undefined;
  }

  /** The bench: board, LED, sensor, terminals. One root follows the mat. */
  private build(): void {
    this.stop();
    const tmp: [number, number, number] = [0, 0, 0];
    const root = new Group();
    root.name = 'Microcontroller Bench';
    root.position.set(...toWorld(0, 0, 0, tmp));
    root.rotation.y = LAYOUT.yaw;
    const rootEntity = this.world.createTransformEntity(root);
    this.entities.push(rootEntity);
    const add = (mesh: Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      root.add(mesh);
      return mesh;
    };
    const tilted = (map: CanvasTexture, w: number, h: number, x: number, z: number) => {
      const plane = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map, transparent: true }));
      plane.rotation.x = -1.0; // tilted up toward the seated player
      add(plane, x, 0.012, z);
    };

    // Board: blue body, printed top, header strip, USB port, main chip.
    add(new Mesh(new BoxGeometry(0.21, 0.01, 0.14), new MeshStandardMaterial({ color: 0x1a4f93, roughness: 0.7 })), BOARD_X, 0.005, BOARD_Z);
    const top = new Mesh(new PlaneGeometry(0.21, 0.14), new MeshBasicMaterial({ map: boardTexture() }));
    top.rotation.x = -Math.PI / 2;
    add(top, BOARD_X, 0.0105, BOARD_Z);
    add(new Mesh(new BoxGeometry(0.22, 0.012, 0.016), blackMat), 0.0, 0.016, -0.095);
    add(new Mesh(new BoxGeometry(0.03, 0.02, 0.035), metalMat), BOARD_X - 0.11, 0.015, BOARD_Z + 0.02);
    add(new Mesh(new BoxGeometry(0.07, 0.008, 0.022), blackMat), BOARD_X + 0.02, 0.014, BOARD_Z + 0.03);

    // LED on a base; pinch it to flip which leg is +. The red marker shows the long leg.
    const led = new Group();
    led.name = 'Micro LED';
    led.position.set((TERM_POS[LED_A][0] + TERM_POS[LED_B][0]) / 2, 0, 0.07);
    this.bulbMat = new MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xff2020, emissiveIntensity: 0, transparent: true, opacity: 0.9 });
    const bulb = new Mesh(new SphereGeometry(0.02, 16, 12), this.bulbMat);
    bulb.position.y = 0.03;
    const base = new Mesh(new CylinderGeometry(0.022, 0.022, 0.012, 16), metalMat);
    base.position.y = 0.006;
    const marker = new Mesh(new BoxGeometry(0.012, 0.013, 0.03), new MeshStandardMaterial({ color: RED }));
    marker.position.set(-0.024, 0.006, 0);
    this.halo = new Mesh(
      new SphereGeometry(0.05, 16, 12),
      new MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }),
    );
    this.halo.position.y = 0.03;
    led.add(base, bulb, marker, this.halo);
    root.add(led);
    this.ledGroup = led;
    const ledEntity = this.world.createTransformEntity(led, rootEntity);
    ledEntity.addComponent(CircuitTap, { id: LED_TAP });
    ledEntity.addComponent(RayInteractable);
    this.entities.push(ledEntity);
    tilted(labelTexture('LED (pinch to flip)'), 0.12, 0.015, led.position.x, 0.115);

    // Distance sensor: a small board standing up, two round "eyes" facing the player.
    add(new Mesh(new BoxGeometry(0.13, 0.05, 0.006), new MeshStandardMaterial({ color: 0x2a6db5, roughness: 0.7 })), SENSOR_X, 0.03, SENSOR_Z);
    const eyeGeo = new CylinderGeometry(0.017, 0.017, 0.016, 20).rotateX(Math.PI / 2);
    for (const dx of [-0.032, 0.032]) {
      const eye = add(new Mesh(eyeGeo, metalMat), SENSOR_X + dx, 0.032, SENSOR_Z + 0.011);
      if (dx > 0) this.sensorEye = eye;
    }
    tilted(sensorPinTexture(), 0.16, 0.02, SENSOR_X, 0.105);
    tilted(labelTexture('Distance sensor'), 0.12, 0.015, SENSOR_X, -0.045);

    // Stand-in hand for browser mode: shows the DISTANCE in front of the sensor.
    const hand = new Group();
    const skin = new MeshStandardMaterial({ color: 0xc68a5a, roughness: 0.8 });
    const palm = new Mesh(new BoxGeometry(0.06, 0.07, 0.018), skin);
    palm.position.y = 0.045;
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const finger = new Mesh(new BoxGeometry(0.012, 0.035, 0.014), skin);
      finger.position.set(-0.021 + i * 0.014, 0.096, 0);
      hand.add(finger);
    }
    hand.visible = false;
    root.add(hand);
    this.handBlock = hand;

    // Terminals: tappable dots.
    this.termMats.length = 0;
    this.termMeshes.length = 0;
    TERM_POS.forEach(([x, z], id) => {
      const m = new MeshStandardMaterial({ color: METAL, roughness: 0.4, emissive: 0x000000 });
      const mesh = new Mesh(termGeo, m);
      mesh.position.set(x, TERM_Y + (id <= PIN_D8 ? 0.004 : 0), z);
      mesh.name = `Micro terminal ${id}`;
      root.add(mesh);
      const e = this.world.createTransformEntity(mesh, rootEntity);
      e.addComponent(CircuitTap, { id });
      e.addComponent(RayInteractable);
      this.entities.push(e);
      this.termMats[id] = m;
      this.termMeshes[id] = mesh;
    });

    const wireRoot = new Group();
    root.add(wireRoot);
    this.wireRoot = wireRoot;
    this.paintTerminals();
  }

  private paintTerminals(): void {
    for (let id = 0; id < this.termMats.length; id++) {
      let color = id <= PIN_D8 ? PIN_GOLD : METAL;
      if (id === PIN_5V || id === S_VCC || id === ledAnode(this.ledFlipped)) color = RED;
      if (id === PIN_GND || id === S_GND || id === ledCathode(this.ledFlipped)) color = BLACK;
      if (id === this.selected) color = SELECTED;
      this.termMats[id].color.setHex(color);
      this.termMats[id].emissive.setHex(id === this.selected ? 0x806000 : 0x000000);
      this.termMeshes[id]?.scale.setScalar(id === this.selected ? 1.3 : 1);
    }
  }

  private applyLed(): void {
    if (this.ledGroup) this.ledGroup.rotation.y = this.ledFlipped ? Math.PI : 0;
    this.paintTerminals();
  }

  private setLedLight(on: boolean): void {
    if (this.bulbMat) this.bulbMat.emissiveIntensity = on ? 3 : 0;
    if (this.halo) this.halo.visible = on;
  }

  private select(id: number): void {
    this.selected = id;
    this.paintTerminals();
  }

  private onTap(id: number): void {
    if (this.phase() !== PHASE_MICRO || this.step !== 1 || id < 0) return;
    const now = performance.now();
    if (now < this.readyAt || now - (this.tapAt[id] ?? 0) < 800) return;
    this.tapAt[id] = now;
    if (id === LED_TAP) {
      this.ledFlipped = !this.ledFlipped;
      this.applyLed();
      playSfx('grab');
      this.setMsg(TEXT.flipped);
      learning.action(MICRO, 'flip_led');
      return;
    }
    if (id >= TERMINAL_COUNT) return;
    if (this.selected < 0) {
      this.select(id);
      playSfx('grab');
      this.setMsg(TEXT.pickAnother);
      return;
    }
    if (this.selected === id) {
      this.select(-1);
      this.setMsg(TEXT.wire);
      return;
    }
    const a = Math.min(this.selected, id);
    const b = Math.max(this.selected, id);
    this.select(-1);
    if (this.wires.some(([x, y]) => x === a && y === b)) {
      this.setMsg(TEXT.already);
      return;
    }
    if (this.wires.length >= MAX_WIRES) {
      this.setMsg(TEXT.tooMany);
      return;
    }
    this.wires.push([a, b]);
    this.rebuildWires();
    playSfx('grab');
    this.setMsg(`${TEXT.added} (${this.wires.length})`);
    learning.action(MICRO, 'add_wire');
  }

  /** Arched tube per wire, rebuilt only when wires change. */
  private rebuildWires(): void {
    const wr = this.wireRoot;
    if (wr == null) return;
    for (const m of this.wireMeshes) {
      wr.remove(m);
      m.geometry.dispose();
    }
    this.wireMeshes.length = 0;
    this.wires.forEach(([i, j], n) => {
      this.a.set(TERM_POS[i][0], TERM_Y + 0.008, TERM_POS[i][1]);
      this.b.set(TERM_POS[j][0], TERM_Y + 0.008, TERM_POS[j][1]);
      const mid = new Vector3().addVectors(this.a, this.b).multiplyScalar(0.5);
      mid.y += 0.03 + 0.25 * this.a.distanceTo(this.b);
      const curve = new QuadraticBezierCurve3(this.a.clone(), mid, this.b.clone());
      const mesh = new Mesh(new TubeGeometry(curve, 16, 0.004, 6), wireMats[n % wireMats.length]);
      wr.add(mesh);
      this.wireMeshes.push(mesh);
    });
  }

  private power(): void {
    if (this.step !== 1) return;
    this.select(-1);
    learning.action(MICRO, 'power');
    const result = checkWiring(this.wires, this.ledFlipped);
    if (!result.ok) {
      this.setMsg(TEXT.wiring[result.code]);
      learning.mistake(MICRO, asCode(result.code), result.detail);
      playSfx('wrong');
      return;
    }
    playSfx('correct');
    this.setMsg(TEXT.wired);
    this.showStep(2);
  }

  private renderSlots(): void {
    for (let i = 0; i < MAX_MICRO_BLOCKS; i++) {
      const block = this.blocks[i];
      this.ui[`micro-slot-${i}-t`]?.setProperties({ text: block ? BLOCK_TEXT[block] : '' });
      this.ui[`micro-slot-${i}`]?.setProperties({
        backgroundColor: block ? BLOCK_COLOR[block] : '#2b2e35',
        borderColor: block ? BLOCK_COLOR[block] : '#3a3d45',
      });
    }
  }

  private run(): void {
    if (this.step !== 2) return;
    learning.action(MICRO, 'run');
    const result = checkProgram(this.blocks);
    if (!result.ok) {
      this.setMsg(TEXT.programErr[result.code]);
      learning.mistake(MICRO, asCode(result.code));
      playSfx('wrong');
      return;
    }
    this.rule = result.rule;
    this.test = new RunTest();
    this.sliderCm = 40;
    playSfx('correct');
    this.setMsg(TEXT.programOk);
    this.showStep(3);
  }

  /** Closest fingertip to the sensor in cm, or Infinity outside a headset session. */
  private handDistanceCm(): number {
    if (this.world.visibilityState.peek() === VisibilityState.NonImmersive || !this.sensorEye) return Infinity;
    this.sensorEye.getWorldPosition(this.sensorPos);
    let best = Infinity;
    const tips = this.world.playerSpaceEntities.indexTipSpaces;
    for (const tip of [tips.left, tips.right]) {
      const obj = tip.object3D;
      if (!obj) continue;
      obj.getWorldPosition(this.tip);
      if (this.tip.lengthSq() === 0) continue; // not tracked
      best = Math.min(best, this.tip.distanceTo(this.sensorPos) * 100);
    }
    return best;
  }

  private finish(): void {
    this.step = 4;
    learning.complete(MICRO, mistakeStars(learning.mistakes));
    playSfx('correct');
    ARM_SIGNAL.celebrateUntil = performance.now() / 1000 + 1.2;
    this.setMsg(TEXT.done);
    this.finishIn = 1.2;
  }

  update(delta: number): void {
    if (!this.uiReady) this.wireUI();
    if (this.phase() !== PHASE_MICRO) return;
    this.time += delta;
    if (this.finishIn >= 0) {
      this.finishIn -= delta;
      if (this.finishIn < 0) {
        this.showStep(4);
        playSfx('end');
      }
    }
    if (this.step !== 3 || this.rule == null) return;

    const hand = this.handDistanceCm();
    const usingHand = hand < HAND_RANGE_CM;
    this.distanceCm = usingHand ? hand : this.sliderCm;
    if (this.handBlock) {
      this.handBlock.visible = !usingHand;
      this.handBlock.position.set(SENSOR_X, 0, SENSOR_Z + 0.02 + this.sliderCm / 100);
    }
    const on = ledFor(this.rule, this.distanceCm);
    if (on !== this.ledOn) {
      this.ledOn = on;
      this.setLedLight(on);
      playSfx(on ? 'grab' : 'wrong');
      if (on && !this.test.done) this.setMsg(TEXT.testFar);
    }
    if (on && this.halo) {
      (this.halo.material as MeshBasicMaterial).opacity = 0.45 + 0.1 * Math.sin(this.time * 6);
    }
    const shown = Math.round(this.distanceCm);
    if (shown !== this.shownDist || on !== this.shownLed) {
      this.shownDist = shown;
      this.shownLed = on;
      this.ui['micro-dist']?.setProperties({ text: `Distance: ${shown} cm  LED: ${on ? 'ON' : 'OFF'}` });
    }
    if (!this.test.done && this.test.update(on)) this.finish();
  }
}
