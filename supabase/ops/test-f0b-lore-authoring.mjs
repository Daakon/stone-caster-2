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
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422" &&
    !url.search &&
    !url.hash,
);
assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54421");
url.username = "supabase_admin";
Object.assign(process.env, env);
const { LoreContentWriteRepository } =
  await import("../../backend/src/db/repos/lore-content-write.repo.ts");
const { LoreContentWriteService } =
  await import("../../backend/src/services/content/lore-content-write.service.ts");
const { LoreContentReadService } =
  await import("../../backend/src/services/content/lore-content-read.service.ts");
const { LoreCreateSchema, LoreUpdateSchema } =
  await import("../../shared/src/types/chimera-lore-write.ts");
const { ContentCacheService } =
  await import("../../backend/src/services/content/content-cache.service.ts");
const { ContentChangePollerService } =
  await import("../../backend/src/services/content/content-change-poller.service.ts");
const { getChimeraSupabaseClient, getChimeraSupabaseAdminClient } =
  await import("../../backend/src/db/supabase-client.ts");
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
  world = randomUUID(),
  foreignWorld = randomUUID(),
  entity = randomUUID(),
  story = randomUUID(),
  foreignStory = randomUUID(),
  foreignLore = randomUUID(),
  firstPartyLore = randomUUID(),
  orphan = randomUUID(),
  legacyStoryLore = randomUUID(),
  prefix = `lore-write-${randomUUID()}`;
let tail = Promise.resolve(),
  savepoint = 0;
function serial(job) {
  const result = tail.then(job);
  tail = result.catch(() => {});
  return result;
}
// Successful writes stay inside the outer rollback transaction; failed RPCs roll
// back their complete statement, including source, links, entitlement activity/outbox.
function asRole(role, user, job) {
  return serial(async () => {
    const point = `author_${++savepoint}`;
    await db.query(`savepoint ${point}`);
    try {
      await db.query(`set local role ${role}`);
      await db.query(
        "select set_config('request.jwt.claim.sub',coalesce($1::text,''),true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
        [user, role],
      );
      const result = await job();
      await db.query("reset role");
      await db.query(`release savepoint ${point}`);
      return result;
    } catch (error) {
      await db.query(`rollback to savepoint ${point}`);
      await db.query(`release savepoint ${point}`);
      throw error;
    }
  });
}
function writer(user) {
  const repo = new LoreContentWriteRepository({
    rpc: (name, args) => {
      assert.equal(name, "chimera_write_owned_lore");
      return {
        overrideTypes: async () => {
          try {
            return {
              data: await asRole(
                "authenticated",
                user,
                async () =>
                  (
                    await db.query(
                      "select public.chimera_write_owned_lore($1,$2,$3::jsonb) as value",
                      [args.p_action, args.p_id, JSON.stringify(args.p_data)],
                    )
                  ).rows[0].value,
              ),
              error: null,
            };
          } catch (error) {
            return {
              data: null,
              error: { code: error.code, message: error.message },
            };
          }
        },
      };
    },
  });
  return new LoreContentWriteService(repo, user, "lore-write-rollback");
}
const identityColumns =
  "id,content_key,owner_kind,owner_namespace,owner_user_id,visibility";
const playerColumns =
  identityColumns +
  ",release_state,is_official,fragment,keywords,world_id,entity_id,story_id,created_at,updated_at";
const normalize = (row) =>
  row
    ? {
        ...row,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      }
    : null;
function reader(user, cache) {
  const repo = {
    isAdmin: () =>
      asRole(
        "authenticated",
        user,
        async () =>
          (await db.query("select public.is_admin() as value")).rows[0].value,
      ),
    resolve: (id) =>
      asRole("service_role", null, async () => {
        const rows = (
          await db.query(
            `select ${identityColumns} from public.chimera_lore where id::text=$1 or content_key=$1 limit 2`,
            [id],
          )
        ).rows;
        return rows.length === 1 ? rows[0] : null;
      }),
    firstPartyAliases: async () => [],
    list: async () => [],
    find: (namespace, key) =>
      asRole("authenticated", user, async () =>
        normalize(
          (
            await db.query(
              `select ${playerColumns} from public.chimera_lore where owner_kind='player' and owner_namespace=$1 and content_key=$2 and (owner_user_id=$3::uuid or visibility='public')`,
              [namespace, key, user],
            )
          ).rows[0],
        ),
      ),
    tags: (ids) =>
      asRole("authenticated", user, async () =>
        (
          await db.query(
            "select a.asset_id,t.id,t.tag_name from public.chimera_asset_tags a join public.chimera_tags t on t.id=a.tag_id where a.asset_type='lore_entry' and a.asset_id=any($1::uuid[])",
            [ids],
          )
        ).rows.map((r) => ({
          asset_id: r.asset_id,
          tag: { id: r.id, tag_name: r.tag_name },
        })),
      ),
  };
  const unused = {
    find: async () => {
      throw new Error("Detail must not require parent access");
    },
  };
  return new LoreContentReadService(
    repo,
    { world: unused, entity: unused, story: unused },
    user,
    "lore-writer-cache",
    cache,
  );
}
const changePage = (after, owners) =>
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
async function fingerprint() {
  const result = {};
  for (const table of [
    "auth.users",
    "public.profiles",
    ...[
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
      "chimera_compiled_stories",
      "chimera_compiled_content_refs",
      "chimera_content_blobs",
      "chimera_game_states",
    ].map((t) => "public." + t),
  ])
    result[table] = (
      await db.query(
        `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as value from ${table} t`,
      )
    ).rows[0].value;
  return result;
}
async function posture() {
  return (
    await db.query(
      "select c.relname,c.relrowsecurity,c.relacl::text,(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies from pg_class c where c.oid in ('public.chimera_lore'::regclass,'public.chimera_tags'::regclass,'public.chimera_asset_tags'::regclass) order by c.relname",
    )
  ).rows;
}
const create = (data = {}) =>
  LoreCreateSchema.parse({
    world_id: world,
    display_name: "Authored lore",
    entry_text: "Authored facts",
    ...data,
  });
const rawRpc = (user, action, id, data) =>
  asRole("authenticated", user, () =>
    db.query("select public.chimera_write_owned_lore($1,$2,$3::jsonb)", [
      action,
      id,
      JSON.stringify(data),
    ]),
  );
await db.connect();
try {
  for (const client of [
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  ]) {
    const { error } = await client
      .rpc("chimera_write_owned_lore", {
        p_action: "delete",
        p_id: orphan,
        p_data: {},
      })
      .abortSignal(AbortSignal.timeout(2000));
    assert.equal(error?.code, "42501");
  }
  const before = await fingerprint(),
    beforePosture = await posture();
  await db.query("begin");
  const migration = fs
    .readFileSync(
      new URL(
        "../migrations/20261011000000_atomic_lore_authoring.sql",
        import.meta.url,
      ),
      "utf8",
    )
    .trim()
    .replace(/^begin;\s*/i, "")
    .replace(/\s*commit;$/i, "");
  await db.query(migration);
  await db.query(migration);
  assert.deepEqual(await posture(), beforePosture);
  assert.deepEqual(
    (
      await db.query(
        "select prosecdef,has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,has_function_privilege('service_role',oid,'EXECUTE') as service_role from pg_proc where oid='public.chimera_write_owned_lore(text,uuid,jsonb)'::regprocedure",
      )
    ).rows[0],
    { prosecdef: false, anon: false, authenticated: true, service_role: false },
  );
  assert.deepEqual(
    (
      await db.query(
        "select rolcanlogin,rolinherit,rolbypassrls,rolsuper from pg_roles where rolname='stonecaster_lore_parent_guard'",
      )
    ).rows[0],
    {
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: false,
      rolsuper: false,
    },
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from pg_auth_members m where m.roleid='stonecaster_lore_parent_guard'::regrole or m.member='stonecaster_lore_parent_guard'::regrole",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select has_schema_privilege('stonecaster_lore_parent_guard','public','CREATE') as value",
      )
    ).rows[0].value,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_column_privilege('stonecaster_lore_parent_guard','public.chimera_stories','configuration','SELECT') as value",
      )
    ).rows[0].value,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','public.chimera_guard_lore_story_owner()','EXECUTE') as value",
      )
    ).rows[0].value,
    false,
  );
  await assert.rejects(
    asRole("stonecaster_lore_parent_guard", null, () =>
      db.query("select configuration from public.chimera_stories limit 1"),
    ),
    { code: "42501" },
  );
  for (const user of [owner, other, admin])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
      [user, user + "@example.test"],
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
  for (const user of [owner, other])
    await db.query(
      "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
      [user, tier],
    );
  for (const [id, user] of [
    [world, owner],
    [foreignWorld, other],
  ])
    await asRole("authenticated", user, () =>
      db.query(
        "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind,owner_user_id,visibility) values($1::uuid,$1::text,'Fixture world',$1::text,'{\"summary\":\"fixture\"}','player',$2,'public')",
        [id, user],
      ),
    );
  await asRole("authenticated", owner, () =>
    db.query(
      "insert into public.chimera_entities(id,key,slug,display_name,entity_type,raw_data,owner_kind,owner_user_id) values($1::uuid,$1::text,$1::text,'Fixture entity','NPC','{\"description\":\"fixture\"}','player',$2)",
      [entity, owner],
    ),
  );
  for (const [id, user] of [
    [story, owner],
    [foreignStory, other],
  ])
    await asRole("service_role", null, () =>
      db.query("select public.chimera_create_owned_story($1,$2::jsonb)", [
        user,
        JSON.stringify({
          id,
          display_name: "Fixture story",
          configuration: { rulesetIds: ["fixture"] },
        }),
      ]),
    );
  await asRole("authenticated", other, () =>
    db.query(
      "insert into public.chimera_lore(id,world_id,fragment,owner_kind,owner_user_id) values($1,$2,'{\"entry_text\":\"Foreign private facts\"}','player',$3)",
      [foreignLore, world, other],
    ),
  );
  await asRole("authenticated", owner, () =>
    db.query(
      "insert into public.chimera_lore(id,fragment,owner_kind,owner_user_id) values($1,'{\"entry_text\":\"Orphaned owned facts\"}','player',$2)",
      [orphan, owner],
    ),
  );
  // Canonical sync intentionally has no legacy-table writes. Prepare one UUID
  // alias with transient setup-only INSERT rights, then restore the real posture
  // before every writer assertion. No application role receives extra access.
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('stonecaster_content_sync_owner','public.chimera_lore','INSERT') as value",
      )
    ).rows[0].value,
    false,
  );
  await db.query(
    "grant insert on public.chimera_lore to stonecaster_content_sync_owner",
  );
  await db.query(
    "create policy lore_writer_fixture_setup on public.chimera_lore for insert to stonecaster_content_sync_owner with check(owner_kind='first_party')",
  );
  await asRole("stonecaster_content_sync_owner", null, () =>
    db.query(
      "insert into public.chimera_lore(id,fragment,owner_kind) values($1,'{\"entry_text\":\"First-party fixture\"}','first_party')",
      [firstPartyLore],
    ),
  );
  await db.query(
    "drop policy lore_writer_fixture_setup on public.chimera_lore",
  );
  await db.query(
    "revoke insert on public.chimera_lore from stonecaster_content_sync_owner",
  );
  assert.deepEqual(await posture(), beforePosture);
  const mine = writer(owner),
    theirs = writer(other),
    preview = writer(admin);
  const beforeForeignParent = await fingerprint();
  await assert.rejects(
    asRole("authenticated", owner, () =>
      db.query(
        "insert into public.chimera_lore(fragment,story_id,owner_kind,owner_user_id) values('{\"entry_text\":\"Foreign parent bypass\"}',$1,'player',$2)",
        [foreignStory, owner],
      ),
    ),
    { code: "P0002" },
  );
  assert.deepEqual(await fingerprint(), beforeForeignParent);
  // Privileged setup models a legacy malformed reference. Actual RPC and direct
  // authenticated edits must both refuse it before touching its foreign story.
  await db.query(
    "select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true)",
  );
  await db.query(
    "insert into public.chimera_lore(id,fragment,story_id,owner_kind,owner_user_id) values($1,'{\"entry_text\":\"Legacy foreign parent\"}',$2,'player',$3)",
    [legacyStoryLore, foreignStory, owner],
  );
  const beforeLegacyDenial = await fingerprint();
  await assert.rejects(
    mine.update(legacyStoryLore, { entry_text: "Unauthorized" }),
    { statusCode: 404 },
  );
  await assert.rejects(mine.delete(legacyStoryLore), { statusCode: 404 });
  await assert.rejects(
    asRole("authenticated", owner, () =>
      db.query(
        'update public.chimera_lore set fragment=\'{"entry_text":"Unauthorized"}\' where id=$1',
        [legacyStoryLore],
      ),
    ),
    { code: "P0002" },
  );
  await assert.rejects(
    asRole("authenticated", owner, () =>
      db.query("delete from public.chimera_lore where id=$1", [
        legacyStoryLore,
      ]),
    ),
    { code: "P0002" },
  );
  assert.deepEqual(await fingerprint(), beforeLegacyDenial);
  const owned = await mine.create(
    create({ tag_names: [prefix + " tag", prefix + " TAG", " shared tag "] }),
  );
  assert.equal(owned.type, null);
  assert.ok(!("type" in owned.fragment));
  assert.equal(owned.visibility, "private");
  assert.equal(owned.embedding, null);
  assert.equal(owned.tags.length, 2);
  const foreignSameTag = await theirs.create(
    create({ world_id: foreignWorld, tag_names: ["SHARED TAG"] }),
  );
  assert.equal(foreignSameTag.tags[0].tag_name, "SHARED_TAG");
  assert.notEqual(
    foreignSameTag.tags[0].id,
    owned.tags.find((t) => t.tag_name === "SHARED_TAG").id,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_tags where tag_name='SHARED_TAG' and owner_user_id=any($1::uuid[])",
        [[owner, other]],
      )
    ).rows[0].n,
    2,
  );
  assert.ok(
    (
      await db.query(
        "select bool_and(not is_approved) as value from public.chimera_tags where owner_user_id=any($1::uuid[])",
        [[owner, other]],
      )
    ).rows[0].value,
  );
  const entityLore = await mine.create(
    create({
      entity_id: entity,
      story_id: foreignStory,
      world_id: foreignWorld,
    }),
  );
  assert.equal(entityLore.entity_id, entity);
  assert.equal(entityLore.world_id, null);
  assert.equal(entityLore.story_id, null);
  const storyLore = await mine.create(
    create({ story_id: story, world_id: foreignWorld }),
  );
  assert.equal(storyLore.story_id, story);
  assert.equal(storyLore.world_id, null);
  assert.equal(storyLore.entity_id, null);
  await assert.rejects(mine.create(create({ world_id: foreignWorld })), {
    statusCode: 404,
  });
  for (const user of [mine, preview]) {
    await assert.rejects(
      user.update(foreignLore, { entry_text: "Unauthorized" }),
      { statusCode: 404 },
    );
    await assert.rejects(user.delete(foreignLore), { statusCode: 404 });
    await assert.rejects(
      user.update(firstPartyLore, { entry_text: "Unauthorized" }),
      { statusCode: 404 },
    );
    await assert.rejects(user.delete(firstPartyLore), { statusCode: 404 });
  }
  assert.equal(
    (
      await theirs.update(foreignLore, {
        entry_text: "Owner edits without world ownership",
      })
    ).entry_text,
    "Owner edits without world ownership",
  );
  assert.equal(
    (await mine.update(orphan, { entry_text: "Owned orphan updated" }))
      .world_id,
    null,
  );
  await mine.delete(orphan);
  const invalid = [
    ["create", null, { ...create(), owner_user_id: other }],
    ["create", null, { ...create(), visibility: "public" }],
    ["create", null, { display_name: "Name", entry_text: "Facts" }],
    ["update", owned.id, {}],
    ["update", owned.id, { world_id: foreignWorld }],
    ["update", owned.id, { entry_text: null }],
    ["update", owned.id, { tag_names: ["un-normalized"] }],
    ["update", owned.id, { keywords: [42] }],
    [
      "update",
      owned.id,
      { tag_names: Array.from({ length: 101 }, () => "TAG") },
    ],
    ["delete", owned.id, { entry_text: "Unauthorized field" }],
    ["other", owned.id, {}],
  ];
  for (const args of invalid)
    await assert.rejects(rawRpc(owner, ...args), { code: "22023" });
  await assert.rejects(rawRpc(null, "delete", owned.id, {}), { code: "42501" });
  const poller = new ContentChangePollerService({ page: changePage }),
    one = new ContentCacheService(poller),
    two = new ContentCacheService(poller);
  const readMine = reader(owner, one),
    readPeer = reader(owner, two),
    readOther = reader(other, two);
  await readMine.find(owned.id);
  await readPeer.find(owned.id);
  const sharedHead = async () =>
    (
      await db.query(
        "select head_seq::text from public.chimera_content_change_state where singleton",
      )
    ).rows[0].head_seq;
  const head = await sharedHead();
  await asRole("authenticated", owner, () =>
    db.query(
      'update public.chimera_lore set fragment=fragment||\'{"future_field":{"authored":true}}\'::jsonb where id=$1',
      [owned.id],
    ),
  );
  await mine.update(
    owned.id,
    LoreUpdateSchema.parse({ display_name: "Renamed", keywords: ["fact"] }),
  );
  const changed = await mine.update(owned.id, {
    entry_text: "Changed facts",
    tag_names: ["replacement"],
  });
  assert.deepEqual(changed.fragment.future_field, { authored: true });
  assert.equal(changed.display_name, "Renamed");
  assert.deepEqual(changed.keywords, ["fact"]);
  assert.deepEqual(
    changed.tags.map((t) => t.tag_name),
    ["REPLACEMENT"],
  );
  assert.equal(await sharedHead(), head);
  for (const service of [readMine, readPeer]) {
    const item = await service.find(owned.id);
    assert.equal(item.entry_text, "Changed facts");
    assert.deepEqual(
      item.tags.map((t) => t.tag_name),
      ["REPLACEMENT"],
    );
  }
  // Inject failure after source mutation and link deletion. The failed statement
  // must restore both the authored row and relations/outbox, not swallow the error.
  await db.query(
    "create function pg_temp.fail_lore_tag() returns trigger language plpgsql as $$ begin if new.asset_type='lore_entry' then raise exception 'fixture injected failure'; end if; return new; end $$",
  );
  await db.query(
    "create trigger lore_write_fixture_failure before insert on public.chimera_asset_tags for each row execute function pg_temp.fail_lore_tag()",
  );
  const beforeFailure = await fingerprint();
  await assert.rejects(
    mine.update(owned.id, {
      entry_text: "Must roll back",
      tag_names: ["failure"],
    }),
    { statusCode: 503 },
  );
  assert.deepEqual(await fingerprint(), beforeFailure);
  await assert.rejects(mine.create(create({ tag_names: ["failure"] })), {
    statusCode: 503,
  });
  assert.deepEqual(await fingerprint(), beforeFailure);
  await db.query(
    "drop trigger lore_write_fixture_failure on public.chimera_asset_tags",
  );
  await mine.update(owned.id, { tag_names: [] });
  assert.deepEqual((await readPeer.find(owned.id)).tags, []);
  await asRole("authenticated", owner, () =>
    db.query("update public.chimera_lore set visibility='public' where id=$1", [
      owned.id,
    ]),
  );
  assert.equal((await readOther.find(owned.id)).entry_text, "Changed facts");
  await mine.update(owned.id, { entry_text: "Public edited in place" });
  assert.equal(
    (await readOther.find(owned.id)).entry_text,
    "Public edited in place",
  );
  await mine.update(storyLore.id, {
    entry_text: "Writable story lore",
    tag_names: ["story tag"],
  });
  await db.query(
    "update public.chimera_tier_limits set max_owned_stories=0 where tier_key=$1",
    [tier],
  );
  const beforeTierFailure = await fingerprint();
  for (const action of [
    () => mine.create(create({ story_id: story })),
    () => mine.update(storyLore.id, { tag_names: [] }),
    () => mine.delete(storyLore.id),
  ])
    await assert.rejects(action(), { statusCode: 403 });
  assert.deepEqual(await fingerprint(), beforeTierFailure);
  await db.query(
    "update public.chimera_tier_limits set max_owned_stories=4 where tier_key=$1",
    [tier],
  );
  // The guarded parent deletion remains usable even when its child was read-only.
  await db.query(
    "update public.chimera_tier_limits set max_owned_stories=0 where tier_key=$1",
    [tier],
  );
  await asRole("authenticated", owner, () =>
    db.query("delete from public.chimera_stories where id=$1", [story]),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_lore where id=$1",
        [storyLore.id],
      )
    ).rows[0].n,
    0,
  );
  // Polymorphic tag links have no asset FK; direct parent cascades remain a
  // separate cleanup audit. Explicit writer deletion cleans its owned links.
  await db.query(
    "update public.chimera_tier_limits set max_owned_stories=4 where tier_key=$1",
    [tier],
  );
  await mine.update(entityLore.id, { tag_names: ["entity tag"] });
  await mine.delete(entityLore.id);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_asset_tags where asset_id=$1 and asset_type='lore_entry'",
        [entityLore.id],
      )
    ).rows[0].n,
    0,
  );
  await mine.delete(owned.id);
  for (const service of [readMine, readPeer, readOther])
    await assert.rejects(service.find(owned.id), { statusCode: 404 });
  await theirs.delete(foreignLore);
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  assert.deepEqual(await posture(), beforePosture);
  console.log(
    "PASS SDK anonymous/service-role denial, idempotent invoker/application-grant posture and metadata-only guard owner, direct DB foreign-story denial and legitimate cascades, real-role production writer, lore-owner isolation independent of world, first-party/admin denial, nullable specific contexts and priority, owner-scoped same-name tags, strict SQL fields/bounds, fragment patch preservation, injected source/tag/create rollback, story tier rejection and delete cleanup, two-instance private/public/delete cache refresh and private shared-head non-interference, unchanged rollback fingerprints",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
