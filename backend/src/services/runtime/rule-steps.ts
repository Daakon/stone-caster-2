// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Minimal executor for a compiled action's rule steps.
 *
 * Compiled rulesets describe simple actions as step lists (e.g. take_rest: restore stamina, cost
 * satiety; consume_food: +40 satiety, clamped). The Engine's simple-action path previously only
 * read a flat `deltas` object, so those rules never ran (resting restored nothing).
 *
 * Supported subset: `state.modify` on a numeric resource of the ACTING entity
 * (`tier1_entity.<resource>`), with `amount` (relative) or `value` (set-to), and optional
 * clamp_min / clamp_max (defaults 0..100). Every other step function/path is ignored here
 * (world clock, conditions and thresholds are derived elsewhere).
 */
const RESOURCE_BASELINE = 100; // implied full value of a resource never written yet (mirrors StateService)
const ENTITY_PREFIX = 'tier1_entity.';

export function collectEntityResourceDeltas(
  action: Record<string, unknown>,
  actorId: string,
  actor: any
): Record<string, number> {
  const steps = Array.isArray(action.logic) ? (action.logic as any[]) : [];
  const deltas: Record<string, number> = {};
  const props = (actor?.properties ?? {}) as Record<string, unknown>;

  for (const step of steps) {
    if (step?.function !== 'state.modify') continue;
    const args = step.args ?? {};
    const path = typeof args.path === 'string' ? args.path : '';
    if (!path.startsWith(ENTITY_PREFIX)) continue;
    const resource = path.slice(ENTITY_PREFIX.length);
    if (!/^[a-z_]+$/i.test(resource)) continue;

    const key = `entities.${actorId}.properties.${resource}`;
    const base = typeof props[resource] === 'number' ? (props[resource] as number) : RESOURCE_BASELINE;
    const current = base + (deltas[key] ?? 0); // earlier steps in this action may already have moved it

    let next: number | undefined;
    if (typeof args.amount === 'number') next = current + args.amount;
    else if (typeof args.value === 'number') next = args.value;
    if (next === undefined) continue;

    next = Math.min(args.clamp_max ?? RESOURCE_BASELINE, Math.max(args.clamp_min ?? 0, next));
    const delta = next - base;
    if (delta !== 0) deltas[key] = delta;
    else delete deltas[key];
  }
  return deltas;
}
