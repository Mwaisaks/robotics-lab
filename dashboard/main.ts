/**
 * Teacher dashboard page: class code -> /api/class -> table + top mistakes.
 * All student text is written with textContent (nicknames are typed by students).
 */
import { ACTIVITY_LABELS, formatDuration, formatEat, starString, summarizeClass, type ClassRow, type ClassSummary } from './summary.js';

const REFRESH_MS = 30_000; // keep the view live during a lesson or the demo

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('form');
const input = $<HTMLInputElement>('code');
const button = $<HTMLButtonElement>('show');
const statusEl = $('status');
const emptyEl = $('empty');
const results = $('results');
const head = $('head');
const body = $('body');
const studentsTitle = $('students-title');
const mistakesEl = $('mistakes');
const noMistakes = $('no-mistakes');

let current = '';
let timer: ReturnType<typeof setInterval> | undefined;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function setStatus(text: string, error = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
}

function render(s: ClassSummary, code: string): void {
  const hasData = s.students.length > 0;
  emptyEl.hidden = hasData;
  results.hidden = !hasData;
  if (!hasData) return;

  studentsTitle.textContent = `Students (${s.students.length})`;
  head.replaceChildren(el('th', 'Nickname'), ...s.activities.map((a) => el('th', ACTIVITY_LABELS[a])), el('th', 'Last active (EAT)'));
  head.querySelectorAll('th').forEach((th) => th.setAttribute('scope', 'col'));

  body.replaceChildren(
    ...s.students.map((st) => {
      const tr = el('tr');
      tr.append(el('td', st.nickname, 'name'));
      for (const a of s.activities) {
        const cell = st.cells[a];
        const td = el('td');
        if (cell) {
          const stars = el('span', starString(cell.stars), 'stars');
          stars.setAttribute('aria-label', `${cell.stars} of 3 stars`);
          td.append(stars, el('span', formatDuration(cell.bestSeconds), 'time'));
        } else {
          td.append(el('span', '—', 'none'));
          td.setAttribute('aria-label', 'not finished');
        }
        tr.append(td);
      }
      tr.append(el('td', formatEat(st.lastActive)));
      return tr;
    }),
  );

  mistakesEl.replaceChildren(
    ...s.topMistakes.map((m) => {
      const li = el('li');
      const title = el('div');
      title.append(
        el('span', `${ACTIVITY_LABELS[m.activity]} · ${m.code.replace(/_/g, ' ').toLowerCase()}`, 'code'),
        el('span', ` — ${m.count} times, ${m.students} ${m.students === 1 ? 'student' : 'students'}`, 'count'),
      );
      li.append(title, el('p', m.meaning, 'meaning'));
      return li;
    }),
  );
  noMistakes.hidden = s.topMistakes.length > 0;
  setStatus(`Class ${code} · updated ${formatEat(new Date().toISOString())}`);
}

async function load(code: string, quiet = false): Promise<void> {
  if (!quiet) {
    button.disabled = true;
    setStatus('Loading…');
  }
  try {
    const res = await fetch(`/api/class?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { rows?: ClassRow[]; error?: string };
    if (!res.ok) throw new Error(data.error || `error ${res.status}`);
    if (code !== current) return; // a newer code was entered meanwhile
    render(summarizeClass(data.rows ?? []), code);
  } catch (err) {
    if (!quiet) {
      setStatus(navigator.onLine === false ? 'No internet connection. Try again when online.' : `Could not load: ${(err as Error).message}`, true);
      emptyEl.hidden = true;
      results.hidden = true;
    }
  } finally {
    button.disabled = false;
  }
}

function show(raw: string): void {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    setStatus('Class code: 4 to 8 letters or numbers.', true);
    input.focus();
    return;
  }
  current = code;
  input.value = code;
  history.replaceState(null, '', `?code=${code}`);
  clearInterval(timer);
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void load(current, true);
  }, REFRESH_MS);
  void load(code);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  show(input.value);
});

const fromUrl = new URLSearchParams(location.search).get('code');
if (fromUrl) show(fromUrl);
else input.focus();
