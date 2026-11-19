import { VisibilityState, type World } from '@iwsdk/core';
import { NAV } from '../nav.js';
import { WEB } from '../web/state.js';
import { t } from './i18n.js';
import { cleanPlayer, loadChoice, saveChoice, type Player, type SavedChoice } from './player.js';

/**
 * Start screen on the flat page. Step 1 (once per device): class code + nickname,
 * or "Play as guest" (no sync); remembered locally. Step 2: PLAY IN BROWSER
 * (mouse/touch) and ENTER VR (only when the browser supports an immersive AR
 * session, which this app uses). Plain DOM over the canvas: big and readable on phones.
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
#start-screen button:focus-visible, #start-screen input:focus-visible { outline: 4px solid #ffffff; outline-offset: 3px; }
#start-screen .step { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
#start-screen .step[hidden] { display: none; }
#start-screen label { display: flex; flex-direction: column; gap: 6px; width: min(100%, 420px); text-align: left;
  font-size: clamp(16px, 4vw, 20px); font-weight: 600; }
#start-screen input { min-height: 60px; padding: 0 16px; border-radius: 14px; border: 2px solid #5a5d66;
  background: #ffffff; color: #1c1d20; font-size: clamp(20px, 5vw, 26px); box-sizing: border-box; width: 100%; }
#join-start { background: #3ddc84; color: #1c1d20; }
#start-screen button.link { min-height: 48px; width: auto; padding: 0 18px; background: transparent; color: #c9ccd3;
  font-size: clamp(16px, 4vw, 20px); font-weight: 600; text-decoration: underline; letter-spacing: 0; }
#start-screen #join-error { color: #ff8a8d; min-height: 1.2em; margin: 0; }
#player-line { margin: 0; color: #c9ccd3; font-size: clamp(16px, 4vw, 20px); }
`;

export interface StartScreenOptions {
  /** Called with the player (or null for a guest) at start-up and whenever it changes.
   *  Return false if the player is not accepted (e.g. sync rejects it). */
  onPlayer?: (player: Player | null) => boolean | void;
}

function storage(): globalThis.Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function button(id: string, text: string, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = id;
  b.type = 'button';
  b.textContent = text;
  if (className) b.className = className;
  return b;
}

function field(id: string, labelText: string, maxLength: number): [HTMLLabelElement, HTMLInputElement] {
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  const input = document.createElement('input');
  input.id = id;
  input.maxLength = maxLength;
  input.autocomplete = 'off'; // shared school devices: don't suggest other pupils' entries
  input.spellcheck = false;
  label.append(input);
  return [label, input];
}

export function setupStartScreen(world: World, options: StartScreenOptions = {}): void {
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

  // Step 1: join a class (or play as guest).
  const join = document.createElement('form');
  join.className = 'step';
  join.noValidate = true;
  const joinTitle = document.createElement('p');
  joinTitle.textContent = t('join.title');
  const [classLabel, classInput] = field('join-class', t('join.class'), 8);
  classInput.autocapitalize = 'characters';
  const [nickLabel, nickInput] = field('join-nickname', t('join.nickname'), 16);
  const privacy = document.createElement('p');
  privacy.textContent = t('join.privacy');
  const error = document.createElement('p');
  error.id = 'join-error';
  error.setAttribute('role', 'alert');
  const joinStart = button('join-start', t('join.start'));
  joinStart.type = 'submit';
  const guestButton = button('join-guest', t('join.guest'), 'link');
  join.append(joinTitle, classLabel, nickLabel, privacy, error, joinStart, guestButton);

  // Step 2: choose how to play.
  const play = document.createElement('div');
  play.className = 'step';
  const playerLine = document.createElement('p');
  playerLine.id = 'player-line';
  const changeButton = button('join-change', t('join.change'), 'link');
  play.append(browserButton, vrButton, playerLine, changeButton);

  root.append(title, subtitle, join, play);
  document.body.appendChild(root);

  const showPlay = (choice: SavedChoice) => {
    playerLine.textContent =
      'player' in choice ? `${choice.player.classCode} · ${choice.player.nickname}` : t('join.asGuest');
    join.hidden = true;
    play.hidden = false;
  };
  const showJoin = () => {
    error.textContent = '';
    play.hidden = true;
    join.hidden = false;
  };
  const choose = (choice: SavedChoice): boolean => {
    const ok = options.onPlayer?.('player' in choice ? choice.player : null) ?? true;
    if (ok === false) return false;
    saveChoice(storage(), choice);
    showPlay(choice);
    return true;
  };

  join.addEventListener('submit', (e) => {
    e.preventDefault();
    const player = cleanPlayer(classInput.value, nickInput.value);
    if (player == null || !choose({ player })) {
      error.textContent = t('join.invalid');
      return;
    }
  });
  guestButton.addEventListener('click', () => choose({ guest: true }));
  changeButton.addEventListener('click', () => {
    const saved = loadChoice(storage());
    classInput.value = saved && 'player' in saved ? saved.player.classCode : '';
    nickInput.value = saved && 'player' in saved ? saved.player.nickname : '';
    showJoin();
  });

  const saved = loadChoice(storage());
  if (saved == null || !choose(saved)) showJoin();

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
