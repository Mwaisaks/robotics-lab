/**
 * "Virtual lab" setting: show the procedural lab room inside the headset too
 * (immersive VR look) instead of passthrough. Browser mode always shows the room.
 * Pure (no three.js / IWSDK); localStorage access is wrapped in try/catch.
 */
export const VIRTUAL_LAB_KEY = 'robotics-lab.virtual-lab.v1';

export const LAB_ENV = { virtualLabInXR: false };

/** '1' means on; anything else (missing, garbage) means off. */
export function parseVirtualLab(raw: string | null | undefined): boolean {
  return raw === '1';
}

function defaultStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function loadVirtualLab(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return parseVirtualLab((storage ?? defaultStorage())?.getItem(VIRTUAL_LAB_KEY));
  } catch {
    return false;
  }
}

export function setVirtualLab(on: boolean, storage?: Pick<Storage, 'setItem'>): void {
  LAB_ENV.virtualLabInXR = on;
  try {
    (storage ?? defaultStorage())?.setItem(VIRTUAL_LAB_KEY, on ? '1' : '0');
  } catch {
    // private mode / blocked storage: the setting still applies for this session
  }
}

/** Room visible? Flat page: always. Headset: only with the Virtual lab setting. */
export function shouldShowRoom(nonImmersive: boolean, virtualLabInXR: boolean): boolean {
  return nonImmersive || virtualLabInXR;
}

LAB_ENV.virtualLabInXR = loadVirtualLab();
