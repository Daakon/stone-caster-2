import { performance } from 'node:perf_hooks';

export type TurnTimelineStage =
  | 'request_received'
  | 'jev_start'
  | 'jev_end'
  | 'director_start'
  | 'director_end'
  | 'engine_start'
  | 'engine_end'
  | 'narrator_start'
  | 'narrator_end'
  | 'persistence_start'
  | 'persistence_end'
  | 'response_sent';

export interface TurnTimelinePoint {
  timestamp: string;
  epoch_ms: number;
  elapsed_ms: number;
}

export type TurnTimeline = {
  version: 1;
  started_at: string;
} & Partial<Record<TurnTimelineStage, TurnTimelinePoint>>;

export class TurnTimelineTracker {
  private readonly startedEpochMs = Date.now();
  private readonly startedMonotonicMs = performance.now();
  private readonly points: Partial<Record<TurnTimelineStage, TurnTimelinePoint>> = {};

  mark(stage: TurnTimelineStage): TurnTimelinePoint {
    const existing = this.points[stage];
    if (existing) return existing;
    const epochMs = Date.now();
    const point = {
      timestamp: new Date(epochMs).toISOString(),
      epoch_ms: epochMs,
      elapsed_ms: Math.max(0, Math.round(performance.now() - this.startedMonotonicMs)),
    };
    this.points[stage] = point;
    return point;
  }

  snapshot(): TurnTimeline {
    return {
      version: 1,
      started_at: new Date(this.startedEpochMs).toISOString(),
      ...this.points,
    };
  }
}
