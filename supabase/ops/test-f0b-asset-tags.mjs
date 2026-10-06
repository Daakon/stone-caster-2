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
const { AssetTagWriteRepository } =
  await import("../../backend/src/db/repos/asset-tag-write.repo.ts");
const { AssetTagWriteService } =
  await import("../../backend/src/services/content/asset-tag-write.service.ts");
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
// The world and entity deliberately share a UUID: polymorphic link identities
// and deletes must include the asset type, not just the asset UUID.
const owner = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  world = randomUUID(),
  foreignWorld = randomUUID(),
  entity = world,
  firstParty = randomUUID();
let counter = 0;
// Sequential real-role adapter: successful writes remain in the outer rollback
// transaction; a failed SQL statement rolls back every tag/link/outbox change.
async function asRole(role, user, job) {
  const point = `tags_${++counter}`;
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
}
const raw = (user, type, id, names) =>
  asRole("authenticated", user, () =>
    db.query(
      "select public.chimera_replace_owned_asset_tags($1,$2,$3::jsonb) as value",
      [type, id, JSON.stringify(names)],
    ),
  );
function writer(user) {
  const repo = new AssetTagWriteRepository({
    rpc: (name, args) => {
      assert.equal(name, "chimera_replace_owned_asset_tags");
      return {
        overrideTypes: async () => {
          try {
            return {
              data: (
                await raw(
                  user,
                  args.p_asset_type,
                  args.p_asset_id,
                  args.p_tag_names,
                )
              ).rows[0].value,
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
  return new AssetTagWriteService(repo, user, "asset-tag-rollback");
}
async function fingerprint() {
  const result = {};
  for (const table of [
    "auth.users",
    ...[
      "profiles",
      "chimera_content_catalog_state",
      "chimera_content_source_items",
      "chimera_content_deploy_log",
      "chimera_tags",
      "chimera_asset_tags",
      "chimera_worlds",
      "chimera_entities",
      "chimera_lore",
      "chimera_stories",
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
      "select c.relname,c.relrowsecurity,c.relacl::text,(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies from pg_class c where c.oid in ('public.chimera_worlds'::regclass,'public.chimera_entities'::regclass,'public.chimera_tags'::regclass,'public.chimera_asset_tags'::regclass) order by c.relname",
    )
  ).rows;
}
await db.connect();
try {
  // Actual PostgREST transport proves role denial. Positive fixture calls below
  // use the production repository/service with a SQL adapter, not fixture HTTP.
  for (const client of [
    getChimeraSupabaseClient(),
    getChimeraSupabaseAdminClient(),
  ]) {
    const { error } = await client
      .rpc("chimera_replace_owned_asset_tags", {
        p_asset_type: "world",
        p_asset_id: world,
        p_tag_names: [],
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
        "../migrations/20261012000000_owned_asset_tags.sql",
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
        "select prosecdef,has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,has_function_privilege('service_role',oid,'EXECUTE') as service_role from pg_proc where oid='public.chimera_replace_owned_asset_tags(text,uuid,jsonb)'::regprocedure",
      )
    ).rows[0],
    { prosecdef: false, anon: false, authenticated: true, service_role: false },
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
  // Setup-only sync-owner rights model a legacy first-party UUID alias, then are
  // fully removed before any application assertion; no app grants are widened.
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('stonecaster_content_sync_owner','public.chimera_worlds','INSERT') as value",
      )
    ).rows[0].value,
    false,
  );
  await db.query(
    "grant insert on public.chimera_worlds to stonecaster_content_sync_owner",
  );
  await db.query(
    "create policy asset_tag_fixture_setup on public.chimera_worlds for insert to stonecaster_content_sync_owner with check(owner_kind='first_party')",
  );
  await asRole("stonecaster_content_sync_owner", null, () =>
    db.query(
      "insert into public.chimera_worlds(id,key,name,slug,definition,owner_kind) values($1::uuid,$1::text,'Fixture source',$1::text,'{\"summary\":\"fixture\"}','first_party')",
      [firstParty],
    ),
  );
  await db.query(
    "drop policy asset_tag_fixture_setup on public.chimera_worlds",
  );
  await db.query(
    "revoke insert on public.chimera_worlds from stonecaster_content_sync_owner",
  );
  assert.deepEqual(await posture(), beforePosture);
  const mine = writer(owner),
    theirs = writer(other),
    preview = writer(admin);
  const sharedBefore = (
    await db.query(
      "select to_jsonb(s) as value from public.chimera_content_change_state s",
    )
  ).rows;
  const ownTags = await mine.replace("world", world, [
    " same name ",
    "SAME_NAME",
    "EARTH",
  ]);
  assert.deepEqual(
    ownTags.map((t) => t.tag_name),
    ["EARTH", "SAME_NAME"],
  );
  const foreignTags = await theirs.replace("world", foreignWorld, [
    "same name",
  ]);
  assert.notEqual(
    ownTags.find((t) => t.tag_name === "SAME_NAME").id,
    foreignTags[0].id,
  );
  for (const tag of [...ownTags, ...foreignTags]) {
    const row = (
      await db.query(
        "select content_key,owner_namespace,is_approved from public.chimera_tags where id=$1",
        [tag.id],
      )
    ).rows[0];
    assert.match(row.content_key, /^[a-f0-9-]{36}$/);
    assert.equal(row.is_approved, false);
    assert.equal(
      row.owner_namespace,
      foreignTags.includes(tag) ? other : owner,
    );
  }
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(s) as value from public.chimera_content_change_state s",
      )
    ).rows,
    sharedBefore,
  );
  assert.ok(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_owner_content_changes where user_id=$1 and kind in ('tag','asset_tag')",
        [owner],
      )
    ).rows[0].n > 0,
  );
  const ownSame = ownTags.find((t) => t.tag_name === "SAME_NAME");
  await asRole("authenticated", owner, () =>
    db.query("update public.chimera_tags set is_approved=true where id=$1", [
      ownSame.id,
    ]),
  );
  assert.equal(
    (await mine.replace("entity_template", entity, ["SAME_NAME"]))[0].id,
    ownSame.id,
  );
  assert.equal(
    (
      await db.query(
        "select is_approved from public.chimera_tags where id=$1",
        [ownSame.id],
      )
    ).rows[0].is_approved,
    true,
  );
  // A renamed legacy tag can retain a name-derived stable key. A new tag with
  // that former name must use a UUID key rather than collide or adopt the old tag.
  await asRole("authenticated", owner, () =>
    db.query(
      "insert into public.chimera_tags(tag_name,content_key,owner_kind,owner_user_id) values('RENAMED_LEGACY','LEGACY_NAME','player',$1)",
      [owner],
    ),
  );
  const legacyName = (await mine.replace("world", world, ["LEGACY_NAME"]))[0];
  assert.notEqual(
    (
      await db.query(
        "select content_key from public.chimera_tags where id=$1",
        [legacyName.id],
      )
    ).rows[0].content_key,
    "LEGACY_NAME",
  );
  // A second reader of this uncached write boundary sees current owned identities.
  assert.equal(
    (await writer(owner).replace("world", world, ["SAME_NAME"]))[0].id,
    ownSame.id,
  );
  const denialFingerprint = await fingerprint();
  for (const [service, type, id] of [
    [mine, "world", foreignWorld],
    [preview, "world", world],
    [mine, "world", firstParty],
    [preview, "world", firstParty],
    [mine, "entity_template", foreignWorld],
    [mine, "world", randomUUID()],
  ])
    await assert.rejects(service.replace(type, id, ["SPOOF"]), {
      statusCode: 404,
    });
  assert.deepEqual(await fingerprint(), denialFingerprint);
  for (const [type, id, names] of [
    ["lore_entry", world, []],
    [null, world, []],
    ["world", null, []],
    ["world", world, null],
    ["world", world, {}],
    ["world", world, [null]],
    ["world", world, [1]],
    ["world", world, ["lower"]],
    ["world", world, [""]],
    ["world", world, ["A".repeat(161)]],
    ["world", world, Array.from({ length: 101 }, () => "A")],
  ])
    await assert.rejects(raw(owner, type, id, names), { code: "22023" });
  await assert.rejects(raw(null, "world", world, []), { code: "42501" });
  assert.deepEqual(await fingerprint(), denialFingerprint);
  // Inject a failure after link deletion and tag creation; both mutations and
  // their durable events must roll back as one statement, with safe 503 mapping.
  await db.query(
    "create function pg_temp.reject_asset_tag() returns trigger language plpgsql as $$ begin raise exception 'injected secret tag failure'; end $$",
  );
  await db.query(
    "create trigger asset_tag_fault before insert on public.chimera_asset_tags for each row execute function pg_temp.reject_asset_tag()",
  );
  const faultBefore = await fingerprint();
  await assert.rejects(mine.replace("world", world, ["NEW_NAME"]), {
    statusCode: 503,
  });
  assert.deepEqual(await fingerprint(), faultBefore);
  await db.query("drop trigger asset_tag_fault on public.chimera_asset_tags");
  // An unrelated owner-created legacy link is never removed by replacement.
  await asRole("authenticated", other, () =>
    db.query(
      "insert into public.chimera_asset_tags(tag_id,asset_id,asset_type,owner_kind,owner_user_id,content_key) values($1,$2,'world','player',$3,$4)",
      [foreignTags[0].id, world, other, randomUUID()],
    ),
  );
  const foreignLink = (
    await db.query(
      "select to_jsonb(t) as value from public.chimera_asset_tags t where owner_user_id=$1",
      [other],
    )
  ).rows;
  assert.deepEqual(await mine.replace("world", world, []), []);
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(t) as value from public.chimera_asset_tags t where owner_user_id=$1",
        [other],
      )
    ).rows,
    foreignLink,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_asset_tags where asset_id=$1 and asset_type='world' and owner_user_id=$2",
        [world, owner],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.chimera_asset_tags where asset_id=$1 and asset_type='entity_template' and owner_user_id=$2",
        [entity, owner],
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(await posture(), beforePosture);
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "Owned asset tags: RLS namespaces, asset ownership/admin/first-party denial, approval preservation, private events, strict bounds, empty replacement, injected rollback, unchanged grants and complete fixture rollback passed.",
  );
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
  configService.destroy();
}
