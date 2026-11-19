import { VisibilityState, type World } from '@iwsdk/core';
import { NAV } from '../nav.js';
import { WEB } from '../web/state.js';
import { t } from './i18n.js';

/**
 * Start screen on the flat page: PLAY IN BROWSER (mouse/touch) and ENTER VR
 * (only when the browser supports an immersive AR session, which this app uses).
 * Plain DOM over the canvas so it is big and readable on phones.
 */
const CSS = `
#start-screen { position: fixed; inset: 0; z-index: 10; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; padding: 24px; box-sizing: border-box;
  background: rgba(20, 22, 28, 0.92); color: #fafaf7; font-family: system-ui, sans-serif; text-align: center; }
#start-screen[hidden] { display: none; }
#start-screen h1 { margin: 0; font-size: clamp(32px, 8vw, 56px); }
#start-screen p { margin: 0 0 12px; font-size: clamp(16px, 4vw, 22px); color: #c9ccd3; }
#start-screen button { width: min(100%, 420px); min-height: 72px; border: 0; border-radius: 18px;
  font-size: clamp(20px, 5vw, 26px); font-weight: 700; letter-spacing: 1px; cursor: pointer; touch-action: manipulation; }
#start-browser { background: #f5c542; color: #1c1d20; }
#start-vr { background: #3e8ef7; color: #ffffff; }
#start-screen button:focus-visible { outline: 4px solid #ffffff; outline-offset: 3px; }
`;

export function setupStartScreen(world: World): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'start-screen';
  const title = document.createElement('h1');
  title.textContent = t('start.title');
  const subtitle = document.createElement('p');
  subtitle.textContent = t('start.subtitle');
  const browserButton = document.createElement('button');
  browserButton.id = 'start-browser';
  browserButton.type = 'button';
  browserButton.textContent = t('start.browser');
  const vrButton = document.createElement('button');
  vrButton.id = 'start-vr';
  vrButton.type = 'button';
  vrButton.textContent = t('start.vr');
  vrButton.hidden = true;
  root.append(title, subtitle, browserButton, vrButton);
  document.body.appendChild(root);

  const show = () => {
    WEB.active = false;
    root.hidden = false;
  };

  browserButton.addEventListener('click', () => {
    root.hidden = true;
    WEB.active = true;
    NAV.toMenu();
  });
  vrButton.addEventListener('click', () => {
    root.hidden = true;
    WEB.active = false;
    world.launchXR();
  });
  NAV.exitToStart = show;

  // Standard WebXR feature check; the button stays hidden if it fails.
  const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
  if (world.xrEnabled && xr) {
    xr.isSessionSupported('immersive-ar')
      .then((ok) => {
        vrButton.hidden = !ok;
      })
      .catch(() => undefined);
  }

  // Back on the flat page after a headset session: show the start screen again.
  let wasImmersive = false;
  world.visibilityState.subscribe((state) => {
    const immersive = state !== VisibilityState.NonImmersive;
    if (immersive) root.hidden = true;
    else if (wasImmersive) show();
    wasImmersive = immersive;
  });
}
