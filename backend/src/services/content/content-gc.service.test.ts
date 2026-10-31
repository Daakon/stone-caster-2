import { describe, it, expect, vi } from "vitest";
import { ContentGcService, parseContentGcArgs } from "./content-gc.service.js";
import {
  ContentGcRequestSchema,
  ContentGcReceiptSchema,
} from "../../../../shared/src/types/chimera-content-gc.js";
import { ServiceError } from "../../utils/serviceError.js";
const connection = "postgresql://operator:placeholder@127.0.0.1:54422/postgres";
const receipt = {
  dry_run: true,
  batch_size: 2,
  compiled_candidates: 1,
  blob_candidates: 2,
  compiled_deleted: 0,
  blobs_deleted: 0,
  bytes_eligible: "9007199254740993",
  bytes_reclaimed: "0",
};
describe("bounded operational snapshot cleanup", () => {
  it("requires an explicit local target/batch and defaults to dry-run", () => {
    expect(parseContentGcArgs(["--target=local", "--batch-size=2"])).toEqual({
      batch_size: 2,
      dry_run: true,
    });
    expect(
      parseContentGcArgs(["--target=local", "--batch-size=2", "--apply"]),
    ).toEqual({ batch_size: 2, dry_run: false });
  });
  it.each(
    [
      [],
      ["--target=hosted", "--batch-size=2"],
      ["--target=local", "--batch-size=0"],
      ["--target=local", "--batch-size=1001"],
      ["--target=local", "--batch-size=1.5"],
      ["--target=local", "--batch-size=-1"],
      ["--target=local", "--batch-size="],
      ["--target=local", "--batch-size=2", "--batch-size=3"],
      ["--target=local", "--batch-size=2", "--apply", "--apply"],
      ["--target=local", "--batch-size=2", "--force"],
      ["--target=local", "--target=local", "--batch-size=2"],
    ].map((args) => ({ args })),
  )("rejects unsafe CLI arguments %j", ({ args }) => {
    expect(() => parseContentGcArgs(args)).toThrow(ServiceError);
  });
  it("passes the explicit bounded request to the repository and retains bigint metrics as strings", async () => {
    const repository = { collect: vi.fn().mockResolvedValue(receipt) };
    expect(
      await new ContentGcService(repository).collect(connection, {
        batch_size: 2,
        dry_run: true,
      }),
    ).toEqual(receipt);
    expect(repository.collect).toHaveBeenCalledWith(connection, {
      batch_size: 2,
      dry_run: true,
    });
    expect(ContentGcReceiptSchema.parse(receipt).bytes_eligible).toBe(
      "9007199254740993",
    );
  });
  it.each([
    "not-a-url",
    "postgresql://operator:secret@db.example.com:54422/postgres",
    "postgresql://operator:secret@localhost:5432/postgres",
    "https://localhost:54422/postgres",
    "postgresql://operator:secret@localhost:54422/postgres?host=db.example.com",
    "postgresql://operator:secret@localhost:54422/postgres?port=5432",
    "postgresql://operator:secret@localhost:54422/postgres#other",
  ])("refuses unsafe targets before connecting: %s", async (url) => {
    const repository = { collect: vi.fn() };
    await expect(
      new ContentGcService(repository).collect(url, {
        batch_size: 2,
        dry_run: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.collect).not.toHaveBeenCalled();
  });
  it("rejects invalid direct service input before connecting", async () => {
    const repository = { collect: vi.fn() };
    await expect(
      new ContentGcService(repository).collect(connection, {
        batch_size: 0,
        dry_run: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.collect).not.toHaveBeenCalled();
    expect(ContentGcRequestSchema.safeParse({ batch_size: 2 }).success).toBe(
      false,
    );
  });
  it.each([
    { ...receipt, compiled_deleted: 1 },
    { ...receipt, bytes_reclaimed: "1" },
    { ...receipt, blobs_deleted: 3 },
    { ...receipt, compiled_candidates: 3 },
    { ...receipt, blob_candidates: 3 },
    { ...receipt, dry_run: false, bytes_reclaimed: "9007199254740994" },
    { ...receipt, batch_size: 3 },
    { ...receipt, dry_run: false },
    { bad: true },
  ])("refuses inconsistent/corrupt success receipts", async (response) => {
    const service = new ContentGcService({
      collect: vi.fn().mockResolvedValue(response),
    });
    await expect(
      service.collect(connection, { batch_size: 2, dry_run: true }),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
  it("returns a real apply receipt and hides database credentials on failure", async () => {
    const apply = {
      ...receipt,
      dry_run: false,
      compiled_deleted: 1,
      blobs_deleted: 1,
      bytes_reclaimed: "42",
    };
    const service = new ContentGcService({
      collect: vi
        .fn()
        .mockResolvedValueOnce(apply)
        .mockRejectedValueOnce(new Error(connection)),
    });
    expect(
      await service.collect(connection, { batch_size: 2, dry_run: false }),
    ).toEqual(apply);
    await expect(
      service.collect(connection, { batch_size: 2, dry_run: false }),
    ).rejects.toThrow("Check operator permissions");
  });
});
