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
const { EntityContentReadService } =
  await import("../../backend/src/services/content/entity-content-read.service.ts");
const { EntityContentReadRepository } =
  await import("../../backend/src/db/repos/entity-content-read.repo.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
const { EntityReadQuerySchema } =
  await import("../../shared/src/types/chimera-entity-read.ts");
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
  prefix = `entity-read-${randomUUID()}`;
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
          event: "entity_reader_fixture_query_failed",
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
const identityColumns =
  "id,key,slug,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as catalog,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources,(select count(*)::text from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(w) order by id)::text,'[]')) from public.chimera_worlds w) as worlds,(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'[]')) from public.chimera_entities e) as entities,(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.chimera_tags t) as tags,(select md5(coalesce(jsonb_agg(to_jsonb(a) order by asset_id,tag_id,asset_type)::text,'[]')) from public.chimera_asset_tags a) as links,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by seq)::text,'[]')) from public.chimera_content_changes s) as shared,(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,'[]')) from public.chimera_content_change_state s) as state,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id,seq)::text,'[]')) from public.chimera_owner_content_changes s) as private,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by user_id)::text,'[]')) from public.chimera_owner_content_generations s) as owners",
    )
  ).rows[0];
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

// Rollback fixtures use real role/RLS queries on one serialized transaction.
// Production PostgREST projections/filters are checked separately below and in unit tests.
const normalize = (rows) =>
  rows.map((row) => ({
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }));
function repository(user) {
  const role = user === null ? "anon" : "authenticated",
    calls = { body: 0, tags: 0 };
  const identity = (table) => (id) =>
    serial(async () => {
      const rows = (
        await db.query(
          "select " +
            identityColumns +
            " from public." +
            table +
            " where id::text=$1 or key=$1 or slug=$1 limit 2",
          [id],
        )
      ).rows;
      return rows.length === 1 ? rows[0] : null;
    });
  return {
    calls,
    isAdmin: () =>
      asRole(
        role,
        user,
        async () =>
          (await db.query("select public.is_admin() as value")).rows[0].value,
      ),
    resolve: identity("chimera_entities"),
    worldKey: async (id) => {
      const world = await identity("chimera_worlds")(id);
      return world
        ? world.owner_kind === "first_party"
          ? world.content_key
          : null
        : /^[a-f0-9-]{36}$/i.test(id)
          ? null
          : id;
    },
    firstPartyAliases: (keys) =>
      serial(
        async () =>
          (
            await db.query(
              "select " +
                identityColumns +
                " from public.chimera_entities where owner_kind='first_party' and content_key=any($1)",
              [keys],
            )
          ).rows,
      ),
    list: (lane, isAdmin, selectedOwner, query, worldKey, order) =>
      asRole(role, user, async () => {
        calls.body++;
        if (
          query.world_id &&
          ((lane === "first_party" && worldKey === null) ||
            (lane !== "first_party" &&
              !/^[a-f0-9-]{36}$/i.test(query.world_id)))
        )
          return [];
        assert.ok(["created_at", "updated_at"].includes(order));
        const result =
          lane === "first_party"
            ? await db.query(
                "select * from public.chimera_content_source_items where content_kind='entity' and owner_namespace='first_party' and ($1 or release_state='published') and ($2::text is null or body->>'world_key'=$2) order by " +
                  order +
                  " desc,owner_namespace,content_key limit $3",
                [
                  isAdmin,
                  query.world_id ? worldKey : null,
                  query.offset + query.limit,
                ],
              )
            : await db.query(
                "select * from public.chimera_entities where owner_kind='player' and (case when $1='owner' then owner_user_id=$2::uuid else visibility='public' end) and ($3::uuid is null or world_id=$3) order by " +
                  order +
                  " desc,owner_namespace,content_key limit $4",
                [
                  lane,
                  selectedOwner,
                  query.world_id ?? null,
                  query.offset + query.limit,
                ],
              );
        return normalize(result.rows);
      }),
    find: (namespace, key, isAdmin, selectedOwner) =>
      asRole(role, user, async () => {
        calls.body++;
        const result =
          namespace === "first_party"
            ? await db.query(
                "select * from public.chimera_content_source_items where content_kind='entity' and owner_namespace=$1 and content_key=$2 and ($3 or release_state='published')",
                [namespace, key, isAdmin],
              )
            : await db.query(
                "select * from public.chimera_entities where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')",
                [namespace, key, selectedOwner],
              );
        return normalize(result.rows)[0] ?? null;
      }),
    tags: (id) =>
      asRole(role, user, async () => {
        calls.tags++;
        return (
          await db.query(
            "select t.id,t.tag_name from public.chimera_asset_tags a join public.chimera_tags t on t.id=a.tag_id where a.asset_id=$1 and a.asset_type='entity_template' order by t.id",
            [id],
          )
        ).rows;
      }),
  };
}
await db.connect();
try {
  const liveRepo = new EntityContentReadRepository(
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  );
  const actualPoller = new ContentChangePollerService();
  await actualPoller.page(null, [], "entity-reader-transport");
  assert.equal(await liveRepo.isAdmin(), false);
  for (const lane of ["first_party", "public"])
    for (const world_id of [undefined, "mystika", firstId])
      assert.ok(
        Array.isArray(
          await liveRepo.list(
            lane,
            false,
            null,
            EntityReadQuerySchema.parse({ world_id }),
            world_id === "mystika" ? "mystika" : null,
            "updated_at",
          ),
        ),
      );
  assert.deepEqual(await liveRepo.tags(firstId), []);
  await liveRepo.resolve(firstId);
  await liveRepo.worldKey("mystika");
  const before = await fingerprint();
  await db.query("begin");
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
  const worldOne = randomUUID(),
    worldTwo = randomUUID(),
    tagId = randomUUID();
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  for (const id of [worldOne, worldTwo])
    await db.query(
      "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$2,'Fixture world',$2,'{\"summary\":\"fixture\"}','player',$3,'private')",
      [id, id, owner],
    );
  await db.query("reset role");
  for (const [id, user, world] of [
    [firstId, owner, worldOne],
    [secondId, other, null],
  ]) {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await db.query(
      "insert into public.chimera_entities(id,key,slug,display_name,entity_type,raw_data,owner_kind,owner_user_id,visibility,world_id) values($1,$2,$2,'Private fixture','NPC','{\"base_state_json\":{\"declared\":7}}','player',$3,'private',$4)",
      [id, prefix, user, world],
    );
    await db.query("reset role");
  }
  await bootstrapLocalContentFleet(
    db,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  const items = (
    await db.query(
      "select content_kind as kind,content_key as key,owner_namespace,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items order by content_kind,content_key",
    )
  ).rows;
  const sample = items.find((r) => r.kind === "entity");
  assert.ok(sample);
  const fixture = {
    ...sample,
    key: prefix + "-first",
    body: {
      ...sample.body,
      key: prefix + "-first",
      display_name: "Canonical fixture",
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
          items: [...items, fixture],
          deployment: { commit_sha: "e".repeat(40) },
        }),
      ],
    );
  } finally {
    await db.query("reset session authorization");
  }
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller);
  const ownerRepo = repository(owner),
    otherRepo = repository(other),
    adminRepo = repository(admin);
  const mine = new EntityContentReadService(
      ownerRepo,
      owner,
      "entity-owner",
      one,
    ),
    peer = new EntityContentReadService(ownerRepo, owner, "entity-peer", two),
    foreign = new EntityContentReadService(
      otherRepo,
      other,
      "entity-foreign",
      one,
    ),
    internal = new EntityContentReadService(
      adminRepo,
      admin,
      "entity-admin",
      one,
    );
  const params = EntityReadQuerySchema.parse({});
  assert.equal((await mine.list(params, "owned"))[0].id, firstId);
  assert.equal((await foreign.list(params, "owned"))[0].id, secondId);
  assert.equal((await mine.find(firstId)).base_state_json.declared, 7);
  await peer.find(firstId);
  const hits = ownerRepo.calls.body;
  await mine.find(firstId);
  assert.equal(ownerRepo.calls.body, hits);
  await assert.rejects(foreign.find(firstId), { statusCode: 404 });
  assert.equal(
    (await internal.find(fixture.key)).display_name,
    "Canonical fixture",
  );
  await assert.rejects(foreign.find(fixture.key), { statusCode: 404 });
  const sharedHead = (await changePage(null)).shared.head_seq;
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query(
    "update public.chimera_entities set display_name='Private update' where id=$1",
    [firstId],
  );
  await db.query("reset role");
  assert.equal((await changePage(null)).shared.head_seq, sharedHead);
  assert.equal((await mine.find(firstId)).display_name, "Private update");
  assert.equal((await peer.find(firstId)).display_name, "Private update");
  assert.equal(
    (await mine.list({ ...params, world_id: worldOne }))[0].id,
    firstId,
  );
  assert.equal((await mine.list({ ...params, world_id: worldTwo })).length, 0);
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("update public.chimera_entities set world_id=$1 where id=$2", [
    worldTwo,
    firstId,
  ]);
  await db.query("reset role");
  assert.equal((await mine.list({ ...params, world_id: worldOne })).length, 0);
  assert.equal(
    (await mine.list({ ...params, world_id: worldTwo }))[0].id,
    firstId,
  );
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query(
    "insert into public.chimera_tags(id,tag_name,owner_kind,owner_user_id) values($1,'TAG_INITIAL','player',$2)",
    [tagId, owner],
  );
  await db.query(
    "insert into public.chimera_asset_tags(tag_id,asset_id,asset_type,owner_kind,owner_user_id) values($1,$2,'entity_template','player',$3)",
    [tagId, firstId, owner],
  );
  await db.query("reset role");
  assert.equal((await mine.find(firstId)).tags[0].tag_name, "TAG_INITIAL");
  const bodiesBeforeTag = ownerRepo.calls.body;
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query(
    "update public.chimera_tags set tag_name='TAG_RENAMED' where id=$1",
    [tagId],
  );
  await db.query("reset role");
  assert.equal((await mine.find(firstId)).tags[0].tag_name, "TAG_RENAMED");
  assert.equal(ownerRepo.calls.body, bodiesBeforeTag);
  for (const visibility of ["public", "private", "public"]) {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      owner,
    ]);
    await db.query(
      "update public.chimera_entities set visibility=$1 where id=$2",
      [visibility, firstId],
    );
    await db.query("reset role");
    if (visibility === "public") {
      assert.equal(
        (await foreign.find(firstId)).display_name,
        "Private update",
      );
      assert.deepEqual((await foreign.find(firstId)).tags, []);
    } else await assert.rejects(foreign.find(firstId), { statusCode: 404 });
    assert.equal(
      (await mine.list(params)).filter((r) => r.id === firstId).length,
      1,
    );
  }
  for (const state of ["published", "internal"]) {
    await db.query("set local role stonecaster_content_sync_owner");
    await db.query(
      "update public.chimera_content_source_items set release_state=$1 where content_kind='entity' and content_key=$2",
      [state, fixture.key],
    );
    await db.query("reset role");
    if (state === "published") {
      assert.equal(
        (await foreign.find(fixture.key)).display_name,
        "Canonical fixture",
      );
      assert.ok(
        (
          await foreign.list({ ...params, world_id: sample.body.world_key })
        ).some((r) => r.id === fixture.key),
      );
    } else {
      await assert.rejects(foreign.find(fixture.key), { statusCode: 404 });
      assert.ok(
        !(await foreign.list(params)).some((r) => r.id === fixture.key),
      );
    }
  }
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("delete from public.chimera_asset_tags where asset_id=$1", [
    firstId,
  ]);
  await db.query("reset role");
  assert.deepEqual((await foreign.find(firstId)).tags, []);
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("delete from public.chimera_entities where id=$1", [firstId]);
  await db.query("reset role");
  await assert.rejects(mine.find(firstId), { statusCode: 404 });
  assert.ok(!(await foreign.list(params)).some((r) => r.id === firstId));
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS actual SDK predicates/joins/poller, real-role RLS, canonical release gates, owner isolation, two-instance private refresh, old/new world-filter invalidation, public visibility/delete refresh, fresh tag edits/removal without body reload or private-tag disclosure, and unchanged rollback fingerprints",
  );
} finally {
  await tail;
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
