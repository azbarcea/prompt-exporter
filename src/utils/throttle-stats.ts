/**
 * Rolling request-timing stats for throttle tuning (--verbose).
 */
export class ThrottleStats {
  private latenciesMs: number[] = [];
  private readonly maxSamples: number;
  successes = 0;
  rateLimits = 0;
  failures = 0;
  startedAt = Date.now();
  lastReportAt = Date.now();

  constructor(maxSamples = 200) {
    this.maxSamples = maxSamples;
  }

  recordSuccess(latencyMs: number): void {
    this.successes++;
    this.pushLatency(latencyMs);
  }

  recordRateLimit(latencyMs?: number): void {
    this.rateLimits++;
    if (latencyMs != null) this.pushLatency(latencyMs);
  }

  recordFailure(latencyMs?: number): void {
    this.failures++;
    if (latencyMs != null) this.pushLatency(latencyMs);
  }

  private pushLatency(ms: number): void {
    this.latenciesMs.push(ms);
    if (this.latenciesMs.length > this.maxSamples) {
      this.latenciesMs.shift();
    }
  }

  private percentile(p: number): number {
    if (this.latenciesMs.length === 0) return 0;
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return sorted[idx] ?? 0;
  }

  summary(): string {
    const elapsedSec = Math.max(0.001, (Date.now() - this.startedAt) / 1000);
    const done = this.successes + this.failures + this.rateLimits;
    const rps = (this.successes / elapsedSec).toFixed(2);
    const p50 = Math.round(this.percentile(50));
    const p95 = Math.round(this.percentile(95));
    return [
      `ok=${this.successes}`,
      `429=${this.rateLimits}`,
      `fail=${this.failures}`,
      `rps=${rps}`,
      `p50=${p50}ms`,
      `p95=${p95}ms`,
      `n=${done}`,
    ].join(' ');
  }

  /** True if enough time passed to emit another verbose line. */
  shouldReport(intervalMs = 15000): boolean {
    if (Date.now() - this.lastReportAt >= intervalMs) {
      this.lastReportAt = Date.now();
      return true;
    }
    return false;
  }
}
