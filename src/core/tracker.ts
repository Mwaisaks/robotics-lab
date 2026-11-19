import type { ActivityId, EventBus, MistakeCode, Mode, Stars } from './events.js';

/**
 * Tracks the one activity attempt in progress and emits its LearningEvents, so
 * each level only reports what happened (start, action, mistake, complete) and
 * never counts time or mistakes itself. Pure: the clock is passed in.
 */
export class ActivityTracker {
  private activity: ActivityId | null = null;
  private challenge = 0;
  private startedAt = 0;
  private mistakeCount = 0;

  constructor(
    private readonly bus: EventBus,
    /** Milliseconds since the epoch (Date.now in the app, a fake clock in tests). */
    private readonly now: () => number,
  ) {}

  /** The activity in progress, or null. */
  get current(): ActivityId | null {
    return this.activity;
  }

  get mistakes(): number {
    return this.mistakeCount;
  }

  /** Starts an attempt (replacing any unfinished one) and emits activity_started. */
  start(activity: ActivityId, challenge: number, mode: Mode): void {
    this.activity = activity;
    this.challenge = challenge;
    this.startedAt = this.now();
    this.mistakeCount = 0;
    this.bus.emit({ type: 'activity_started', activity, challenge, mode, t: this.startedAt });
  }

  /** Emits an action for `activity` if it is the one in progress; otherwise ignored. */
  action(activity: ActivityId, name: string): void {
    if (this.activity !== activity) return;
    this.bus.emit({ type: 'action', activity, name, t: this.now() });
  }

  /** Counts and emits a mistake for `activity` if it is the one in progress; otherwise ignored. */
  mistake<A extends ActivityId>(activity: A, code: MistakeCode<A>, detail?: string): void {
    if (this.activity !== activity) return;
    this.mistakeCount++;
    this.bus.emit({
      type: 'mistake',
      activity,
      code,
      ...(detail === undefined ? {} : { detail }),
      t: this.now(),
    });
  }

  /** Emits activity_completed and ends the attempt. Ignored if `activity` is not in progress. */
  complete(activity: ActivityId, stars: Stars): void {
    if (this.activity !== activity) return;
    const t = this.now();
    this.bus.emit({
      type: 'activity_completed',
      activity,
      challenge: this.challenge,
      stars,
      seconds: Math.max(0, Math.round((t - this.startedAt) / 1000)),
      mistakes: this.mistakeCount,
      t,
    });
    this.activity = null;
  }

  /** Ends an unfinished attempt silently (MENU, leaving the level). */
  abandon(): void {
    this.activity = null;
  }
}
