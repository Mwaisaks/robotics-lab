/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { ArmSystem } from './arm-system.js';
import { BuildSystem } from './build.js';
import { CircuitSystem } from './circuit.js';
import { DebugSystem } from './debug.js';
import { GameSystem } from './game.js';
import { buildLab } from './lab.js';
import { PanelSystem } from './panel.js';
import { PartRespawnSystem } from './part-respawn.js';
import { ProgramSystem } from './program.js';
import { TablePlacementSystem } from './table-placement.js';
import { logEventsIfDebug, modeOf } from './learning.js';
import { MicroSystem } from './micro.js';
import { LabEnvironmentSystem } from './shared3d/environment/lab-environment-system.js';
import { HINT_PANEL, HintPanelSystem } from './shell/hint-panel.js';
import { getLang } from './shell/i18n.js';
import { setupStartScreen } from './shell/start-screen.js';
import { showHintBox } from './tutor/hint-box.js';
import { startTutor } from './tutor/robo.js';
import { setPlayer } from './tutor/sync.js';
import { BrowserModeSystem } from './web/browser-mode.js';

logEventsIfDebug();

// Robo: built-in hint at once on every mistake, AI hint replaces it if it arrives in time.
// Headset: in-world panel (src/shell/hint-panel.ts). Browser: Rebecca's DOM hint box.
let app: World | null = null;
/** AI hints switch. Off: Robo shows built-in hints only and never calls /api/hint. */
const AI_HINTS = true;
startTutor({
  lang: getLang,
  ...(AI_HINTS ? {} : { fetchHint: async () => null }),
  show: (text, source) => {
    if (app != null && modeOf(app) === 'xr') HINT_PANEL.show(text, source);
    else showHintBox(text, source, getLang());
  },
});

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  app = world;
  buildLab(world);
  world.registerSystem(PanelSystem);
  world.registerSystem(PartRespawnSystem);
  world.registerSystem(GameSystem);
  world.registerSystem(TablePlacementSystem);
  world.registerSystem(ArmSystem);
  world.registerSystem(DebugSystem);
  world.registerSystem(ProgramSystem);
  world.registerSystem(CircuitSystem);
  world.registerSystem(BuildSystem);
  world.registerSystem(MicroSystem);
  world.registerSystem(BrowserModeSystem);
  world.registerSystem(HintPanelSystem);
  world.registerSystem(LabEnvironmentSystem);
  // Class code + nickname -> progress sync (setPlayer starts it). Guest: no player, no sync.
  setupStartScreen(world, {
    onPlayer: (player) => (player ? setPlayer(player) : (setPlayer(null), true)),
  });
});
