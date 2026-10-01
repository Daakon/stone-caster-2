import type { MutationDto } from "./action-resolver.js";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function applyMutation(
  state: Record<string, unknown>,
  mutation: MutationDto,
): void {
  const parts = mutation.path.split("/").filter(Boolean);
  const finalKey = parts.pop();
  if (!finalKey) throw new Error(`Invalid mutation path: ${mutation.path}`);
  if (
    [...parts, finalKey].some(
      (key) =>
        key === "__proto__" || key === "constructor" || key === "prototype",
    )
  )
    throw new Error("Unsafe mutation path");
  let current = state;
  for (const key of parts) {
    const next = object(current[key]);
    current[key] = next;
    current = next;
  }
  const value = current[finalKey];
  switch (mutation.op) {
    case "set":
      current[finalKey] = mutation.value;
      break;
    case "add": {
      if (typeof value === "number" && typeof mutation.value === "number")
        current[finalKey] = value + mutation.value;
      else if (Array.isArray(value))
        current[finalKey] = [...(value as unknown[]), mutation.value];
      else
        throw new Error(
          `Cannot add to non-numeric/non-array value at ${mutation.path}`,
        );
      break;
    }
    case "remove": {
      if (Array.isArray(value)) {
        const index = (value as unknown[]).indexOf(mutation.value);
        if (index !== -1) value.splice(index, 1);
      } else Reflect.deleteProperty(current, finalKey);
      break;
    }
    default:
      throw new Error(`Unknown mutation operation: ${String(mutation.op)}`);
  }
}
export function applyMutations(
  state: Record<string, unknown>,
  mutations: MutationDto[],
): void {
  for (const mutation of mutations) applyMutation(state, mutation);
}
