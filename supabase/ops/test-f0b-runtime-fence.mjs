import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import { bootstrapLocalContentFleet } from "../../scripts/bootstrap-local-content-fleet.mjs";
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
// The isolated stack already gives its maintenance role this password.
// Never rotate credentials: a missing maintenance login is a hard failure.
url.username = "supabase_admin";
Object.assign(process.env, env);
const { ContentFormatService } =
  await import("../../backend/src/services/content/content-format.service.ts");
const { configService } =
  await import("../../backend/src/services/config.service.ts");
const db = new Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  lock_timeout: 1000,
});
const peer = new Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  lock_timeout: 200,
});
const app = "runtime-fence-fixture",
  first = "abcdef01",
  second = "abcdef02";
const runtime = {
  app_name: app,
  machine_id: first,
  machine_version: "VERSION1",
  image_ref: "registry.fly.io/runtime-fence-fixture:one",
};
const flyNames = [
  "FLY_APP_NAME",
  "FLY_MACHINE_ID",
  "FLY_MACHINE_VERSION",
  "FLY_IMAGE_REF",
];
const originalFly = Object.fromEntries(
  flyNames.map((name) => [name, process.env[name]]),
);
async function register(client, identity = runtime, min = 1, max = 1) {
  return (
    await client.query(
      "select public.chimera_register_content_runtime($1,$2,$3,$4,$5,$6) as inventory",
      [
        identity.app_name,
        identity.machine_id,
        identity.machine_version,
        identity.image_ref,
        min,
        max,
      ],
    )
  ).rows[0].inventory;
}
const service = new ContentFormatService(
  { inventory: (identity) => register(db, identity) },
  "runtime-fence-harness",
);
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as generation,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select md5(coalesce(jsonb_agg(to_jsonb(b) order by sha256)::text,'[]')) from public.chimera_content_blobs b) as blobs,(select md5(coalesce(jsonb_agg(to_jsonb(f))::text,'[]')) from public.chimera_content_runtime_fleet f) as fleet,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by app_name,machine_id,machine_version)::text,'[]')) from public.chimera_content_runtime_builds r) as builds",
    )
  ).rows[0];
}
async function temporary(job) {
  await db.query("savepoint fixture");
  try {
    return await job();
  } finally {
    await db.query("rollback to savepoint fixture");
  }
}
async function rejected(role, sql, args = [], code = "42501") {
  await temporary(async () => {
    await db.query(`set local role ${role}`);
    await assert.rejects(db.query(sql, args), { code });
  });
}
async function sync(items, expected) {
  await db.query(
    "set local session authorization stonecaster_content_deployer",
  );
  return (
    await db.query(
      "select content_deploy.content_sync_apply($1::bigint,$2::uuid,$3::jsonb) as receipt",
      [
        expected,
        randomUUID(),
        JSON.stringify({ items, deployment: { commit_sha: "a".repeat(40) } }),
      ],
    )
  ).rows[0].receipt;
}
try {
  await db.connect();
  await peer.connect();
  assert.equal(
    (await db.query("select rolsuper from pg_roles where rolname=current_user"))
      .rows[0].rolsuper,
    true,
  );
  const before = await fingerprint();
  await db.query("begin");
  const owner = (
    await db.query(
      "select r.rolcanlogin,r.rolinherit,r.rolbypassrls,p.prosecdef,p.proconfig,has_schema_privilege(r.rolname,'public','CREATE') as schema_create,has_column_privilege(r.rolname,'public.chimera_content_source_items','body','SELECT') as source_body,has_table_privilege(r.rolname,'public.chimera_content_runtime_fleet','INSERT') as fleet_insert,has_table_privilege(r.rolname,'public.chimera_content_runtime_builds','DELETE') as build_delete from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.chimera_register_content_runtime(text,text,text,text,integer,integer)'::regprocedure",
    )
  ).rows[0];
  assert.deepEqual(owner, {
    rolcanlogin: false,
    rolinherit: false,
    rolbypassrls: false,
    prosecdef: true,
    proconfig: ["search_path=pg_catalog, public"],
    schema_create: false,
    source_body: false,
    fleet_insert: false,
    build_delete: false,
  });
  for (const role of [
    "anon",
    "authenticated",
    "service_role",
    "stonecaster_content_deployer",
  ]) {
    await rejected(role, "select * from public.chimera_content_runtime_builds");
    await rejected(
      role,
      "insert into public.chimera_content_runtime_fleet(app_name,inventory_verified_at) values('spoof',now())",
    );
  }
  const args = [app, first, "VERSION1", runtime.image_ref, 1, 1];
  for (const role of ["anon", "authenticated", "stonecaster_content_deployer"])
    await rejected(
      role,
      "select public.chimera_register_content_runtime($1,$2,$3,$4,$5,$6)",
      args,
    );
  await rejected(
    "stonecaster_content_runtime_owner",
    "update public.chimera_content_catalog_state set generation=generation+1 where singleton",
  );
  // All fixture membership changes use the same maintenance/catalog lock.
  await db.query(
    "select generation from public.chimera_content_catalog_state where singleton for update",
  );
  await db.query("delete from public.chimera_content_runtime_builds");
  await db.query("delete from public.chimera_content_runtime_fleet");
  await temporary(async () => {
    await bootstrapLocalContentFleet(db, "c".repeat(40));
    const local = (
      await db.query(
        "select app_name,format_min,format_max,machine_id,machine_version from public.chimera_content_runtime_builds",
      )
    ).rows[0];
    assert.deepEqual(local, {
      app_name: "stonecaster-local",
      format_min: 1,
      format_max: 1,
      machine_id: `local${process.pid}`,
      machine_version: "c".repeat(40),
    });
  });
  await temporary(async () => {
    await db.query("set local role service_role");
    await assert.rejects(register(db), { code: "P0F01" });
  });
  await db.query(
    "insert into public.chimera_content_runtime_fleet(app_name,inventory_verified_at) values($1,clock_timestamp())",
    [app],
  );
  await temporary(async () => {
    await db.query(
      "set local session authorization stonecaster_content_deployer",
    );
    const identity = (
      await db.query(
        "select deployment_target_contract_version,runtime_app_name,real_players_started,session_user as deploy_role,current_database() as database_name from content_deploy.validation_formats limit 1",
      )
    ).rows[0];
    assert.deepEqual(identity, {
      deployment_target_contract_version: 1,
      runtime_app_name: app,
      real_players_started: false,
      deploy_role: "stonecaster_content_deployer",
      database_name: "postgres",
    });
    await assert.rejects(
      db.query("select * from public.chimera_launch_guard"),
      { code: "42501" },
    );
  });
  await temporary(async () => {
    await db.query(
      "update public.chimera_launch_guard set real_players_started_at=clock_timestamp() where id",
    );
    await db.query(
      "set local session authorization stonecaster_content_deployer",
    );
    assert.equal(
      (
        await db.query(
          "select real_players_started from content_deploy.validation_formats limit 1",
        )
      ).rows[0].real_players_started,
      true,
    );
  });
  await temporary(async () => {
    await assert.rejects(
      bootstrapLocalContentFleet(db, "c".repeat(40)),
      /non-local runtime fleet/,
    );
  });
  await db.query(
    "insert into public.chimera_content_runtime_builds(app_name,machine_id,machine_version) values($1,$2,'VERSION1'),($1,$3,'VERSION1')",
    [app, first, second],
  );
  Object.assign(process.env, {
    FLY_APP_NAME: app,
    FLY_MACHINE_ID: first,
    FLY_MACHINE_VERSION: "VERSION1",
    FLY_IMAGE_REF: runtime.image_ref,
  });
  await db.query("set local role service_role");
  assert.equal((await service.readiness()).status, "ready");
  await db.query("reset role");
  const sourceItems = (
    await db.query(
      "select content_kind as kind,owner_namespace,content_key as key,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items where owner_namespace='first_party' order by content_kind,content_key",
    )
  ).rows;
  assert.ok(sourceItems.length, "Synced catalog required");
  const items = [
    ...sourceItems,
    {
      kind: "tag",
      owner_namespace: "first_party",
      key: `runtime-fence-${randomUUID()}`,
      format_version: 1,
      body: { name: "rollback-only runtime fence" },
      refs: [],
    },
  ];
  async function refuses(code) {
    const initial = await fingerprint();
    await temporary(async () => {
      await assert.rejects(sync(items, initial.generation), { code });
    });
    assert.deepEqual(await fingerprint(), initial);
  }
  await refuses("P0F01"); // The second inventoried machine has never reported.
  await db.query("set local role service_role");
  await register(
    db,
    {
      ...runtime,
      machine_id: second,
      image_ref: "registry.fly.io/runtime-fence-fixture:two",
    },
    2,
    2,
  );
  await db.query("reset role");
  await db.query(
    "update public.chimera_content_runtime_builds set last_reported_at=now()-interval '365 days' where machine_id=$1",
    [second],
  );
  await refuses("P0F02"); // Stale/sleeping builds do not disappear.
  await temporary(async () => {
    await db.query("set local role service_role");
    await assert.rejects(
      register(
        db,
        {
          ...runtime,
          machine_id: second,
          image_ref: "registry.fly.io/runtime-fence-fixture:two",
        },
        1,
        1,
      ),
      { code: "22023" },
    );
  });
  await temporary(async () => {
    await db.query("set local role service_role");
    await assert.rejects(register(db, runtime, 0, 1), { code: "22023" });
  });
  await temporary(async () => {
    await db.query("set local role service_role");
    await assert.rejects(register(db, { ...runtime, app_name: "wrong-app" }), {
      code: "P0F01",
    });
  });
  await db.query(
    "update public.chimera_content_runtime_builds set retired_at=clock_timestamp() where machine_id=$1",
    [second],
  );
  await db.query("set local role service_role");
  await register(db, {
    ...runtime,
    machine_id: second,
    machine_version: "VERSION2",
    image_ref: "registry.fly.io/runtime-fence-fixture:three",
  });
  await db.query("reset role");
  await temporary(async () => {
    const initial = await fingerprint();
    const receipt = await sync(items, initial.generation);
    assert.equal(receipt.outcome, "applied");
    assert.equal(receipt.item_count, items.length);
    assert.equal(
      String(receipt.generation),
      String(BigInt(initial.generation) + 1n),
    );
    await db.query("reset session authorization");
    const noOp = await sync(items, String(receipt.generation));
    assert.deepEqual(noOp.changed_keys, []);
    assert.deepEqual(noOp.old_new_hashes, []);
  });
  await temporary(async () => {
    await db.query(
      "update public.chimera_content_runtime_builds set retired_at=clock_timestamp()",
    );
    await assert.rejects(sync(items, before.generation), { code: "P0F01" });
  });
  await temporary(async () => {
    await db.query(
      "update public.chimera_content_runtime_builds set retired_at=clock_timestamp() where machine_id=$1",
      [first],
    );
    const document = {
      format_version: 2,
      body: { name: "unsupported retained blob" },
      refs: [],
    };
    const hash = (
      await db.query(
        "select encode(extensions.digest(convert_to(public.content_canonical_json($1::jsonb),'UTF8'),'sha256'),'hex') as hash",
        [JSON.stringify(document)],
      )
    ).rows[0].hash;
    await db.query(
      "insert into public.chimera_content_blobs(sha256,format_version,body,byte_count) values($1,2,$2::jsonb,octet_length($2::text))",
      [hash, JSON.stringify(document)],
    );
    await db.query("set local role service_role");
    await assert.rejects(
      service.readiness(),
      (error) =>
        error.statusCode === 503 &&
        error.error.details.checks.contentFormats === false,
    );
    await db.query("reset role");
    assert.equal(
      (
        await db.query(
          "select retired_at from public.chimera_content_runtime_builds where machine_id=$1 and machine_version='VERSION1'",
          [first],
        )
      ).rows[0].retired_at,
      null,
      "A waking old version restores its durable gate entry even when not ready",
    );
  });
  await peer.query("set role service_role");
  await assert.rejects(
    register(peer),
    { code: "55P03" },
    "Registration waits on the same lock held by content sync/maintenance",
  );
  await peer.query("reset role");
  await peer.query("set session authorization stonecaster_content_deployer");
  await assert.rejects(
    peer.query(
      "select content_deploy.content_sync_apply($1::bigint,$2::uuid,$3::jsonb)",
      [
        before.generation,
        randomUUID(),
        JSON.stringify({ items, deployment: { commit_sha: "b".repeat(40) } }),
      ],
    ),
    { code: "55P03" },
    "Sync waits on the same lock held by runtime registration",
  );
  await peer.query("reset session authorization");
  await db.query("rollback");
  assert.deepEqual(
    await fingerprint(),
    before,
    "Registry, receipts, generations and content fixtures must all roll back",
  );
  console.log(
    "PASS real scoped registry privileges, unknown/stale/incompatible fleet refusal, immutable identities, compatible/no-op sync, sleeping-build refusal, shared-lock races and unchanged rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await Promise.allSettled([db.end(), peer.end()]);
  for (const [name, value] of Object.entries(originalFly)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  configService.destroy();
}
