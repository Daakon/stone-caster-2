import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentGcRepository } from "./content-gc.repo.js";
const db = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));
vi.mock("pg", () => ({
  default: {
    Client: class {
      connect = db.connect;
      query = db.query;
      end = db.end;
    },
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  db.connect.mockResolvedValue(undefined);
  db.end.mockResolvedValue(undefined);
});
describe("GC repository operational privilege boundary", () => {
  it("enters the restricted operator role and makes one bounded RPC", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ receipt: { dry_run: true } }] });
    expect(
      await new ContentGcRepository().collect("postgresql://local", {
        batch_size: 2,
        dry_run: true,
      }),
    ).toEqual({ dry_run: true });
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      "set role stonecaster_content_gc_operator",
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      "select public.chimera_content_gc($1::integer,$2::boolean) as receipt",
      [2, true],
    );
    expect(db.end).toHaveBeenCalledOnce();
  });
  it("closes the connection on role/RPC/connect failure", async () => {
    db.connect.mockRejectedValueOnce(new Error("offline"));
    await expect(
      new ContentGcRepository().collect("postgresql://local", {
        batch_size: 2,
        dry_run: true,
      }),
    ).rejects.toThrow("offline");
    expect(db.end).toHaveBeenCalledOnce();
    db.query.mockRejectedValueOnce(new Error("role denied"));
    await expect(
      new ContentGcRepository().collect("postgresql://local", {
        batch_size: 2,
        dry_run: true,
      }),
    ).rejects.toThrow("role denied");
    expect(db.end).toHaveBeenCalledTimes(2);
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("RPC denied"));
    await expect(
      new ContentGcRepository().collect("postgresql://local", {
        batch_size: 2,
        dry_run: true,
      }),
    ).rejects.toThrow("RPC denied");
    expect(db.end).toHaveBeenCalledTimes(3);
  });
  it("does not invent a success receipt for an empty result", async () => {
    db.query.mockResolvedValue({ rows: [] });
    expect(
      await new ContentGcRepository().collect("postgresql://local", {
        batch_size: 2,
        dry_run: false,
      }),
    ).toBeUndefined();
  });
});
