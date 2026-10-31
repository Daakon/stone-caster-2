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
const { LoreContentReadService } =
  await import("../../backend/src/services/content/lore-content-read.service.ts");
const { LoreContentReadRepository } =
  await import("../../backend/src/db/repos/lore-content-read.repo.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
const { ServiceError } =
  await import("../../backend/src/utils/serviceError.ts");
const { ApiErrorCode } = await import("../../shared/src/types/api.ts");
const { LoreReadQuerySchema, LoreContextQuerySchema } =
  await import("../../shared/src/types/chimera-lore-read.ts");
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
  worldOne = randomUUID(),
  worldTwo = randomUUID(),
  worldOther = randomUUID(),
  entity = randomUUID(),
  foreignEntity = randomUUID(),
  story = randomUUID(),
  first = randomUUID(),
  second = randomUUID(),
  entityLore = randomUUID(),
  storyLore = randomUUID(),
  tagId = randomUUID(),
  prefix = `lore-read-${randomUUID()}`;
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const pending = tail.then(job);
  tail = pending.catch(() => {});
  return pending;
}
function asRole(role, user, job) {
  return serial(async () => {
    const point = `lore_${++savepoint}`;
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
const normalize = (rows) =>
  rows.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));
const identityColumns =
  "id,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const playerColumns =
  identityColumns +
  ",release_state,is_official,fragment,keywords,world_id,entity_id,story_id,created_at,updated_at";
async function fingerprint() {
  const result = {};
  for (const table of [
    "chimera_content_catalog_state",
    "chimera_content_source_items",
    "chimera_content_deploy_log",
    "chimera_lore",
    "chimera_worlds",
    "chimera_entities",
    "chimera_stories",
    "chimera_tags",
    "chimera_asset_tags",
    "chimera_content_changes",
    "chimera_content_change_state",
    "chimera_owner_content_changes",
    "chimera_owner_content_generations",
    "chimera_tier_limits",
    "chimera_user_entitlements",
    "chimera_entitlement_active_choices",
  ])
    result[table] = (
      await db.query(
        `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as value from public.${table} t`,
      )
    ).rows[0].value;
  return result;
}
function repository(user) {
  const calls = { body: 0, tags: 0 },
    role = "authenticated";
  return {
    calls,
    isAdmin: () =>
      asRole(
        role,
        user,
        async () =>
          (await db.query("select public.is_admin() as value")).rows[0].value,
      ),
    resolve: (id) =>
      serial(async () => {
        const rows = (
          await db.query(
            `select ${identityColumns} from public.chimera_lore where id::text=$1 or content_key=$1 limit 2`,
            [id],
          )
        ).rows;
        return rows.length === 1 ? rows[0] : null;
      }),
    firstPartyAliases: (keys) =>
      serial(
        async () =>
          (
            await db.query(
              `select ${identityColumns} from public.chimera_lore where owner_kind='first_party' and content_key=any($1)`,
              [keys],
            )
          ).rows,
      ),
    list: (lane, isAdmin, selectedOwner, p, context) =>
      asRole(role, user, async () => {
        calls.body++;
        if (
          context &&
          ((lane === "first_party" &&
            (context.namespace !== "first_party" ||
              context.kind === "story")) ||
            (lane !== "first_party" && context.id === null))
        )
          return [];
        const values =
          lane === "first_party" ? [isAdmin] : [lane, selectedOwner];
        let sql =
          lane === "first_party"
            ? "select content_key,owner_namespace,release_state,body,created_at,updated_at from public.chimera_content_source_items where content_kind='lore' and owner_namespace='first_party' and ($1 or release_state='published')"
            : `select ${playerColumns} from public.chimera_lore where owner_kind='player' and (case when $1='owner' then owner_user_id=$2::uuid else visibility='public' end)`;
        if (context) {
          assert.ok(["world", "entity", "story"].includes(context.kind));
          values.push(lane === "first_party" ? context.key : context.id);
          sql +=
            lane === "first_party"
              ? ` and body->>'${context.kind}_key'=$${values.length}`
              : ` and ${context.kind}_id=$${values.length}::uuid`;
          if (context.kind === "world")
            sql +=
              lane === "first_party"
                ? " and body->>'entity_key' is null and body->>'story_key' is null"
                : " and entity_id is null and story_id is null";
        }
        values.push(p.offset + p.limit);
        sql += ` order by created_at desc,owner_namespace,content_key limit $${values.length}`;
        return normalize((await db.query(sql, values)).rows);
      }),
    find: (namespace, key, isAdmin, selectedOwner) =>
      asRole(role, user, async () => {
        calls.body++;
        const rows =
          namespace === "first_party"
            ? (
                await db.query(
                  "select content_key,owner_namespace,release_state,body,created_at,updated_at from public.chimera_content_source_items where content_kind='lore' and owner_namespace=$1 and content_key=$2 and ($3 or release_state='published')",
                  [namespace, key, isAdmin],
                )
              ).rows
            : (
                await db.query(
                  `select ${playerColumns} from public.chimera_lore where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')`,
                  [namespace, key, selectedOwner],
                )
              ).rows;
        return normalize(rows)[0] ?? null;
      }),
    tags: (ids) =>
      asRole(role, user, async () => {
        calls.tags++;
        return (
          await db.query(
            "select a.asset_id,jsonb_build_object('id',t.id,'tag_name',t.tag_name) as tag from public.chimera_asset_tags a join public.chimera_tags t on t.id=a.tag_id where a.asset_id=any($1::uuid[]) and a.asset_type='lore_entry' order by a.asset_id,t.id",
            [ids],
          )
        ).rows;
      }),
  };
}
// Context adapters return only the parent identity fields used by the lore boundary,
// with real request-role RLS. Existing parent-reader harnesses cover their body caches.
function parents(user) {
  const find = (kind) => (id) =>
    asRole("authenticated", user, async () => {
      const table = {
        world: "chimera_worlds",
        entity: "chimera_entities",
        story: "chimera_stories",
      }[kind];
      const rows = (
        await db.query(
          `select id,content_key,owner_kind,owner_namespace,owner_user_id,visibility from public.${table} where id::text=$1 or content_key=$1 limit 2`,
          [id],
        )
      ).rows;
      let row = rows.length === 1 ? rows[0] : null;
      if (!row && kind !== "story") {
        const canonical = (
          await db.query(
            "select content_key,owner_namespace from public.chimera_content_source_items where content_kind=$1 and content_key=$2 and owner_namespace='first_party' and (release_state='published' or public.is_admin())",
            [kind, id],
          )
        ).rows[0];
        if (canonical) row = { ...canonical, id: canonical.content_key };
      }
      if (!row)
        throw new ServiceError(404, {
          code: ApiErrorCode.NOT_FOUND,
          message: "Context not found.",
        });
      return row;
    });
  return {
    world: { find: find("world") },
    entity: { find: find("entity") },
    story: { find: find("story") },
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
async function write(user, sql, values) {
  await db.query("set local role authenticated");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role','authenticated')::text,true)",
      [user],
    );
    await db.query(sql, values);
  } finally {
    await db.query("reset role").catch(() => {});
  }
}
async function release(key, state, kind = "lore") {
  await db.query("set local role stonecaster_content_sync_owner");
  try {
    await db.query(
      "update public.chimera_content_source_items set release_state=$1 where content_kind=$2 and content_key=$3",
      [state, kind, key],
    );
  } finally {
    await db.query("reset role").catch(() => {});
  }
}
await db.connect();
try {
  // Read-only actual SDK projections, canonical JSON null filters and transport.
  const live = new LoreContentReadRepository(
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  );
  assert.equal(await live.isAdmin(), false);
  for (const context of [
    null,
    { kind: "world", id: null, key: "mystika", namespace: "first_party" },
    { kind: "entity", id: entity, key: entity, namespace: owner },
    { kind: "story", id: story, key: story, namespace: owner },
  ])
    for (const lane of ["first_party", "public"])
      assert.ok(
        Array.isArray(
          await live.list(
            lane,
            false,
            owner,
            LoreReadQuerySchema.parse({}),
            context,
          ),
        ),
      );
  assert.deepEqual(await live.tags([first]), []);
  assert.equal(await live.resolve(first), null);
  assert.equal(await live.find(owner, prefix, false, other), null);
  await new ContentChangePollerService().page(null, [], "lore-sdk");
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
  const tier = prefix + "-tier";
  await db.query(
    "insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) values($1,4,4)",
    [tier],
  );
  await db.query(
    "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
    [owner, tier],
  );
  for (const [id, user, visibility] of [
    [worldOne, owner, "public"],
    [worldTwo, owner, "private"],
    [worldOther, other, "private"],
  ])
    await write(
      user,
      "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1,$2,'Fixture world',$2,'{\"summary\":\"fixture\"}','player',$3,$4)",
      [id, id, user, visibility],
    );
  for (const [id, user, world] of [
    [entity, owner, null],
    [foreignEntity, other, worldOne],
  ])
    await write(
      user,
      "insert into public.chimera_entities(id,key,slug,display_name,entity_type,raw_data,owner_kind,owner_user_id,visibility,world_id) values($1,$2,$2,'Fixture NPC','NPC','{\"description\":\"fixture\"}','player',$3,'private',$4)",
      [id, id, user, world],
    );
  await db.query("set local role service_role");
  await db.query(
    "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)",
  );
  await db.query("select public.chimera_create_owned_story($1,$2::jsonb)", [
    owner,
    JSON.stringify({
      id: story,
      display_name: "Fixture story",
      world_id: null,
      configuration: { rulesetIds: ["declared-fixture"] },
    }),
  ]);
  await db.query("reset role");
  for (const [id, user, key, world, entity_id, story_id] of [
    [first, owner, prefix, worldOne, null, null],
    [second, other, prefix, worldOne, null, null],
    [entityLore, owner, entityLore, null, entity, null],
    [storyLore, owner, storyLore, null, null, story],
  ])
    await write(
      user,
      "insert into public.chimera_lore(id,content_key,fragment,keywords,owner_kind,owner_user_id,visibility,world_id,entity_id,story_id) values($1,$2,$3::jsonb,$4,'player',$5,'private',$6,$7,$8)",
      [
        id,
        key,
        JSON.stringify({
          display_name: "Fixture lore",
          entry_text: "Private facts",
        }),
        ["fixture"],
        user,
        world,
        entity_id,
        story_id,
      ],
    );
  await write(
    owner,
    "insert into public.chimera_tags(id,tag_name,owner_kind,owner_user_id) values($1,'BEFORE','player',$2)",
    [tagId, owner],
  );
  await write(
    owner,
    "insert into public.chimera_asset_tags(tag_id,asset_id,asset_type,owner_kind,owner_user_id) values($1,$2,'lore_entry','player',$3)",
    [tagId, first, owner],
  );
  await bootstrapLocalContentFleet(
    db,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  );
  const sample = (
    await db.query(
      "select content_key,body from public.chimera_content_source_items where content_kind='lore' order by content_key limit 1",
    )
  ).rows[0];
  assert.ok(sample);
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller),
    ownerRepo = repository(owner),
    otherRepo = repository(other),
    adminRepo = repository(admin);
  const build = (repo, user, cache) =>
    new LoreContentReadService(
      repo,
      parents(user),
      user,
      "lore-fixture",
      cache,
    );
  const mine = build(ownerRepo, owner, one),
    peer = build(ownerRepo, owner, two),
    foreign = build(otherRepo, other, one),
    internal = build(adminRepo, admin, one),
    params = LoreReadQuerySchema.parse({});
  assert.equal((await mine.find(first)).owner_user_id, owner);
  assert.equal((await mine.find(first)).visibility, "private");
  assert.equal((await foreign.find(second)).owner_user_id, other);
  await assert.rejects(foreign.find(first), { statusCode: 404 });
  await assert.rejects(mine.find(prefix), { statusCode: 404 });
  // World ownership does not confer access to someone else's private lore.
  assert.ok(!(await mine.list(params)).some((v) => v.id === second));
  assert.deepEqual(
    (
      await foreign.listContext(
        LoreContextQuerySchema.parse({ world_id: worldOne }),
      )
    ).map((v) => v.id),
    [second],
  );
  assert.deepEqual(
    (
      await mine.listContext(
        LoreContextQuerySchema.parse({
          entity_id: entity,
          world_id: worldOne,
          story_id: story,
        }),
      )
    ).map((v) => v.id),
    [entityLore],
  );
  assert.deepEqual(
    (
      await mine.listContext(
        LoreContextQuerySchema.parse({ story_id: story, world_id: worldOne }),
      )
    ).map((v) => v.id),
    [storyLore],
  );
  await assert.rejects(
    mine.listContext(
      LoreContextQuerySchema.parse({
        entity_id: foreignEntity,
        world_id: worldOne,
      }),
    ),
    { statusCode: 404 },
  );
  await assert.rejects(
    foreign.listContext(LoreContextQuerySchema.parse({ story_id: story })),
    { statusCode: 404 },
  );
  await peer.find(first);
  const bodyHits = ownerRepo.calls.body;
  await mine.find(first);
  assert.equal(ownerRepo.calls.body, bodyHits);
  const sharedHead = (await changePage(null)).shared.head_seq;
  await write(
    owner,
    "update public.chimera_lore set fragment=jsonb_set(fragment,'{entry_text}','\"Updated facts\"') where id=$1",
    [first],
  );
  assert.equal((await changePage(null)).shared.head_seq, sharedHead);
  for (const client of [mine, peer])
    assert.equal((await client.find(first)).entry_text, "Updated facts");
  const beforeTags = ownerRepo.calls.body;
  await write(
    owner,
    "update public.chimera_tags set tag_name='AFTER' where id=$1",
    [tagId],
  );
  for (const client of [mine, peer])
    assert.equal((await client.find(first)).tags[0].tag_name, "AFTER");
  assert.equal(ownerRepo.calls.body, beforeTags);
  await write(
    owner,
    "delete from public.chimera_asset_tags where asset_id=$1",
    [first],
  );
  assert.deepEqual((await mine.find(first)).tags, []);
  assert.equal(ownerRepo.calls.body, beforeTags);
  const context = LoreContextQuerySchema.parse({ world_id: worldOne });
  await mine.listContext(context);
  await peer.listContext(context);
  for (const visibility of ["public", "private", "public"]) {
    await write(
      owner,
      "update public.chimera_lore set visibility=$1 where id=$2",
      [visibility, first],
    );
    for (const client of [mine, peer])
      assert.equal((await client.find(first)).visibility, visibility);
    if (visibility === "public") {
      assert.equal((await foreign.find(first)).entry_text, "Updated facts");
      assert.deepEqual((await foreign.find(first)).tags, []);
    } else await assert.rejects(foreign.find(first), { statusCode: 404 });
  }
  assert.ok((await foreign.listContext(context)).some((v) => v.id === first));
  await write(
    owner,
    "update public.chimera_worlds set visibility='private' where id=$1",
    [worldOne],
  );
  await assert.rejects(foreign.listContext(context), { statusCode: 404 });
  // Public detail follows the lore's own explicit visibility, not inherited world privacy.
  assert.equal((await foreign.find(first)).entry_text, "Updated facts");
  await write(owner, "update public.chimera_lore set world_id=$1 where id=$2", [
    worldTwo,
    first,
  ]);
  for (const client of [mine, peer]) {
    assert.ok(!(await client.listContext(context)).some((v) => v.id === first));
    assert.ok(
      (
        await client.listContext(
          LoreContextQuerySchema.parse({ world_id: worldTwo }),
        )
      ).some((v) => v.id === first),
    );
  }
  assert.equal(
    (await internal.find(sample.content_key)).entry_text,
    sample.body.fragment.entry_text,
  );
  await assert.rejects(foreign.find(sample.content_key), { statusCode: 404 });
  await release(sample.body.world_key, "published", "world");
  await release(sample.content_key, "published");
  assert.equal(
    (await foreign.find(sample.content_key)).world_id,
    sample.body.world_key,
  );
  assert.ok(
    (
      await foreign.listContext(
        LoreContextQuerySchema.parse({ world_id: sample.body.world_key }),
      )
    ).some((v) => v.id === sample.content_key),
  );
  await release(sample.body.world_key, "internal", "world");
  await assert.rejects(
    foreign.listContext(
      LoreContextQuerySchema.parse({ world_id: sample.body.world_key }),
    ),
    { statusCode: 404 },
  );
  await release(sample.content_key, "internal");
  await assert.rejects(foreign.find(sample.content_key), { statusCode: 404 });
  await db.query("update public.profiles set role='member' where id=$1", [
    admin,
  ]);
  await assert.rejects(build(adminRepo, admin, one).find(sample.content_key), {
    statusCode: 404,
  });
  await write(owner, "delete from public.chimera_lore where id=$1", [first]);
  for (const client of [mine, peer])
    await assert.rejects(client.find(first), { statusCode: 404 });
  assert.ok(!(await mine.list(params)).some((v) => v.id === first));
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS actual SDK projections/JSON context filters/poller, real-role lore ownership independent of world ownership/privacy, canonical release/admin revocation, strict context priority and private-entity denial, fresh RLS tags without body reload/private-tag disclosure, two-instance private/public/world-move/delete refresh, parent-context privatization denial, unchanged rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
