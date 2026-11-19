/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
  'game-panel': uikitml('game.uikitml', 'Game Panel'),
  'debug-panel': uikitml('debug.uikitml', 'Debug Panel'),
  'pop-panel': uikitml('pop.uikitml', 'Pop Panel'),
});
