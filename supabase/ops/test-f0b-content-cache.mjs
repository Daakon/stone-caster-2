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
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422" &&
    !url.search &&
    !url.hash,
);
assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54421");
url.username = "supabase_admin";
Object.assign(process.env, env);
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { configService } =
  await import("../../backend/src/services/config.service.ts");
const db = new Client({
  connectionString: url.href,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  lock_timeout: 1000,
});
const peer = new Client({
  connectionString: url.href,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  lock_timeout: 200,
});
const owner = randomUUID(),
  other = randomUUID(),
  world = randomUUID(),
  prefix = `cache-${randomUUID()}`;
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as catalog,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by seq)::text,'[]')) from public.chimera_content_changes s) as shared,(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,'[]')) from public.chimera_content_change_state s) as state,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id)::text,'[]')) from public.chimera_owner_content_generations s) as owners,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id,seq)::text,'[]')) from public.chimera_owner_content_changes s) as private",
    )
  ).rows[0];
}
let savepointIndex = 0;
async function temporary(job) {
  const savepoint = `fixture_${++savepointIndex}`;
  await db.query(`savepoint ${savepoint}`);
  try {
    return await job();
  } finally {
    await db.query(`rollback to savepoint ${savepoint}`);
    await db.query(`release savepoint ${savepoint}`);
  }
}
async function denied(role, sql, args = []) {
  await temporary(async () => {
    await db.query(`set local role ${role}`);
    await assert.rejects(db.query(sql, args), { code: "42501" });
  });
}
async function page(after, owners = []) {
  return temporary(async () => {
    await db.query("set local role service_role");
    return (
      await db.query(
        "select public.chimera_content_change_page($1,$2::jsonb,100) as value",
        [after, JSON.stringify(owners)],
      )
    ).rows[0].value;
  });
}
async function userIdentity(id) {
  await db.query("set local role authenticated");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,true)",
    [id],
  );
}
async function deploy(items) {
  await db.query(
    "set local session authorization stonecaster_content_deployer",
  );
  try {
    return (
      await db.query(
        "select content_deploy.content_sync_apply((select catalog_generation from content_deploy.validation_formats limit 1),$1,$2::jsonb) as value",
        [
          randomUUID(),
          JSON.stringify({ items, deployment: { commit_sha: "c".repeat(40) } }),
        ],
      )
    ).rows[0].value;
  } finally {
    await db.query("reset session authorization").catch(() => undefined);
  }
}
try {
  await db.connect();
  await peer.connect();
  const before = await fingerprint();
  await db.query("begin");
  for (const role of [
    "anon",
    "authenticated",
    "service_role",
    "stonecaster_content_deployer",
  ]) {
    for (const table of [
      "chimera_content_changes",
      "chimera_content_change_state",
      "chimera_owner_content_changes",
      "chimera_owner_content_generations",
    ])
      await denied(role, `select * from public.${table}`);
    await denied(
      role,
      "select public.chimera_record_content_change(null,'{}'::jsonb,'world',false)",
    );
  }
  for (const role of ["anon", "authenticated", "stonecaster_content_deployer"])
    await denied(
      role,
      "select public.chimera_content_change_page(null,'[]'::jsonb,100)",
    );
  const privileges = (
    await db.query(
      "select rolcanlogin,rolinherit,rolbypassrls,has_table_privilege('stonecaster_content_change_owner','auth.users','SELECT') as auth_read,has_column_privilege('stonecaster_content_change_owner','public.chimera_content_source_items','body','SELECT') as body_read,has_schema_privilege('stonecaster_content_change_owner','public','CREATE') as schema_create from pg_roles where rolname='stonecaster_content_change_owner'",
    )
  ).rows[0];
  assert.deepEqual(privileges, {
    rolcanlogin: false,
    rolinherit: false,
    rolbypassrls: false,
    auth_read: false,
    body_read: false,
    schema_create: false,
  });
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}'),($3,$4,'{}')",
    [owner, `${owner}@example.test`, other, `${other}@example.test`],
  );
  const initial = await page(null, [{ user_id: owner, after_seq: null }]);
  const catalogBefore = (
    await db.query(
      "select generation::text from public.chimera_content_catalog_state where singleton",
    )
  ).rows[0].generation;
  await userIdentity(owner);
  await db.query(
    "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$2,$2,$2,jsonb_build_object('name','cache fixture'),'player',$3,'private')",
    [world, prefix, owner],
  );
  await db.query(
    "update public.chimera_worlds set genre='fantasy' where id=$1",
    [world],
  );
  await db.query("reset role");
  const privatePage = await page(initial.shared.head_seq, [
    { user_id: owner, after_seq: "0" },
    { user_id: other, after_seq: "0" },
  ]);
  assert.equal(privatePage.shared.head_seq, initial.shared.head_seq);
  assert.equal(privatePage.shared.generation, initial.shared.generation);
  assert.equal(
    (
      await db.query(
        "select generation::text from public.chimera_content_catalog_state where singleton",
      )
    ).rows[0].generation,
    catalogBefore,
  );
  assert.equal(
    privatePage.owners.find((row) => row.user_id === owner).changes.length,
    2,
  );
  assert.equal(
    privatePage.owners.find((row) => row.user_id === other).changes.length,
    0,
  );
  assert.ok(
    privatePage.owners
      .find((row) => row.user_id === owner)
      .changes.every((row) => row.namespace === owner),
  );
  const targeted = await page(null, [{ user_id: other, after_seq: "0" }]);
  assert.deepEqual(
    targeted.owners.map((row) => row.user_id),
    [other],
  );
  await userIdentity(owner);
  await db.query(
    "update public.chimera_worlds set visibility='public' where id=$1",
    [world],
  );
  await db.query("reset role");
  let visible = await page(initial.shared.head_seq);
  assert.equal(visible.shared.changes.length, 1);
  assert.equal(visible.shared.changes[0].old_facets.visibility, "private");
  assert.equal(visible.shared.changes[0].new_facets.visibility, "public");
  await userIdentity(owner);
  await db.query(
    "update public.chimera_worlds set visibility='private' where id=$1",
    [world],
  );
  await db.query("reset role");
  visible = await page(initial.shared.head_seq);
  assert.equal(visible.shared.changes.length, 2);
  assert.equal(visible.shared.changes[1].old_facets.visibility, "public");
  assert.equal(visible.shared.changes[1].new_facets.visibility, "private");
  assert.equal(
    visible.shared.changes[0].generation,
    visible.shared.changes[1].generation,
  );
  assert.ok(!JSON.stringify(visible).includes('"body"'));
  const rule = (
    await db.query(
      "insert into public.chimera_ruleset_templates(key,ui_category,definition,owner_kind,owner_user_id) values($1,'world',jsonb_build_object('name','cache fixture'),'player',$2) returning id",
      [`${prefix}-rule`, owner],
    )
  ).rows[0].id;
  await temporary(async () => {
    const privateHead = (await page(null)).shared.head_seq;
    const privateGeneration = (
      await db.query(
        "select generation::text from public.chimera_content_catalog_state where singleton",
      )
    ).rows[0].generation;
    await db.query(
      "insert into public.chimera_world_ruleset_link(world_id,ruleset_template_id) values($1,$2)",
      [world, rule],
    );
    assert.equal((await page(null)).shared.head_seq, privateHead);
    assert.equal(
      (
        await db.query(
          "select generation::text from public.chimera_content_catalog_state where singleton",
        )
      ).rows[0].generation,
      privateGeneration,
    );
  });
  await temporary(async () => {
    await userIdentity(owner);
    await db.query(
      "update public.chimera_worlds set visibility='public' where id=$1",
      [world],
    );
    await db.query("reset role");
    const publicHead = (await page(null)).shared.head_seq;
    await db.query(
      "insert into public.chimera_world_ruleset_link(world_id,ruleset_template_id) values($1,$2)",
      [world, rule],
    );
    const parentEvents = (await page(publicHead)).shared.changes;
    assert.deepEqual(parentEvents.map((row) => row.kind).sort(), [
      "world",
      "world_ruleset_link",
    ]);
    assert.ok(
      parentEvents.every((row) => row.new_facets.visibility === "public"),
    );
    assert.equal(parentEvents.find((row) => row.kind === "world").key, prefix);
  });
  await bootstrapLocalContentFleet(db, "c".repeat(40)); // Holds the existing shared/catalog fence until rollback.
  const committedUser = (
    await db.query(
      "select id from auth.users where id not in ($1,$2) order by id limit 1",
      [owner, other],
    )
  ).rows[0]?.id;
  assert.ok(
    committedUser,
    "Retained local account required for independent connection race",
  );
  await peer.query("begin");
  await peer.query("set local role service_role");
  await peer.query(
    "insert into public.chimera_worlds(key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$1,$1,jsonb_build_object('name','cache fixture'),'player',$2,'private')",
    [`${prefix}-peer`, committedUser],
  );
  await peer.query("rollback"); // Private writer succeeds while another transaction holds shared/catalog locks.
  await peer.query("begin");
  await peer.query("set local role service_role");
  await assert.rejects(
    peer.query(
      "insert into public.chimera_worlds(key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$1,$1,jsonb_build_object('name','cache fixture'),'player',$2,'public')",
      [`${prefix}-public`, committedUser],
    ),
    { code: "55P03" },
  );
  await peer.query("rollback");
  const items = (
    await db.query(
      "select content_kind as kind,owner_namespace,content_key as key,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items where owner_namespace='first_party' order by content_kind,content_key",
    )
  ).rows;
  const first = {
    kind: "tag",
    owner_namespace: "first_party",
    key: `${prefix}-one`,
    format_version: 1,
    body: { name: "cache fixture", tags: ["one"] },
    refs: [],
  };
  const second = {
    ...first,
    key: `${prefix}-two`,
    body: { name: "cache second", tags: ["two"] },
  };
  const poller = new ContentChangePollerService({ page });
  const one = new ContentCacheService(poller),
    two = new ContentCacheService(poller);
  const address = {
    type: "source",
    scope: "shared",
    kind: "tag",
    namespace: "first_party",
    key: first.key,
    audience: "admin",
  };
  const load = async () =>
    (
      await db.query(
        "select body from public.chimera_content_source_items where content_kind='tag' and owner_namespace='first_party' and content_key=$1",
        [first.key],
      )
    ).rows[0]?.body ?? null;
  assert.equal(await one.read(address, load), null);
  assert.equal(await two.read(address, load), null);
  const headBefore = (await page(null)).shared.head_seq;
  const receipt = await deploy([...items, first, second]);
  assert.equal(receipt.changed_keys.length, 2);
  const changed = await page(headBefore);
  assert.equal(changed.shared.changes.length, 2);
  assert.equal(
    changed.shared.changes[0].generation,
    changed.shared.changes[1].generation,
  );
  assert.deepEqual(await one.read(address, load), first.body);
  assert.deepEqual(await two.read(address, load), first.body);
  const noOpHead = (await page(null)).shared.head_seq;
  await deploy([...items, first, second]);
  assert.equal((await page(null)).shared.head_seq, noOpHead);
  const unchanged = await fingerprint();
  await temporary(async () => {
    await assert.rejects(
      deploy([
        { ...first, key: `${prefix}-a-valid` },
        { ...second, key: `${prefix}-z-invalid`, format_version: 2 },
      ]),
    );
  });
  assert.deepEqual(await fingerprint(), unchanged);
  await temporary(async () => {
    await db.query("set local role service_role");
    await assert.rejects(
      db.query("select public.chimera_content_change_page(0,'[]'::jsonb,101)"),
      { code: "22023" },
    );
  });
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS private isolation/no shared lock, active-owner pages, real-role grants, public visibility facets, atomic multi-key deploy/no-op/rollback, two independent cache instances, and unchanged rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await peer.query("rollback").catch(() => {});
  await db.end();
  await peer.end();
  configService.destroy();
}
