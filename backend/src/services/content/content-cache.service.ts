import { z } from "zod";
import { ContentChangePollerService } from "./content-change-poller.service.js";
import type {
  ContentCacheAddress,
  ContentChange,
  ContentChangePage,
} from "../../../../shared/src/types/chimera-content-changes.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";
import { ServiceError } from "../../utils/serviceError.js";

type Entry = { address: ContentCacheAddress; value: unknown };
type Cursor = { seq: string; generation: string };
const encoded = (part: string) => encodeURIComponent(part);
function cacheKey(address: ContentCacheAddress): string {
  if (address.type === "blob") {
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(address.sha256);
    return `blob:${address.sha256}`;
  }
  if (address.scope === "owner") {
    z.string().uuid().parse(address.owner);
    if (address.type !== "list" && address.namespace !== address.owner)
      throw new ServiceError(400, {
        code: ApiErrorCode.VALIDATION_FAILED,
        message: "Private cache namespace must match its authenticated owner.",
      });
  }
  const owner =
    address.scope === "owner" ? `owner:${encoded(address.owner)}:` : "";
  if (address.type !== "list")
    return `${owner}${address.type}:${encoded(address.kind)}:${encoded(address.namespace)}:${encoded(address.key)}:${encoded(address.audience)}`;
  const filter = JSON.stringify(
    Object.fromEntries(
      Object.entries(address.filter).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  return `${owner}list:${encoded(address.audience)}:${encoded(address.kind)}:${encoded(filter)}:${encoded(address.page)}`;
}
function matches(
  filter: Record<string, string | string[]>,
  facets: ContentChange["old_facets"],
): boolean {
  if (facets === null) return false;
  return Object.entries(filter).every(([name, wanted]) => {
    const actual = facets[name];
    if (actual === undefined) return true; // Unknown filters are conservatively invalidated.
    const values = Array.isArray(actual) ? actual : [actual];
    const requested = Array.isArray(wanted) ? wanted : [wanted];
    return (
      requested.length === 0 ||
      requested.some((value) => values.includes(value))
    );
  });
}

/** Process-local values, durable DB cursors. Every mutable hit first catches up. */
export class ContentCacheService {
  private readonly entries = new Map<string, Entry>();
  private shared: Cursor | undefined;
  private readonly owners = new Map<string, Cursor | undefined>();
  private readonly fills = new Map<string, number>();
  private tail: Promise<void> = Promise.resolve();
  private readonly metrics = {
    hits: 0,
    misses: 0,
    probes: 0,
    rows: 0,
    invalidations: 0,
    clears: 0,
  };
  constructor(
    private readonly poller: Pick<
      ContentChangePollerService,
      "page"
    > = new ContentChangePollerService(),
    private readonly capacity = 512,
  ) {
    z.number().int().min(1).max(8192).parse(capacity);
  }

  async read<T>(
    address: ContentCacheAddress,
    load: () => Promise<T>,
    traceId = "content-cache",
  ): Promise<T> {
    const key = cacheKey(address);
    if (address.type === "blob") {
      const existing = this.entries.get(key);
      if (existing) {
        this.metrics.hits++;
        return structuredClone(existing.value) as T;
      }
      const value = await load();
      this.store(key, address, value);
      return structuredClone(value);
    }
    const owner = address.scope === "owner" ? address.owner : undefined;
    if (owner) this.fills.set(owner, (this.fills.get(owner) ?? 0) + 1);
    try {
      return await this.readMutable(address, key, load, traceId);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      console.error(
        JSON.stringify({
          level: "error",
          event: "content_cache_fill_failed",
          traceId,
        }),
      );
      throw this.unavailable("Content cache fill is temporarily unavailable.");
    } finally {
      if (owner) {
        const remaining = (this.fills.get(owner) ?? 1) - 1;
        if (remaining) this.fills.set(owner, remaining);
        else this.fills.delete(owner);
      }
      for (const active of this.owners.keys())
        if (
          !this.fills.has(active) &&
          ![...this.entries.values()].some(
            (entry) =>
              entry.address.type !== "blob" &&
              entry.address.scope === "owner" &&
              entry.address.owner === active,
          )
        )
          this.owners.delete(active);
    }
  }
  private async readMutable<T>(
    address: Exclude<ContentCacheAddress, { type: "blob" }>,
    key: string,
    load: () => Promise<T>,
    traceId: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (address.scope === "owner") this.activate(address.owner);
      await this.catchUp(traceId);
      const entry = this.entries.get(key);
      if (entry) {
        this.metrics.hits++;
        return structuredClone(entry.value) as T;
      }
      const before = this.version(address);
      this.metrics.misses++;
      const value = await load();
      await this.catchUp(traceId);
      if (before === this.version(address)) {
        this.store(key, address, value);
        return structuredClone(value);
      }
    }
    throw this.unavailable(
      "Content changed repeatedly while filling the cache.",
    );
  }
  stats() {
    return {
      ...this.metrics,
      entries: this.entries.size,
      activeOwners: this.owners.size,
      sharedCursor: this.shared?.seq ?? null,
    };
  }
  private activate(owner: string) {
    const current = this.owners.get(owner);
    this.owners.delete(owner);
    this.owners.set(owner, current);
    if (this.owners.size > 32) {
      const idle = this.owners.keys().next().value as string;
      this.owners.delete(idle);
      this.clear(idle);
    }
  }
  private store(key: string, address: ContentCacheAddress, value: unknown) {
    this.entries.delete(key);
    this.entries.set(key, { address, value: structuredClone(value) });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }
  private version(address: Exclude<ContentCacheAddress, { type: "blob" }>) {
    return `${this.shared?.generation ?? ""}:${address.scope === "owner" ? (this.owners.get(address.owner)?.generation ?? "") : ""}`;
  }
  private clear(owner?: string) {
    for (const [key, entry] of this.entries)
      if (
        entry.address.type !== "blob" &&
        (owner === undefined ||
          (entry.address.scope === "owner" && entry.address.owner === owner))
      )
        this.entries.delete(key);
    this.metrics.clears++;
  }
  private invalidate(change: ContentChange, owner?: string) {
    for (const [key, { address }] of this.entries) {
      if (address.type === "blob" || address.kind !== change.kind) continue;
      if (
        owner !== undefined &&
        (address.scope !== "owner" || address.owner !== owner)
      )
        continue;
      if (
        owner === undefined &&
        address.scope === "owner" &&
        address.owner !== change.namespace
      )
        continue;
      if (
        address.type === "list"
          ? matches(address.filter, change.old_facets) ||
            matches(address.filter, change.new_facets)
          : address.namespace === change.namespace && address.key === change.key
      ) {
        this.entries.delete(key);
        this.metrics.invalidations++;
      }
    }
  }
  private apply(
    stream: ContentChangePage["shared"],
    cursor: Cursor | undefined,
    owner?: string,
  ): Cursor {
    const head = BigInt(stream.head_seq),
      floor = BigInt(stream.retained_after_seq);
    if (
      floor > head ||
      BigInt(stream.generation) < BigInt(cursor?.generation ?? "0")
    )
      throw this.unavailable("Content cursor moved backwards.");
    if (!cursor || BigInt(cursor.seq) < floor || BigInt(cursor.seq) > head) {
      this.clear(owner);
      return { seq: stream.head_seq, generation: stream.generation };
    }
    let previous = BigInt(cursor.seq);
    for (const change of stream.changes) {
      const seq = BigInt(change.seq);
      if (
        seq !== previous + 1n ||
        seq > head ||
        BigInt(change.generation) > BigInt(stream.generation) ||
        (owner !== undefined && change.namespace !== owner)
      )
        throw this.unavailable("Content change page is not contiguous.");
      this.invalidate(change, owner);
      this.metrics.rows++;
      previous = seq;
    }
    if (previous < head && stream.changes.length === 0)
      throw this.unavailable("Content changes are missing.");
    return { seq: previous.toString(), generation: stream.generation };
  }
  private async catchUp(traceId: string) {
    const started = Date.now();
    const pending = this.tail.then(async () => {
      try {
        for (let pageIndex = 0; pageIndex < 16; pageIndex++) {
          if (Date.now() - started > 2500)
            throw this.unavailable(
              "Content catch-up exceeded its health window.",
            );
          this.metrics.probes++;
          const page = await this.poller.page(
            this.shared?.seq ?? null,
            [...this.owners].map(([user_id, cursor]) => ({
              user_id,
              after_seq: cursor?.seq ?? null,
            })),
            traceId,
          );
          if (Date.now() - started > 2500)
            throw this.unavailable(
              "Content catch-up exceeded its health window.",
            );
          this.shared = this.apply(page.shared, this.shared);
          for (const owner of page.owners)
            if (this.owners.has(owner.user_id))
              this.owners.set(
                owner.user_id,
                this.apply(
                  owner,
                  this.owners.get(owner.user_id),
                  owner.user_id,
                ),
              );
          if (
            this.shared.seq === page.shared.head_seq &&
            page.owners.every(
              (owner) => this.owners.get(owner.user_id)?.seq === owner.head_seq,
            )
          )
            return;
        }
        throw this.unavailable(
          "Content catch-up exceeded its bounded page window.",
        );
      } catch {
        this.clear();
        this.shared = undefined;
        for (const owner of this.owners.keys())
          this.owners.set(owner, undefined);
        console.error(
          JSON.stringify({
            level: "error",
            event: "content_cache_catchup_failed",
            traceId,
          }),
        );
        throw this.unavailable("Content cache is temporarily unavailable.");
      }
    });
    this.tail = pending.catch(() => undefined);
    return pending;
  }
  private unavailable(message: string) {
    return new ServiceError(503, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message,
    });
  }
}
let processCache: ContentCacheService | undefined;
export function getContentCache(): ContentCacheService {
  return (processCache ??= new ContentCacheService());
}
