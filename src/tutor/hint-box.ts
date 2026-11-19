/**
 * Default Robo hint box for BROWSER MODE: big readable text at the bottom of the
 * screen, auto-hides after 8 s, tap or click to close (mouse and touch).
 * Not visible inside an immersive XR session; headset mode passes its own `show`.
 * Created lazily on the first hint, so importing this file touches no DOM.
 */
import type { Lang } from './hints.js';

export const HINT_BOX_AUTO_HIDE_MS = 8000;

// TODO(Phenny): move to src/shell/i18n.ts once it exists.
const STRINGS: Record<Lang, { close: string; robo: string }> = {
  en: { close: 'Close hint', robo: 'Robo' },
  sw: { close: 'Funga dokezo', robo: 'Robo' },
};

let box: HTMLDivElement | undefined;
let label: HTMLSpanElement | undefined;
let textEl: HTMLParagraphElement | undefined;
let closeBtn: HTMLButtonElement | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function hide(): void {
  clearTimeout(hideTimer);
  if (box) box.style.display = 'none';
}

function ensureBox(): HTMLDivElement {
  if (box) return box;
  box = document.createElement('div');
  box.id = 'robo-hint';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  Object.assign(box.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    width: 'min(720px, calc(100vw - 32px))',
    boxSizing: 'border-box',
    padding: '16px 64px 16px 20px',
    borderRadius: '16px',
    border: '3px solid #F2A900',
    background: '#FFF8DC',
    color: '#1A1A1A',
    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    font: '600 clamp(20px, 1.6vw + 12px, 30px)/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    zIndex: '2147483000',
    cursor: 'pointer',
    touchAction: 'manipulation',
    userSelect: 'none',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  label = document.createElement('span');
  Object.assign(label.style, { display: 'block', fontSize: '0.7em', fontWeight: '800', color: '#8A5A00', marginBottom: '4px' });
  textEl = document.createElement('p');
  textEl.style.margin = '0';

  closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '48px',
    height: '48px',
    border: 'none',
    borderRadius: '12px',
    background: 'transparent',
    color: '#1A1A1A',
    font: '700 32px/1 system-ui, sans-serif',
    cursor: 'pointer',
    touchAction: 'manipulation',
  } satisfies Partial<CSSStyleDeclaration>);

  box.append(label, textEl, closeBtn);
  // Click fires for mouse and touch taps. Keep pointer events off the 3D canvas behind.
  box.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hide();
  });
  for (const type of ['pointerdown', 'pointerup', 'pointermove'] as const) {
    box.addEventListener(type, (ev) => ev.stopPropagation());
  }
  document.body.appendChild(box);
  return box;
}

/** Show (or replace) the hint. Restarts the 8 s auto-hide. No-op without a DOM. */
export function showHintBox(text: string, source: 'builtin' | 'ai', lang: Lang): void {
  if (typeof document === 'undefined' || !document.body) return;
  const el = ensureBox();
  const s = STRINGS[lang] ?? STRINGS.en;
  label!.textContent = s.robo;
  textEl!.textContent = text;
  closeBtn!.setAttribute('aria-label', s.close);
  el.lang = lang;
  el.dataset.source = source;
  el.style.display = 'block';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HINT_BOX_AUTO_HIDE_MS);
}

export function hideHintBox(): void {
  hide();
}
