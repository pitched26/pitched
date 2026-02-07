const WINDOW_MS = 1800;
const OPTIMAL_WPS = 2.5; // ~150 WPM
const SILENCE_THRESHOLD_MS = 800;
const SILENCE_DECAY = 0.92;
const BIAS = 1.1;

export class PaceTracker {
  private wordTimestamps: number[] = [];
  private smoothedPace = 0;
  private lastWordTime = 0;

  addWords(count: number, timestamp: number) {
    for (let i = 0; i < count; i++) {
      this.wordTimestamps.push(timestamp);
    }
    if (count > 0) {
      this.lastWordTime = timestamp;
    }
  }

  update(now: number): number {
    const cutoff = now - WINDOW_MS;
    while (this.wordTimestamps.length > 0 && this.wordTimestamps[0] < cutoff) {
      this.wordTimestamps.shift();
    }

    if (this.lastWordTime > 0 && (now - this.lastWordTime) > SILENCE_THRESHOLD_MS) {
      this.smoothedPace *= SILENCE_DECAY;
    } else {
      const wps = this.wordTimestamps.length / (WINDOW_MS / 1000);
      let paceScore = (wps - OPTIMAL_WPS) / OPTIMAL_WPS;
      paceScore = Math.max(-1, Math.min(1, paceScore));

      const delta = Math.abs(paceScore - this.smoothedPace);
      const alpha = delta > 0.3 ? 0.45 : delta > 0.15 ? 0.3 : 0.15;

      this.smoothedPace = alpha * paceScore + (1 - alpha) * this.smoothedPace;
    }

    const biased = this.smoothedPace * BIAS;
    return Math.max(-1, Math.min(1, biased));
  }

  reset() {
    this.wordTimestamps = [];
    this.smoothedPace = 0;
    this.lastWordTime = 0;
  }
}
