import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
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
const { NpcCatalogReadService } =
  await import("../../backend/src/services/content/npc-catalog-read.service.ts");
const { NpcCatalogReadRepository } =
  await import("../../backend/src/db/repos/npc-catalog-read.repo.ts");
const { EntityContentReadService } =
  await import("../../backend/src/services/content/entity-content-read.service.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient } =
  await import("../../backend/src/db/supabase-client.ts");
const { NpcCatalogQuerySchema } =
  await import("../../shared/src/types/chimera-npc-catalog-read.ts");
const { configService } =
  await import("../../backend/src/services/config.service.ts");
const db = new Client({
  connectionString: url.href,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  lock_timeout: 1000,
});
const owner = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  first = randomUUID(),
  second = randomUUID(),
  privateId = randomUUID(),
  itemId = randomUUID(),
  worldOne = randomUUID(),
  worldTwo = randomUUID(),
  prefix = `npc-read-${randomUUID()}`;
const literal = '%_,"\\';
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const result = tail.then(job);
  tail = result.catch(() => {});
  return result;
}
function asRole(role, user, job) {
  return serial(async () => {
    const point = `npc_${++savepoint}`;
    await db.query(`savepoint ${point}`);
    try {
      await db.query(`set local role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',coalesce($1::text,''),true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
        [user, role],
      );
      return await job();
    } finally {
      await db.query(`rollback to savepoint ${point}`);
      await db.query(`release savepoint ${point}`);
    }
  });
}
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as catalog,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'[]')) from public.chimera_entities e) as entities,(select md5(coalesce(jsonb_agg(to_jsonb(w) order by id)::text,'[]')) from public.chimera_worlds w) as worlds,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by seq)::text,'[]')) from public.chimera_content_changes s) as shared,(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,'[]')) from public.chimera_content_change_state s) as state,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id,seq)::text,'[]')) from public.chimera_owner_content_changes s) as private,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id)::text,'[]')) from public.chimera_owner_content_generations s) as owners",
    )
  ).rows[0];
}
const identityColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const identity = (table) => (id) =>
  serial(async () => {
    assert.ok(["chimera_entities", "chimera_worlds"].includes(table));
    const rows = (
      await db.query(
        `select ${identityColumns} from public.${table} where id::text=$1 or key=$1 or slug=$1 limit 2`,
        [id],
      )
    ).rows;
    return rows.length === 1 ? rows[0] : null;
  });
const worldKey = async (id) => {
  const row = await identity("chimera_worlds")(id);
  return row
    ? row.owner_kind === "first_party"
      ? row.content_key
      : null
    : /^[a-f0-9-]{36}$/i.test(id)
      ? null
      : id;
};
const aliases = (keys) =>
  serial(
    async () =>
      (
        await db.query(
          `select ${identityColumns} from public.chimera_entities where owner_kind='first_party' and content_key=any($1)`,
          [keys],
        )
      ).rows,
  );
function repository() {
  const calls = { list: 0, body: 0 };
  return {
    calls,
    worldKey,
    firstPartyAliases: aliases,
    list: (p, key) =>
      asRole("anon", null, async () => {
        calls.list++;
        return (
          await db.query(
            "select public.chimera_public_npc_page($1,$2,$3,$4,$5,$6) as value",
            [
              p.q || p.search || null,
              p.world ?? null,
              key,
              p.activeOnly,
              p.limit,
              p.offset,
            ],
          )
        ).rows[0].value;
      }),
    isAdmin: () => Promise.resolve(false),
    resolve: identity("chimera_entities"),
    tags: () => Promise.resolve([]),
    find: (namespace, key) =>
      asRole("anon", null, async () => {
        calls.body++;
        const rows =
          namespace === "first_party"
            ? (
                await db.query(
                  "select content_key,owner_namespace,body,release_state,created_at,updated_at from public.chimera_content_source_items where content_kind='entity' and owner_namespace=$1 and content_key=$2 and release_state='published'",
                  [namespace, key],
                )
              ).rows
            : (
                await db.query(
                  "select id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,release_state,visibility,display_name,entity_type,raw_data,world_id,primary_image_url,icon_image_url,created_at,updated_at from public.chimera_entities where owner_kind='player' and owner_namespace=$1 and content_key=$2 and visibility='public'",
                  [namespace, key],
                )
              ).rows;
        const row = rows[0];
        return row
          ? {
              ...row,
              created_at: row.created_at.toISOString(),
              updated_at: row.updated_at.toISOString(),
            }
          : null;
      }),
  };
}
const changePage = (after, owners = []) =>
  asRole(
    "service_role",
    null,
    async () =>
      (
        await db.query(
          "select public.chimera_content_change_page($1,$2::jsonb,100) as value",
          [after, JSON.stringify(owners)],
        )
      ).rows[0].value,
  );
async function mutate(user, sql, params) {
  await db.query("set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await db.query(sql, params);
  } finally {
    await db.query("reset role").catch(() => {});
  }
}
async function release(key, state) {
  await db.query("set local role stonecaster_content_sync_owner");
  try {
    await db.query(
      "update public.chimera_content_source_items set release_state=$1 where content_kind='entity' and content_key=$2",
      [state, key],
    );
  } finally {
    await db.query("reset role");
  }
}
await db.connect();
try {
  // Actual anonymous SDK/RPC transport. Fixture writes below are rollback-only SQL.
  const live = new NpcCatalogReadRepository(getChimeraSupabaseClient());
  for (const q of [
    {},
    { q: literal },
    { world: "mystika" },
    { world: worldOne },
    { search: "guard", activeOnly: "1", offset: 1000 },
  ]) {
    const p = NpcCatalogQuerySchema.parse(q),
      result = await live.list(p, p.world === "mystika" ? "mystika" : null);
    assert.ok(Array.isArray(result.items));
    assert.ok(Number.isInteger(result.total));
  }
  const before = await fingerprint();
  await db.query("begin");
  // Idempotent migration with grants/RLS intact; rollback retains the already-applied definition.
  const migration = fs.readFileSync(
    new URL(
      "../migrations/20261009000000_public_npc_catalog.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(migration);
  await db.query(migration);
  assert.deepEqual(
    (
      await db.query(
        "select prosecdef,provolatile from pg_proc where oid='public.chimera_public_npc_page(text,text,text,boolean,integer,integer)'::regprocedure",
      )
    ).rows[0],
    { prosecdef: false, provolatile: "s" },
  );
  assert.deepEqual(
    (
      await db.query(
        "select has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,not exists (select 1 from aclexplode(proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_revoked from pg_proc where oid='public.chimera_public_npc_page(text,text,text,boolean,integer,integer)'::regprocedure",
      )
    ).rows[0],
    { anon: true, authenticated: true, public_revoked: true },
  );
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}'),($3,$4,'{}'),($5,$6,'{}')",
    [
      owner,
      owner + "@example.test",
      other,
      other + "@example.test",
      admin,
      admin + "@example.test",
    ],
  );
  await db.query(
    "insert into public.profiles(id,role) values($1,'admin') on conflict(id) do update set role='admin'",
    [admin],
  );
  for (const id of [worldOne, worldTwo])
    await mutate(
      owner,
      "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$2,'Fixture world',$2,'{\"summary\":\"fixture\"}','player',$3,'private')",
      [id, id, owner],
    );
  for (const [id, user, type, visibility, name, raw, world, created] of [
    [
      first,
      owner,
      "NPC",
      "public",
      prefix + " guard",
      {
        description: prefix + " history",
        role_tags: [prefix + literal],
        status: "active",
      },
      worldOne,
      "2025-01-01",
    ],
    [
      second,
      other,
      "NPC",
      "public",
      prefix + " guard",
      { description: prefix + " second", status: "retired" },
      worldTwo,
      "2025-01-02",
    ],
    [
      privateId,
      owner,
      "NPC",
      "private",
      prefix + " private",
      {},
      worldOne,
      "2025-01-03",
    ],
    [itemId, owner, "ITEM", "public", prefix + " item", {}, null, "2025-01-04"],
    [
      randomUUID(),
      owner,
      "NPC",
      "public",
      "Unrelated newer fixture",
      {},
      null,
      "2025-01-05",
    ],
  ])
    await mutate(
      user,
      "insert into public.chimera_entities(id,key,slug,display_name,entity_type,raw_data,owner_kind,owner_user_id,visibility,world_id,created_at) values($1,$2,$3,$4,$5,$6::jsonb,'player',$7,$8,$9,$10)",
      [
        id,
        id === first || id === second ? prefix : id,
        id === first || id === second ? prefix : id,
        name,
        type,
        JSON.stringify({ description: "Fixture", ...raw }),
        user,
        visibility,
        world,
        created,
      ],
    );
  await bootstrapLocalContentFleet(
    db,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  const items = (
    await db.query(
      "select content_kind as kind,content_key as key,owner_namespace,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items order by content_kind,content_key",
    )
  ).rows;
  const sample = items.find(
    (i) => i.kind === "entity" && i.body.entity_type === "NPC",
  );
  assert.ok(sample);
  const canonical = {
    ...sample,
    key: prefix + "-canonical",
    body: {
      ...sample.body,
      key: prefix + "-canonical",
      display_name: prefix + " canonical",
      raw_data: {
        ...sample.body.raw_data,
        description: prefix + " canon",
        status: "active",
      },
    },
  };
  await db.query(
    "set local session authorization stonecaster_content_deployer",
  );
  try {
    await db.query(
      "select content_deploy.content_sync_apply((select catalog_generation from content_deploy.validation_formats limit 1),$1,$2::jsonb)",
      [
        randomUUID(),
        JSON.stringify({
          items: [...items, canonical],
          deployment: { commit_sha: "f".repeat(40) },
        }),
      ],
    );
  } finally {
    await db.query("reset session authorization");
  }
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller),
    r = repository();
  const build = (cache) =>
    new NpcCatalogReadService(
      r,
      new EntityContentReadService(r, null, "npc-anon", cache),
      "npc-anon",
      cache,
    );
  const reader = build(one),
    peer = build(two),
    params = NpcCatalogQuerySchema.parse({ q: prefix, limit: 1 });
  let result = await reader.list(params);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].id, second);
  assert.equal(
    (await reader.list({ ...params, offset: 1 })).items[0].id,
    first,
  );
  assert.deepEqual(await reader.list({ ...params, offset: 2 }), {
    items: [],
    total: 2,
    limit: 1,
    offset: 2,
  });
  assert.equal(
    (await reader.list({ ...params, q: prefix + literal })).items[0].id,
    first,
  );
  await mutate(
    owner,
    "update public.chimera_entities set raw_data=jsonb_set(jsonb_set(raw_data,'{role_tags}','null'::jsonb),'{tags}',$1::jsonb) where id=$2",
    [JSON.stringify([prefix + literal]), first],
  );
  assert.equal(
    (await reader.list({ ...params, q: prefix + literal })).items[0].id,
    first,
  );
  assert.equal(
    (
      await reader.list({
        ...params,
        q: undefined,
        search: prefix + " history",
      })
    ).items[0].id,
    first,
  );
  assert.equal((await reader.list({ ...params, world: worldOne })).total, 1);
  assert.equal((await reader.list({ ...params, activeOnly: true })).total, 1);
  assert.equal((await reader.find(first)).status, "active");
  assert.equal((await reader.find(second)).status, "retired");
  await assert.rejects(reader.find(privateId), { statusCode: 404 });
  await assert.rejects(reader.find(itemId), { statusCode: 404 });
  await assert.rejects(reader.find(prefix), { statusCode: 404 });
  await assert.rejects(reader.find(canonical.key), { statusCode: 404 });
  // The authored tag edit invalidated the original page; warm its new value first.
  await reader.list(params);
  const hits = r.calls.list;
  await reader.list(params);
  assert.equal(r.calls.list, hits);
  await peer.list(params);
  const sharedHead = (await changePage(null)).shared.head_seq;
  await mutate(
    owner,
    "update public.chimera_entities set display_name='Private-only change' where id=$1",
    [privateId],
  );
  assert.equal((await changePage(null)).shared.head_seq, sharedHead);
  const privateHits = r.calls.list;
  await reader.list(params);
  assert.equal(r.calls.list, privateHits);
  // Old/new world filters and exact totals refresh on both instances.
  await peer.list({ ...params, world: worldOne });
  await peer.list({ ...params, world: worldTwo });
  await mutate(
    owner,
    "update public.chimera_entities set world_id=$1,raw_data=jsonb_set(raw_data,'{status}','\"retired\"') where id=$2",
    [worldTwo, first],
  );
  for (const client of [reader, peer]) {
    assert.equal((await client.list({ ...params, world: worldOne })).total, 0);
    assert.equal((await client.list({ ...params, world: worldTwo })).total, 2);
    assert.equal((await client.list({ ...params, activeOnly: true })).total, 0);
  }
  // RPC itself stays published-only even under an authenticated admin's broader RLS.
  const adminPage = await asRole(
    "authenticated",
    admin,
    async () =>
      (
        await db.query("select public.chimera_public_npc_page($1) as value", [
          prefix,
        ])
      ).rows[0].value,
  );
  assert.equal(adminPage.total, 2);
  await release(canonical.key, "published");
  for (const client of [reader, peer]) {
    assert.equal((await client.list(params)).total, 3);
    assert.equal(
      (await client.find(canonical.key)).name,
      prefix + " canonical",
    );
    assert.equal(
      (await client.list({ ...params, world: sample.body.world_key })).total,
      1,
    );
  }
  await release(canonical.key, "internal");
  for (const client of [reader, peer]) {
    assert.equal((await client.list(params)).total, 2);
    await assert.rejects(client.find(canonical.key), { statusCode: 404 });
  }
  await mutate(
    other,
    "update public.chimera_entities set visibility='private' where id=$1",
    [second],
  );
  for (const client of [reader, peer]) {
    assert.equal((await client.list(params)).total, 1);
    await assert.rejects(client.find(second), { statusCode: 404 });
  }
  await mutate(owner, "delete from public.chimera_entities where id=$1", [
    first,
  ]);
  for (const client of [reader, peer]) {
    assert.equal((await client.list(params)).total, 0);
    await assert.rejects(client.find(first), { statusCode: 404 });
  }
  for (const args of [
    [null, null, null, false, 0, 0],
    ["x".repeat(101), null, null, false, 20, 0],
    [null, null, null, false, 20, -1],
  ]) {
    await assert.rejects(
      asRole("anon", null, () =>
        db.query(
          "select public.chimera_public_npc_page($1,$2,$3,$4,$5,$6)",
          args,
        ),
      ),
      { code: "22023" },
    );
  }
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS anonymous SDK/RPC transport, migration idempotence/invoker grants, real-role RLS, literal role-tag/description search, pre-page filters/exact totals/empty pages, authored activity, ambiguous slug refusal, canonical release and admin isolation, private-event non-interference, two-instance world/activity/public/delete refresh, unchanged rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
