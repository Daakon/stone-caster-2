// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Per-turn LLM usage capture.
 *
 * A turn calls the model several times (Director, Narrator, ...). The turn service starts a
 * capture at the top of the request; every chat completion appends a record to it. The
 * records feed the per-turn ai_audit_logs row (tokens, cost, latency, models).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface LlmCallRecord {
  role: string;
  provider: string;
  requested: string;
  served: string;
  ms: number;
  prompt: number | null;
  completion: number | null;
  cost: number | null;
  ok: boolean;
}

const storage = new AsyncLocalStorage<LlmCallRecord[]>();

/** Begin capturing LLM calls for the rest of the current async flow. Returns the live record list. */
export function startLlmUsageCapture(): LlmCallRecord[] {
  const calls: LlmCallRecord[] = [];
  storage.enterWith(calls);
  return calls;
}

export function recordLlmCall(record: LlmCallRecord): void {
  storage.getStore()?.push(record);
}

export function summarizeLlmCalls(calls: LlmCallRecord[]) {
  const sum = (f: (c: LlmCallRecord) => number | null) => calls.reduce((a, c) => a + (f(c) ?? 0), 0);
  return {
    calls: calls.length,
    prompt: sum((c) => c.prompt),
    completion: sum((c) => c.completion),
    cost_usd: Number(sum((c) => c.cost).toFixed(6)),
    latency_ms: sum((c) => c.ms),
    failed: calls.filter((c) => !c.ok).length,
    by_role: calls.map(({ role, served, ms, prompt, completion, cost, ok }) => ({ role, model: served, ms, prompt, completion, cost, ok })),
  };
}
