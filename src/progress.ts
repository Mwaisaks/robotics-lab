/**
 * Local completion ticks for the level menu, per browser. Storage can be missing or
 * blocked (private window, cleared data), so every access is wrapped in try/catch
 * and the game works the same without it.
 */
const KEY = 'robot-arm-lab.progress.v1';

function read(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Done ticks: 1, 2, '3a' (Light it up), '3b' (Build the robot); 3 = both parts of Level 3. */
export function isLevelDone(level: 1 | 2 | 3 | '3a' | '3b'): boolean {
  const data = read();
  if (level === 3) return data.level3a === true && data.level3b === true;
  return data[`level${level}`] === true;
}

export function markLevelDone(level: 1 | 2 | '3a' | '3b'): void {
  try {
    const data = read();
    data[`level${level}`] = true;
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: ticks just won't persist.
  }
}
