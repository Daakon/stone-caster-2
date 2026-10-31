import {
  SUPPORTED_CONTENT_FORMAT,
  ContentFormatInventorySchema,
} from "../shared/src/types/chimera-content-readiness.ts";

// Local seeding precedes backend startup. Register this actual validation
// process/source version; this is never a Fly inventory or hosted bootstrap.
// Caller owns the surrounding maintenance transaction and rollback.
export async function bootstrapLocalContentFleet(client, commitSha) {
  if (!/^[0-9a-f]{40}$/.test(commitSha))
    throw new Error("A full local source commit is required");
  await client.query(
    "select generation from public.chimera_content_catalog_state where singleton for update",
  );
  await client.query(
    "insert into public.chimera_content_runtime_fleet(app_name,inventory_verified_at) values('stonecaster-local',clock_timestamp()) on conflict(singleton) do nothing",
  );
  const { rows } = await client.query(
    "select app_name from public.chimera_content_runtime_fleet where singleton",
  );
  if (rows[0]?.app_name !== "stonecaster-local")
    throw new Error("Refusing to replace a non-local runtime fleet");
  await client.query("set local role service_role");
  const result = await client.query(
    "select public.chimera_register_content_runtime($1,$2,$3,$4,$5,$6) as inventory",
    [
      "stonecaster-local",
      `local${process.pid}`,
      commitSha,
      `local-source:${commitSha}`,
      SUPPORTED_CONTENT_FORMAT.min,
      SUPPORTED_CONTENT_FORMAT.max,
    ],
  );
  await client.query("reset role");
  const inventory = ContentFormatInventorySchema.parse(
    result.rows[0]?.inventory,
  );
  if (
    [
      inventory.source_min,
      inventory.source_max,
      inventory.blob_min,
      inventory.blob_max,
    ].some(
      (version) =>
        version !== null &&
        (version < SUPPORTED_CONTENT_FORMAT.min ||
          version > SUPPORTED_CONTENT_FORMAT.max),
    )
  )
    throw new Error("Local validation code cannot read stored content formats");
}
