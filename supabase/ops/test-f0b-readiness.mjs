import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const { Client } = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("pg");
const env = dotenv.parse(
  fs.readFileSync(new URL("../../.env.stonecaster-local", import.meta.url)),
);
const url = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
assert.ok(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    !url.search &&
    !url.hash &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422",
  "Isolated local database required",
);
assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54421");
Object.assign(process.env, env);
const { ContentFormatService } =
  await import("../../backend/src/services/content/content-format.service.ts");
const { configService } =
  await import("../../backend/src/services/config.service.ts");
const db = new Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  lock_timeout: 5000,
});
async function inventory() {
  return (
    await db.query(
      "select public.chimera_content_format_inventory() as inventory",
    )
  ).rows[0].inventory;
}
const service = new ContentFormatService(
  { inventory },
  "local-readiness-harness",
);
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as generation,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select md5(coalesce(jsonb_agg(to_jsonb(b) order by sha256)::text,'[]')) from public.chimera_content_blobs b) as blobs",
    )
  ).rows[0];
}
await db.connect();
try {
  const before = await fingerprint();
  const ownership = (
    await db.query(
      "select r.rolcanlogin,r.rolinherit,r.rolbypassrls,p.prosecdef,p.provolatile,p.proconfig from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.chimera_content_format_inventory()'::regprocedure",
    )
  ).rows[0];
  assert.equal(ownership.rolcanlogin, false);
  assert.equal(ownership.rolinherit, false);
  assert.equal(ownership.rolbypassrls, false);
  assert.equal(ownership.prosecdef, true);
  assert.equal(ownership.provolatile, "s");
  assert.deepEqual(ownership.proconfig, ["search_path=pg_catalog, public"]);
  const permissions = (
    await db.query(
      "select has_column_privilege('stonecaster_content_readiness_owner','public.chimera_content_blobs','body','SELECT') as blob_body,has_column_privilege('stonecaster_content_readiness_owner','public.chimera_content_source_items','body','SELECT') as source_body,has_schema_privilege('stonecaster_content_readiness_owner','public','CREATE') as schema_create,has_function_privilege('stonecaster_content_deployer','public.chimera_content_format_inventory()','EXECUTE') as deployer_exec,(select count(*)::int from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='stonecaster_content_readiness_owner' and (m.inherit_option or m.set_option or m.member <> (select oid from pg_roles where rolname=session_user))) as memberships",
    )
  ).rows[0];
  assert.deepEqual(permissions, {
    blob_body: false,
    source_body: false,
    schema_create: false,
    deployer_exec: false,
    memberships: 0,
  });
  for (const role of ["anon", "authenticated"]) {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      await assert.rejects(inventory(), { code: "42501" });
    } finally {
      await db.query("rollback");
    }
  }
  await db.query("begin");
  await db.query("set local role service_role");
  const actual = await inventory();
  assert.deepEqual(Object.keys(actual).sort(), [
    "blob_max",
    "blob_min",
    "catalog_generation",
    "source_max",
    "source_min",
  ]);
  assert.equal(typeof actual.catalog_generation, "string");
  assert.equal((await service.readiness()).status, "ready");
  await db.query("reset role");
  await db.query("savepoint incompatible_source");
  const key = `readiness-${randomUUID()}`;
  const sourceBody = { format_version: 2, body: { name: key }, refs: [] };
  const hash = (
    await db.query(
      "select encode(extensions.digest(convert_to(public.content_canonical_json($1::jsonb),'UTF8'),'sha256'),'hex') as sha",
      [JSON.stringify(sourceBody)],
    )
  ).rows[0].sha;
  await db.query(
    "insert into public.chimera_content_source_items(content_kind,content_key,content_format_version,body,content_hash,catalog_generation) values('tag',$1,2,$2::jsonb,$3,$4)",
    [key, JSON.stringify(sourceBody.body), hash, before.generation],
  );
  await db.query("set local role service_role");
  assert.equal((await inventory()).source_max, 2);
  await assert.rejects(
    service.readiness(),
    (error) =>
      error.statusCode === 503 &&
      error.error.details.checks.db === true &&
      error.error.details.checks.contentFormats === false,
  );
  await db.query("rollback to savepoint incompatible_source");
  await db.query("savepoint incompatible_blob");
  await db.query(
    "insert into public.chimera_content_blobs(sha256,format_version,body,byte_count) values($1,2,$2::jsonb,octet_length($2::text))",
    [hash, JSON.stringify(sourceBody)],
  );
  await db.query("set local role service_role");
  assert.equal((await inventory()).blob_max, 2);
  await assert.rejects(
    service.readiness(),
    (error) =>
      error.statusCode === 503 &&
      error.error.details.checks.contentFormats === false,
  );
  await db.query("rollback to savepoint incompatible_blob");
  await db.query("savepoint missing_catalog");
  await db.query(
    "delete from public.chimera_content_catalog_state where singleton",
  );
  await db.query("set local role service_role");
  await assert.rejects(
    service.readiness(),
    (error) =>
      error.statusCode === 503 && error.error.details.checks.db === false,
  );
  await db.query("rollback to savepoint missing_catalog");
  await db.query("set local role service_role");
  assert.equal((await service.readiness()).status, "ready");
  await db.query("rollback");
  assert.deepEqual(
    await fingerprint(),
    before,
    "All fixtures must roll back without changing catalog, receipts, sources or blobs",
  );
  console.log(
    "PASS real metadata-only role boundary, v1 readiness, incompatible source/frozen blob rejection, missing-catalog failure and rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
