// Instantaneous speech tempo model:
// pace is derived from inter-word intervals (IWI), not rolling WPM.
// +1 fast, 0 ideal, -1 slow.

const FAST_DELTA_MS = 240;
const IDEAL_DELTA_MS = 340;
const SLOW_DELTA_MS = 760;

const SMOOTH_CURRENT_WEIGHT = 0.6;

const SILENCE_HOLD_MS = 1000;
const SILENCE_DECAY = 0.96; // per update tick, ease toward slow during pauses

const MIN_INTERVAL_MS = 90;
const MAX_INTERVAL_MS = 1200;

export class PaceTracker {
  private smoothedPace = 0;
  private previousWordTime = -Infinity;
  private lastWordTime = -Infinity;
  private lastIntervalMs: number | null = null;
  private hasTempoSignal = false;

  addWord(timestampMs: number) {
    if (!Number.isFinite(timestampMs)) return;

    if (this.previousWordTime > 0) {
      const intervalMs = clamp(timestampMs - this.previousWordTime, MIN_INTERVAL_MS, MAX_INTERVAL_MS);
      const instantaneousPace = mapIntervalToPace(intervalMs);

      this.smoothedPace = this.hasTempoSignal
        ? SMOOTH_CURRENT_WEIGHT * instantaneousPace + (1 - SMOOTH_CURRENT_WEIGHT) * this.smoothedPace
        : instantaneousPace;

      this.lastIntervalMs = intervalMs;
      this.hasTempoSignal = true;
    }

    this.previousWordTime = timestampMs;
    this.lastWordTime = timestampMs;
  }

  update(nowMs: number): number {
    if (!this.hasTempoSignal) {
      return 0;
    }

    const silenceMs = nowMs - this.lastWordTime;
    if (silenceMs > SILENCE_HOLD_MS) {
      // During pauses, drift toward "slow" without snapping.
      this.smoothedPace = SILENCE_DECAY * this.smoothedPace + (1 - SILENCE_DECAY) * -1;
      if (this.lastIntervalMs !== null) {
        this.lastIntervalMs = Math.min(1600, this.lastIntervalMs + 35);
      }
    }

    return clamp(this.smoothedPace, -1, 1);
  }

  getCurrentIntervalMs(): number | null {
    return this.lastIntervalMs === null ? null : Math.round(this.lastIntervalMs);
  }

  reset() {
    this.smoothedPace = 0;
    this.previousWordTime = -Infinity;
    this.lastWordTime = -Infinity;
    this.lastIntervalMs = null;
    this.hasTempoSignal = false;
  }
}

function mapIntervalToPace(intervalMs: number): number {
  if (intervalMs <= FAST_DELTA_MS) return 1;
  if (intervalMs >= SLOW_DELTA_MS) return -1;

  if (intervalMs < IDEAL_DELTA_MS) {
    return (IDEAL_DELTA_MS - intervalMs) / (IDEAL_DELTA_MS - FAST_DELTA_MS);
  }

  return -1 * (intervalMs - IDEAL_DELTA_MS) / (SLOW_DELTA_MS - IDEAL_DELTA_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
