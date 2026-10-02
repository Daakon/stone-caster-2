import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const { Client } = require("pg");
const env = dotenv.parse(
  fs.readFileSync(new URL("../../.env.stonecaster-local", import.meta.url)),
);
const url = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Loopback database required");
const db = new Client({ connectionString: url.toString() });
const user = "00000000-0000-4000-8000-00000000b001";
const admin = "00000000-0000-4000-8000-00000000a001";
const tier = `f0b-${randomUUID()}`;
async function identity(id) {
  await db.query("set local role authenticated");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,true)",
    [id],
  );
}
async function denied(sql, args, message) {
  await db.query("savepoint denial");
  let error;
  try {
    await db.query(sql, args);
  } catch (caught) {
    error = caught;
  }
  await db.query("rollback to savepoint denial");
  assert.ok(error, "operation unexpectedly succeeded");
  if (message) assert.match(error.message, message);
  else assert.equal(error.code, "42501");
}
await db.connect();
await db.query("begin");
try {
  const repairedUser = randomUUID(),
    signupUser = randomUUID();
  await db.query("delete from public.chimera_entitlement_config");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
    [repairedUser, `${repairedUser}@example.test`],
  );
  await identity(repairedUser);
  assert.deepEqual(
    (await db.query("select public.chimera_entitlements_active() as value"))
      .rows[0].value,
    { state: "configuration_pending" },
  );
  await identity(admin);
  await db.query("select public.chimera_admin_set_tier($1,2,2,true)", [tier]);
  await db.query("reset role");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
    [signupUser, `${signupUser}@example.test`],
  );
  assert.equal(
    (
      await db.query(
        "select tier_key from public.chimera_user_entitlements where user_id=$1",
        [signupUser],
      )
    ).rows[0].tier_key,
    tier,
  );
  await identity(repairedUser);
  assert.equal(
    (await db.query("select public.chimera_entitlements_active() as value"))
      .rows[0].value.tier_key,
    tier,
  );
  await identity(admin);
  await db.query("select public.chimera_admin_assign_tier($1,$2)", [
    user,
    tier,
  ]);
  await identity(user);
  const active = (
    await db.query("select public.chimera_entitlements_active() as value")
  ).rows[0].value;
  assert.equal(active.tier_key, tier);
  assert.equal(active.limits.max_owned_stories, 2);
  assert.equal(active.limits.max_saved_games, 2);
  await denied(
    "insert into public.chimera_stories(display_name,owner_user_id) values ('direct',$1)",
    [user],
  );
  await denied(
    "select public.chimera_admin_set_tier($1,9,9,false)",
    [tier],
    /admin/i,
  );
  await denied(
    "select public.chimera_admin_assign_tier($1,$2)",
    [admin, tier],
    /admin/i,
  );
  await denied(
    "select public.chimera_set_active_choices($1::uuid[],'{}'::uuid[])",
    [[randomUUID()]],
    /CHOICES_NOT_OWNED/,
  );
  await identity(admin);
  await db.query("select public.chimera_admin_set_tier($1,50,50,false)", [
    tier,
  ]);
  await db.query("reset role");
  const owned = [];
  for (let i = 0; i < 3; i++) {
    const id = randomUUID();
    owned.push(id);
    await db.query(
      "insert into public.chimera_stories(id,display_name,owner_user_id,created_at,last_edited_at) values ($1,$2,$3,$4,$4)",
      [id, `F0b fixture ${i}`, user, new Date(Date.now() - (3 - i) * 1000)],
    );
  }
  const lore = randomUUID();
  await db.query(
    'insert into public.chimera_lore(id,story_id,owner_user_id,fragment) values($1,$2,$3,\'{"text":"fixture"}\')',
    [lore, owned[2], user],
  );
  await identity(admin);
  await db.query("select public.chimera_admin_set_tier($1,2,2,false)", [tier]);
  await identity(user);
  const ranked = (
    await db.query("select public.chimera_entitlements_active() as value")
  ).rows[0].value;
  assert.deepEqual(ranked.writable_story_ids, [owned[2], owned[1]]);
  await db.query(
    "select public.chimera_set_active_choices($1::uuid[],'{}'::uuid[])",
    [[owned[0], owned[2]]],
  );
  const chosen = (
    await db.query("select public.chimera_entitlements_active() as value")
  ).rows[0].value;
  assert.deepEqual(chosen.writable_story_ids, [owned[0], owned[2]]);
  await denied(
    "select public.chimera_set_active_choices($1::uuid[],'{}'::uuid[])",
    [[...owned]],
    /CHOICES_EXCEED_TIER_LIMIT/,
  );
  await denied(
    "select public.chimera_set_active_choices($1::uuid[],'{}'::uuid[])",
    [[owned[0], owned[0]]],
    /CHOICES_INVALID/,
  );
  await identity(admin);
  await db.query("select public.chimera_admin_set_tier($1,1,1,false)", [tier]);
  await identity(user);
  const smaller = (
    await db.query("select public.chimera_entitlements_active() as value")
  ).rows[0].value;
  assert.deepEqual(smaller.writable_story_ids, [owned[0]]);
  await denied(
    "update public.chimera_stories set display_name='readonly' where id=$1",
    [owned[2]],
    /STORY_READ_ONLY_TIER_LIMIT/,
  );
  await db.query("reset role");
  await denied(
    'update public.chimera_lore set fragment=\'{"text":"readonly"}\' where id=$1',
    [lore],
    /STORY_READ_ONLY_TIER_LIMIT/,
  );
  await denied(
    "delete from public.chimera_lore where id=$1",
    [lore],
    /STORY_READ_ONLY_TIER_LIMIT/,
  );
  await identity(user);
  await db.query("delete from public.chimera_stories where id=$1", [owned[0]]);
  const reopened = (
    await db.query("select public.chimera_entitlements_active() as value")
  ).rows[0].value;
  assert.deepEqual(reopened.writable_story_ids, [owned[2]]);
  await db.query("reset role");
  await db.query("set local role service_role");
  await db.query(
    "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}',true)",
  );
  await denied(
    "select public.chimera_create_owned_story($1,$2::jsonb)",
    [user, JSON.stringify({ display_name: "over cap" })],
    /STORY_LIMIT_REACHED/,
  );
  await denied("select public.chimera_admin_set_tier($1,9,9,false)", [tier]);
  await denied("insert into public.chimera_game_states(player_id) values($1)", [
    user,
  ]);
  await db.query(
    "select set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true)",
  );
  await denied(
    "select public.chimera_create_owned_story($1,$2::jsonb)",
    [user, JSON.stringify({ display_name: "missing actor role" })],
    /backend creation required/,
  );
  console.log(
    "PASS entitlement configuration, owner access, direct-insert denial, ranking, full-set choices, downgrade, read-only edit, delete reactivation, and capped backend creation",
  );
} finally {
  await db.query("rollback");
  await db.end();
}

// Independent connections race two inserts for the same account. These fixtures
// are committed so both sessions can see them, and only their exact IDs are removed.
const fixtureUser = randomUUID();
const fixtureCharacter = randomUUID();
const fixtureCompiles = [randomUUID(), randomUUID()];
let originalCompile;
const setup = new Client({ connectionString: url.toString() });
const workers = [
  new Client({ connectionString: url.toString() }),
  new Client({ connectionString: url.toString() }),
];
await setup.connect();
try {
  await setup.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
    [fixtureUser, `f0b-${fixtureUser}@example.test`],
  );
  await setup.query(
    "insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) values($1,1,1)",
    [tier],
  );
  await setup.query(
    "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
    [fixtureUser, tier],
  );
  await setup.query(
    "insert into public.chimera_prelaunch_testers(user_id) values($1)",
    [fixtureUser],
  );
  await setup.query(
    "insert into public.chimera_player_characters(id,user_id,name) values($1,$2,'F0b cap fixture')",
    [fixtureCharacter, fixtureUser],
  );
  const { rows: source } = await setup.query(
    "select content_kind,owner_namespace,content_key,content_hash from public.chimera_content_source_items where content_kind='world' order by content_key limit 1",
  );
  assert.equal(
    source.length,
    1,
    "Run content sync before the local acceptance test",
  );
  const generation = (
    await setup.query(
      "select generation from public.chimera_content_catalog_state where singleton",
    )
  ).rows[0].generation;
  await setup.query("begin");
  await setup.query("set local role authenticated");
  await setup.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,true)",
    [admin],
  );
  const refs = [
    {
      role: "world",
      kind: source[0].content_kind,
      owner_namespace: source[0].owner_namespace,
      key: source[0].content_key,
      sha256: source[0].content_hash,
    },
  ];
  const compile = (
    await setup.query(
      "select public.publish_frozen_chimera_compile($1,null,'F0b cap fixture',$2::jsonb,$3::jsonb) as id",
      [
        generation,
        JSON.stringify(refs),
        JSON.stringify({
          test_fixture: "F0b caps",
          snapshot_entities: [],
          snapshot_world: {},
          config_engine: {},
        }),
      ],
    )
  ).rows[0].id;
  originalCompile = compile;
  await setup.query("commit");
  for (const id of fixtureCompiles) {
    await setup.query(
      "insert into public.chimera_compiled_stories(id,payload_blob_hash,frozen_owner_user_id,frozen_title,source_manifest) select $1,payload_blob_hash,$2,'F0b cap fixture',source_manifest from public.chimera_compiled_stories where id=$3",
      [id, fixtureUser, compile],
    );
  }
  await setup.query("delete from public.chimera_compiled_stories where id=$1", [
    compile,
  ]);
  await Promise.all(
    workers.map(async (worker) => {
      await worker.connect();
      await worker.query("set role service_role");
      await worker.query(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)",
      );
    }),
  );
  const storyRace = await Promise.allSettled(
    workers.map((worker, index) =>
      worker.query("select public.chimera_create_owned_story($1,$2::jsonb)", [
        fixtureUser,
        JSON.stringify({
          display_name: `F0b concurrent story ${index}`,
          owner_kind: "first_party",
          owner_namespace: "first_party",
          owner_user_id: admin,
        }),
      ]),
    ),
  );
  assert.equal(
    storyRace.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    storyRace.find((result) => result.status === "rejected").reason.message,
    /STORY_LIMIT_REACHED/,
  );
  assert.equal(
    (
      await setup.query(
        "select count(*)::integer as count from public.chimera_stories where owner_user_id=$1",
        [fixtureUser],
      )
    ).rows[0].count,
    1,
  );
  const createdStory = (
    await setup.query(
      "select owner_kind,owner_namespace,owner_user_id from public.chimera_stories where owner_user_id=$1",
      [fixtureUser],
    )
  ).rows[0];
  assert.deepEqual(createdStory, {
    owner_kind: "player",
    owner_namespace: fixtureUser,
    owner_user_id: fixtureUser,
  });
  const gameRace = await Promise.allSettled(
    workers.map((worker, index) =>
      worker.query(
        "select public.chimera_create_pinned_game($1,$2,$3,'{}'::jsonb)",
        [fixtureUser, fixtureCompiles[index], fixtureCharacter],
      ),
    ),
  );
  assert.equal(
    gameRace.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    gameRace.find((result) => result.status === "rejected").reason.message,
    /GAME_LIMIT_REACHED/,
  );
  assert.equal(
    (
      await setup.query(
        "select count(*)::integer as count from public.chimera_game_states where player_id=$1",
        [fixtureUser],
      )
    ).rows[0].count,
    1,
  );
  console.log(
    "PASS concurrent story and pinned-game creation across two backend connections: one insert at each cap",
  );
  await setup.query(
    "update public.chimera_tier_limits set max_saved_games=2 where tier_key=$1",
    [tier],
  );
  const secondGame = (
    await workers[0].query(
      "select public.chimera_create_pinned_game($1,$2,$3,'{}'::jsonb) as id",
      [fixtureUser, fixtureCompiles[0], fixtureCharacter],
    )
  ).rows[0].id;
  const games = (
    await setup.query(
      "select id from public.chimera_game_states where player_id=$1 order by created_at,id",
      [fixtureUser],
    )
  ).rows.map((row) => row.id);
  await workers[0].query("set role authenticated");
  await workers[0].query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',json_build_object('sub',$1,'role','authenticated')::text,false)",
    [fixtureUser],
  );
  await workers[0].query(
    "select public.chimera_set_active_choices('{}'::uuid[],$1::uuid[])",
    [games],
  );
  await setup.query(
    "update public.chimera_tier_limits set max_saved_games=1 where tier_key=$1",
    [tier],
  );
  const gameView = (
    await workers[0].query(
      "select public.chimera_entitlements_active() as value",
    )
  ).rows[0].value;
  assert.deepEqual(gameView.writable_game_ids, [games[0]]);
  await workers[0].query("select public.chimera_assert_game_writable($1)", [
    games[0],
  ]);
  await assert.rejects(
    workers[0].query("select public.chimera_assert_game_writable($1)", [
      secondGame,
    ]),
    /GAME_READ_ONLY_TIER_LIMIT/,
  );
  await setup.query("delete from public.chimera_game_states where id=$1", [
    games[0],
  ]);
  assert.deepEqual(
    (
      await workers[0].query(
        "select public.chimera_entitlements_active() as value",
      )
    ).rows[0].value.writable_game_ids,
    [secondGame],
  );
  console.log(
    "PASS saved-game priority survives downgrade; read-only turn assertion and delete reactivation",
  );
} finally {
  await Promise.all(workers.map((worker) => worker.end().catch(() => {})));
  await setup.query("rollback");
  await setup.query(
    "delete from public.chimera_game_states where player_id=$1",
    [fixtureUser],
  );
  await setup.query(
    "delete from public.chimera_stories where owner_user_id=$1",
    [fixtureUser],
  );
  await setup.query(
    "delete from public.chimera_compiled_stories where id=any($1::uuid[])",
    [[...fixtureCompiles, ...(originalCompile ? [originalCompile] : [])]],
  );
  await setup.query("delete from auth.users where id=$1", [fixtureUser]);
  await setup.query(
    "delete from public.chimera_tier_limits where tier_key=$1",
    [tier],
  );
  await setup.end();
}
