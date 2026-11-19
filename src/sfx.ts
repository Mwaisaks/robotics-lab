import { AudioSource, AudioUtils, Entity, World } from '@iwsdk/core';

/**
 * Sound effects via the SDK's AudioSource + AudioUtils (AudioSystem resumes the
 * audio context when the XR session starts). Original synthesized WAVs, see
 * public/audio/LICENSE.md. Non-positional, small files, preloaded.
 */
export type Sfx = 'grab' | 'correct' | 'wrong' | 'end';
const VOLUME: Record<Sfx, number> = { grab: 0.35, correct: 0.6, wrong: 0.45, end: 0.6 };

const sources = new Map<Sfx, Entity>();

export function initSfx(world: World): void {
  for (const name of Object.keys(VOLUME) as Sfx[]) {
    const entity = world.createTransformEntity();
    entity.addComponent(AudioSource, {
      src: `${import.meta.env.BASE_URL}audio/${name}.wav`,
      volume: VOLUME[name],
      positional: false,
    });
    sources.set(name, entity);
    void AudioUtils.preload(entity).catch(() => undefined);
  }
}

export function playSfx(name: Sfx): void {
  const entity = sources.get(name);
  if (entity) AudioUtils.play(entity);
}
