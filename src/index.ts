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
import { logEventsIfDebug } from './learning.js';
import { HintPanelSystem } from './shell/hint-panel.js';
import { setupStartScreen } from './shell/start-screen.js';
import { BrowserModeSystem } from './web/browser-mode.js';

logEventsIfDebug();

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
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
  world.registerSystem(BrowserModeSystem);
  world.registerSystem(HintPanelSystem);
  setupStartScreen(world);
});
