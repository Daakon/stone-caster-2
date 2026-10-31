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
const { StoryContentReadService } =
  await import("../../backend/src/services/content/story-content-read.service.ts");
const { StoryContentReadRepository } =
  await import("../../backend/src/db/repos/story-content-read.repo.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
const { StoryReadQuerySchema } =
  await import("../../shared/src/types/chimera-story-read.ts");
const { WorldContentReadService } =
  await import("../../backend/src/services/content/world-content-read.service.ts");
const { StorySourceReadSchema } =
  await import("../../shared/src/types/chimera-story-read.ts");
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
  firstId = randomUUID(),
  secondId = randomUUID(),
  prefix = `story-read-${randomUUID()}`;
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const pending = tail.then(job);
  tail = pending.catch(() => {});
  return pending;
}
function asRole(role, user, job) {
  return serial(async () => {
    const point = `reader_${++savepoint}`;
    await db.query(`savepoint ${point}`);
    try {
      await db.query(`set local role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',coalesce($1::text,''),true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
        [user, role],
      );
      return await job();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "story_reader_fixture_query_failed",
          code: error.code,
          message: error.message,
        }),
      );
      throw error;
    } finally {
      await db.query(`rollback to savepoint ${point}`);
      await db.query(`release savepoint ${point}`);
    }
  });
}

async function fingerprint() {
  const result = {};
  for (const [table, order] of [
    ["chimera_content_catalog_state", "singleton"],
    ["chimera_content_source_items", "content_kind,content_key"],
    ["chimera_worlds", "id"],
    ["chimera_stories", "id"],
    ["chimera_compiled_stories", "id"],
    ["chimera_content_blobs", "sha256"],
    ["chimera_tier_limits", "tier_key"],
    ["chimera_user_entitlements", "user_id"],
    ["chimera_entitlement_active_choices", "user_id,priority"],
    ["chimera_content_changes", "seq"],
    ["chimera_content_change_state", "singleton"],
    ["chimera_owner_content_changes", "user_id,seq"],
    ["chimera_owner_content_generations", "user_id"],
  ])
    result[table] = (
      await db.query(
        "select md5(coalesce(jsonb_agg(to_jsonb(t) order by " +
          order +
          ")::text,'[]')) as hash from public." +
          table +
          " t",
      )
    ).rows[0].hash;
  return result;
}
async function changePage(after, owners = []) {
  return asRole(
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
}
const normalize = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
const identityColumns =
  "id,owner_kind,owner_namespace,owner_user_id,content_key,visibility";
function repository(user) {
  const role = user === null ? "anon" : "authenticated",
    calls = { body: 0 };
  return {
    calls,
    resolve: (id) =>
      serial(
        async () =>
          (
            await db.query(
              "select " +
                identityColumns +
                " from public.chimera_stories where id=$1",
              [id],
            )
          ).rows[0] ?? null,
      ),
    list: (selectedOwner, params) =>
      asRole(role, user, async () => {
        calls.body++;
        const rows = (
          await db.query(
            "select * from public.chimera_stories where owner_kind='player' and (case when $1::uuid is null then visibility='public' and status in ('compiled','bound') and current_compiled_id is not null else owner_user_id=$1 end) order by created_at desc,id offset $2 limit $3",
            [selectedOwner, params.offset, params.limit],
          )
        ).rows;
        return rows.map((row) => StorySourceReadSchema.parse(normalize(row)));
      }),
    find: (namespace, key, selectedOwner) =>
      asRole(role, user, async () => {
        calls.body++;
        const row = (
          await db.query(
            "select * from public.chimera_stories where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')",
            [namespace, key, selectedOwner],
          )
        ).rows[0];
        return row ? StorySourceReadSchema.parse(normalize(row)) : null;
      }),
  };
}
function worldRepository(user) {
  const role = user === null ? "anon" : "authenticated";
  return {
    isAdmin: () =>
      asRole(
        role,
        user,
        async () =>
          (await db.query("select public.is_admin() as value")).rows[0].value,
      ),
    resolve: (id) =>
      serial(
        async () =>
          (
            await db.query(
              "select id,key,slug,owner_kind,owner_namespace,owner_user_id,content_key,visibility from public.chimera_worlds where id::text=$1",
              [id],
            )
          ).rows[0] ?? null,
      ),
    find: (namespace, key, isAdmin, selectedOwner) =>
      asRole(role, user, async () => {
        const row = (
          await db.query(
            namespace === "first_party"
              ? "select * from public.chimera_content_source_items where content_kind='world' and owner_namespace=$1 and content_key=$2 and ($3::boolean or release_state='published')"
              : "select * from public.chimera_worlds where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')",
            [
              namespace,
              key,
              namespace === "first_party" ? isAdmin : selectedOwner,
            ],
          )
        ).rows[0];
        return row ? normalize(row) : null;
      }),
  };
}
async function write(user, sql, args = []) {
  await db.query("set local role authenticated");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role','authenticated')::text,true)",
      [user],
    );
    return await db.query(sql, args);
  } finally {
    await db.query("reset role");
  }
}
await db.connect();
try {
  const live = new StoryContentReadRepository(
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  );
  await new ContentChangePollerService().page(
    null,
    [],
    "story-reader-transport",
  );
  for (const search of [
    undefined,
    'literal",visibility.eq.private,(title.ilike.*)',
    "100%_\\",
    "comma,colon:dot.",
  ])
    assert.ok(
      Array.isArray(
        await live.list(null, StoryReadQuerySchema.parse({ search })),
      ),
    );
  assert.equal(await live.resolve(firstId), null);
  assert.equal(await live.find(owner, "missing", null), null);
  const before = await fingerprint();
  await db.query("begin");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}'),($3,$4,'{}')",
    [owner, owner + "@example.test", other, other + "@example.test"],
  );
  const tier = prefix + "-tier",
    worldId = randomUUID(),
    extraId = randomUUID(),
    compiledId = randomUUID();
  await db.query(
    "insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) values($1,4,4)",
    [tier],
  );
  for (const user of [owner, other])
    await db.query(
      "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
      [user, tier],
    );
  await write(
    owner,
    "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$2,'Private world',$2,'{\"summary\":\"Authored summary\"}','player',$3,'private')",
    [worldId, prefix + "-world", owner],
  );
  for (const [id, user, world] of [
    [firstId, owner, worldId],
    [secondId, other, null],
    [extraId, owner, null],
  ]) {
    await db.query("set local role service_role");
    await db.query(
      "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)",
    );
    await db.query("select public.chimera_create_owned_story($1,$2::jsonb)", [
      user,
      JSON.stringify({
        id,
        display_name: "Fixture " + id,
        world_id: world,
        configuration: { rulesetIds: ["declared-fixture"] },
      }),
    ]);
    await db.query("reset role");
  }
  // Same stable key in two owner namespaces proves UUID resolution selects the correct owner.
  await write(
    owner,
    "update public.chimera_stories set content_key=$1 where id=$2",
    [prefix, firstId],
  );
  await write(
    other,
    "update public.chimera_stories set content_key=$1 where id=$2",
    [prefix, secondId],
  );
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller);
  const ownerRepo = repository(owner),
    otherRepo = repository(other),
    anonRepo = repository(null);
  const mine = new StoryContentReadService(
      ownerRepo,
      new WorldContentReadService(
        worldRepository(owner),
        owner,
        "world-owner",
        one,
      ),
      owner,
      "story-owner",
      one,
    ),
    peer = new StoryContentReadService(
      ownerRepo,
      new WorldContentReadService(
        worldRepository(owner),
        owner,
        "world-peer",
        two,
      ),
      owner,
      "story-peer",
      two,
    );
  const foreign = new StoryContentReadService(
      otherRepo,
      new WorldContentReadService(
        worldRepository(other),
        other,
        "world-other",
        one,
      ),
      other,
      "story-other",
      one,
    ),
    publicReader = new StoryContentReadService(
      anonRepo,
      new WorldContentReadService(
        worldRepository(null),
        null,
        "world-public",
        one,
      ),
      null,
      "story-public",
      one,
    );
  const params = StoryReadQuerySchema.parse({});
  assert.ok((await mine.list(params)).some((s) => s.id === firstId));
  assert.equal((await foreign.list(params))[0].id, secondId);
  assert.equal((await mine.find(firstId)).world.name, "Private world");
  await peer.find(firstId);
  await assert.rejects(foreign.find(firstId), { statusCode: 404 });
  await assert.rejects(publicReader.catalogFind(firstId), { statusCode: 404 });
  assert.deepEqual(await publicReader.catalogList(params), []);
  const head = (await changePage(null)).shared.head_seq;
  await write(
    owner,
    "update public.chimera_stories set display_name='Private edit',title='Private edit' where id=$1",
    [firstId],
  );
  assert.equal((await changePage(null)).shared.head_seq, head);
  assert.equal((await mine.find(firstId)).display_name, "Private edit");
  assert.equal((await peer.find(firstId)).display_name, "Private edit");
  const storyBodies = ownerRepo.calls.body;
  await write(
    owner,
    "update public.chimera_worlds set name='Private world edit' where id=$1",
    [worldId],
  );
  assert.equal((await mine.find(firstId)).world.name, "Private world edit");
  assert.equal((await peer.find(firstId)).world.name, "Private world edit");
  assert.equal(ownerRepo.calls.body, storyBodies);
  await write(
    owner,
    "update public.chimera_stories set visibility='public',status='compiled' where id=$1",
    [firstId],
  );
  assert.equal((await foreign.find(firstId)).world, null);
  assert.deepEqual(await publicReader.catalogList(params), []);
  await assert.rejects(publicReader.catalogFind(firstId), { statusCode: 404 });
  // Maintenance-only immutable compile fixture; no production compile/release action is added.
  const body = { format_version: 1, body: { test_fixture: prefix }, refs: [] };
  const hash = (
    await db.query(
      "select encode(extensions.digest(convert_to(public.content_canonical_json($1::jsonb),'UTF8'),'sha256'),'hex') as hash",
      [JSON.stringify(body)],
    )
  ).rows[0].hash;
  await db.query(
    "insert into public.chimera_content_blobs(sha256,format_version,body,byte_count) values($1,1,$2::jsonb,octet_length(convert_to(public.content_canonical_json($2::jsonb),'UTF8')))",
    [hash, JSON.stringify(body)],
  );
  await db.query(
    "insert into public.chimera_compiled_stories(id,story_id,payload_blob_hash,frozen_owner_user_id,frozen_title) values($1,$2,$3,$4,$5)",
    [compiledId, firstId, hash, owner, "Fixture compile"],
  );
  await write(
    owner,
    "update public.chimera_stories set current_compiled_id=$1,opening_text='Authored opening' where id=$2",
    [compiledId, firstId],
  );
  assert.equal((await publicReader.catalogList(params))[0].id, firstId);
  assert.equal((await publicReader.catalogFind(firstId)).has_prompt, true);
  assert.equal((await publicReader.catalogFind(firstId)).world_name, null);
  await write(
    owner,
    "update public.chimera_worlds set visibility='public' where id=$1",
    [worldId],
  );
  assert.equal(
    (await publicReader.catalogFind(firstId)).world_name,
    "Private world edit",
  );
  const publicBodies = anonRepo.calls.body;
  await write(
    owner,
    "update public.chimera_worlds set name='Public world edit' where id=$1",
    [worldId],
  );
  assert.equal(
    (await publicReader.catalogFind(firstId)).world_name,
    "Public world edit",
  );
  assert.equal(anonRepo.calls.body, publicBodies);
  await write(
    owner,
    "update public.chimera_worlds set visibility='private' where id=$1",
    [worldId],
  );
  assert.equal((await publicReader.catalogFind(firstId)).world_name, null);
  await write(
    owner,
    "update public.chimera_stories set visibility='private' where id=$1",
    [firstId],
  );
  await assert.rejects(publicReader.catalogFind(firstId), { statusCode: 404 });
  assert.deepEqual(await publicReader.catalogList(params), []);
  assert.equal((await mine.find(firstId)).visibility, "private");
  await write(
    owner,
    "update public.chimera_stories set visibility='public' where id=$1",
    [firstId],
  );
  assert.equal((await publicReader.catalogList(params))[0].id, firstId);
  await write(owner, "delete from public.chimera_worlds where id=$1", [
    worldId,
  ]);
  assert.equal((await mine.find(firstId)).world_id, null);
  assert.equal((await publicReader.catalogFind(firstId)).world_name, null);
  await db.query(
    "update public.chimera_tier_limits set max_owned_stories=0 where tier_key=$1",
    [tier],
  );
  const readonly = await asRole(
    "authenticated",
    owner,
    async () =>
      (await db.query("select public.chimera_entitlements_active() as value"))
        .rows[0].value,
  );
  assert.deepEqual(readonly.writable_story_ids, []);
  assert.ok((await mine.list(params)).some((s) => s.id === extraId));
  assert.equal((await mine.find(extraId)).id, extraId);
  await assert.rejects(
    asRole("authenticated", owner, () =>
      db.query("update public.chimera_stories set title='denied' where id=$1", [
        extraId,
      ]),
    ),
    /STORY_READ_ONLY_TIER_LIMIT/,
  );
  await write(owner, "delete from public.chimera_stories where id=$1", [
    firstId,
  ]);
  await assert.rejects(mine.find(firstId), { statusCode: 404 });
  assert.deepEqual(await publicReader.catalogList(params), []);
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS actual SDK search/projections/poller, real anon/owner RLS, same-key owner isolation, two-instance private refresh with zero shared events, public compile/visibility/delete refresh, separately authorized world edits/hiding/deletion without stale joins, read-only owned draft access with writes denied, and unchanged rollback fingerprints",
  );
} finally {
  await tail;
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
