import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";

const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const { Client } = require("pg");
const env = dotenv.parse(
  fs.readFileSync(new URL("../../.env.stonecaster-local", import.meta.url)),
);
const url = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422",
  "Isolated loopback database on port 54422 required",
);
const clients = Array.from(
  { length: 4 },
  () =>
    new Client({
      connectionString: url.toString(),
      statement_timeout: 10000,
      lock_timeout: 5000,
    }),
);
const [db, baseline, gc, worker] = clients;
const user = randomUUID(),
  character = randomUUID(),
  tier = `gc-${randomUUID()}`;
const admin = "00000000-0000-4000-8000-00000000a001";
const compiles = [],
  stories = [],
  hashes = new Set();
let baselineHeld = false;
async function identity(client, role, id) {
  await client.query(`set local role ${role}`);
  await client.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
    [id, role],
  );
}
async function collect(size = 1000, dry = false) {
  const receipt = (
    await gc.query("select public.chimera_content_gc($1,$2) as receipt", [
      size,
      dry,
    ])
  ).rows[0].receipt;
  assert.ok(receipt.compiled_deleted <= size && receipt.blobs_deleted <= size);
  assert.ok(BigInt(receipt.bytes_reclaimed) <= BigInt(receipt.bytes_eligible));
  return receipt;
}
async function exists(table, key, value) {
  return (
    await db.query(
      `select exists(select 1 from public.${table} where ${key}=$1) as found`,
      [value],
    )
  ).rows[0].found;
}
async function blob(label) {
  const body = {
    format_version: 1,
    body: { test_fixture: user, label },
    refs: [],
  };
  const hash = (
    await db.query(
      "select encode(extensions.digest(convert_to(public.content_canonical_json($1::jsonb),'UTF8'),'sha256'),'hex') as hash",
      [JSON.stringify(body)],
    )
  ).rows[0].hash;
  hashes.add(hash);
  await db.query(
    "insert into public.chimera_content_blobs(sha256,format_version,body,byte_count) values($1,1,$2::jsonb,octet_length(convert_to(public.content_canonical_json($2::jsonb),'UTF8'))) on conflict do nothing",
    [hash, JSON.stringify(body)],
  );
  return hash;
}
async function compiled(label, story = null, sharedHash = null) {
  const id = randomUUID(),
    hash = sharedHash || (await blob(label));
  compiles.push(id);
  await db.query(
    "insert into public.chimera_compiled_stories(id,story_id,payload_blob_hash,frozen_owner_user_id,frozen_title) values($1,$2,$3,$4,$5)",
    [id, story, hash, user, label],
  );
  await db.query(
    "insert into public.chimera_compiled_content_refs(compiled_story_id,role,kind,owner_namespace,content_key,sha256) values($1::uuid,'compiled_payload','compiled_payload','first_party',$1::uuid::text,$2)",
    [id, hash],
  );
  return { id, hash };
}
async function story() {
  const id = randomUUID();
  stories.push(id);
  await db.query(
    "insert into public.chimera_stories(id,display_name,owner_user_id) values($1::uuid,'F0b GC fixture ' || $1::uuid::text,$2)",
    [id, user],
  );
  return id;
}
async function pin(client, id) {
  return (
    await client.query(
      "select public.chimera_create_pinned_game($1,$2,$3,'{}'::jsonb) as id",
      [user, id, character],
    )
  ).rows[0].id;
}
async function rejected(client, sql, args, match) {
  await client.query("begin");
  try {
    await assert.rejects(client.query(sql, args), match);
  } finally {
    await client.query("rollback");
  }
}
async function publish(label, payload, storyId = null) {
  await worker.query("begin");
  await identity(worker, "authenticated", admin);
  const generation = (
    await worker.query(
      "select generation from public.chimera_content_catalog_state where singleton",
    )
  ).rows[0].generation;
  const id = (
    await worker.query(
      "select public.publish_frozen_chimera_compile($1,$2,$3,$4::jsonb,$5::jsonb) as id",
      [
        generation,
        storyId,
        label,
        JSON.stringify(refs),
        JSON.stringify(payload),
      ],
    )
  ).rows[0].id;
  compiles.push(id);
  const hash = (
    await worker.query(
      "select payload_blob_hash from public.chimera_compiled_stories where id=$1",
      [id],
    )
  ).rows[0].payload_blob_hash;
  hashes.add(hash);
  return { id, hash }; // Caller controls commit to test the real publication locks.
}
let refs;
async function waitForGcLock() {
  for (let i = 0; i < 100; i++) {
    if (
      (
        await db.query(
          "select $1::integer=any(pg_blocking_pids($2)) as blocked",
          [gc.processID, worker.processID],
        )
      ).rows[0].blocked
    )
      return;
    await delay(20);
  }
  throw new Error("Concurrent operation did not reach the GC row lock");
}
await Promise.all(
  clients.map(async (client) => {
    await client.connect();
  }),
);
try {
  // Never collect pre-existing local data, even if an assertion fails. This
  // harness requires an idle isolated stack; it does not run against hosted DBs.
  await baseline.query("begin");
  const originalCompiles = (
    await baseline.query(
      "select id from public.chimera_compiled_stories for update",
    )
  ).rows.map((row) => row.id);
  const originalBlobs = (
    await baseline.query(
      "select sha256 from public.chimera_content_blobs for key share",
    )
  ).rows.map((row) => row.sha256);
  baselineHeld = true; // Cleanup is safe only after both full inventories are locked.
  await gc.query("set role stonecaster_content_gc_operator");
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",
    [user, `${user}@example.test`],
  );
  await db.query(
    "insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) values($1,30,30)",
    [tier],
  );
  await db.query(
    "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
    [user, tier],
  );
  await db.query(
    "insert into public.chimera_prelaunch_testers(user_id) values($1)",
    [user],
  );
  await db.query(
    "insert into public.chimera_player_characters(id,user_id,name) values($1,$2,'GC fixture')",
    [character, user],
  );
  const source = (
    await db.query(
      "select * from public.chimera_content_source_items where content_kind='world' order by content_key limit 1",
    )
  ).rows[0];
  assert.ok(source, "Synced first-party world required");
  refs = [
    {
      role: "world",
      kind: source.content_kind,
      owner_namespace: source.owner_namespace,
      key: source.content_key,
      sha256: source.content_hash,
    },
  ];
  const base = await publish("GC source protector", {
    test_fixture: user,
    label: "source protector",
  });
  await worker.query("commit");
  await worker.query("begin");
  await identity(worker, "service_role", user);
  await pin(worker, base.id);
  await worker.query("commit");
  if (!originalBlobs.includes(source.content_hash))
    hashes.add(source.content_hash);

  for (const role of [
    "anon",
    "authenticated",
    "service_role",
    "stonecaster_content_deployer",
  ]) {
    const existsRole = (
      await db.query(
        "select exists(select 1 from pg_roles where rolname=$1) as found",
        [role],
      )
    ).rows[0].found;
    if (!existsRole) throw new Error(`Required existing role missing: ${role}`);
    assert.equal(
      (
        await db.query(
          "select has_function_privilege($1,'public.chimera_content_gc(integer,boolean)','execute') as allowed",
          [role],
        )
      ).rows[0].allowed,
      false,
    );
  }
  await rejected(gc, "select * from public.chimera_content_blobs", [], {
    code: "42501",
  });
  await rejected(gc, "set local role stonecaster_content_gc_owner", [], {
    code: "42501",
  });
  for (const args of [
    [null, true],
    [0, true],
    [1001, false],
    [1, null],
  ])
    await rejected(gc, "select public.chimera_content_gc($1,$2)", args, {
      code: "22023",
    });
  await rejected(
    db,
    "update public.chimera_content_blobs set body='{}' where sha256=$1",
    [base.hash],
    /immutable/,
  );
  await rejected(
    db,
    "delete from public.chimera_content_blobs where sha256=$1",
    [base.hash],
    /immutable/,
  );
  console.log(
    "PASS dedicated operator execution, invalid arguments, immutable blobs and application/deployer denial",
  );

  const currentStory = await story(),
    current = await compiled("current", currentStory);
  await db.query(
    "update public.chimera_stories set current_compiled_id=$1 where id=$2",
    [current.id, currentStory],
  );
  const pinned = await compiled("pinned", null, current.hash);
  await worker.query("begin");
  await identity(worker, "service_role", user);
  await pin(worker, pinned.id);
  await worker.query("commit");
  await rejected(
    db,
    "delete from public.chimera_compiled_stories where id=$1",
    [current.id],
    { code: "23503" },
  );
  const orphan = await compiled("orphan"),
    loose = await blob("loose");
  const preview = await collect(1, true);
  assert.equal(preview.compiled_deleted, 0);
  assert.equal(preview.blobs_deleted, 0);
  assert.equal(preview.bytes_reclaimed, "0");
  assert.ok(await exists("chimera_compiled_stories", "id", orphan.id));
  const applied = await collect(1);
  assert.equal(applied.compiled_deleted, 1);
  assert.equal(applied.blobs_deleted, 1);
  assert.equal(
    await exists("chimera_compiled_stories", "id", orphan.id),
    false,
  );
  assert.ok(await exists("chimera_compiled_stories", "id", current.id));
  assert.ok(await exists("chimera_compiled_stories", "id", pinned.id));
  assert.ok(await exists("chimera_content_blobs", "sha256", current.hash));
  await collect();
  assert.equal(await exists("chimera_content_blobs", "sha256", loose), false);
  const drained = await collect();
  assert.equal(drained.compiled_deleted, 0);
  assert.equal(drained.blobs_deleted, 0);
  console.log(
    "PASS preview, bounded deletion, current/game retention, shared payload retention and idempotent drain",
  );

  const lockedStory = await story(),
    locked = await compiled("story lock", lockedStory);
  await worker.query("begin");
  await worker.query(
    "select id from public.chimera_stories where id=$1 for update",
    [lockedStory],
  );
  assert.equal((await collect()).compiled_deleted, 0);
  await worker.query(
    "update public.chimera_stories set current_compiled_id=$1 where id=$2",
    [locked.id, lockedStory],
  );
  await worker.query("commit");
  assert.equal((await collect()).compiled_deleted, 0);
  await db.query(
    "update public.chimera_stories set current_compiled_id=null where id=$1",
    [lockedStory],
  );
  await worker.query("begin");
  await worker.query(
    "select id from public.chimera_compiled_stories where id=$1 for update",
    [locked.id],
  );
  assert.equal((await collect()).compiled_deleted, 0);
  await worker.query("rollback");
  assert.equal((await collect()).compiled_deleted, 1);
  const lockedHash = await blob("locked blob");
  await worker.query("begin");
  await worker.query(
    "select sha256 from public.chimera_content_blobs where sha256=$1 for key share",
    [lockedHash],
  );
  assert.equal((await collect()).blobs_deleted, 0);
  await worker.query("rollback");
  assert.equal((await collect()).blobs_deleted, 1);
  console.log(
    "PASS SKIP LOCKED for story, compiled row and blob; concurrent current-pointer publication survives",
  );

  const publishedStory = await story(),
    prior = await compiled("prior draft", publishedStory);
  const publishedCurrent = await publish(
    "current compiler publication",
    { test_fixture: user, label: "current compiler publication" },
    publishedStory,
  );
  assert.equal((await collect()).compiled_deleted, 0);
  await worker.query("commit");
  assert.ok(await exists("chimera_compiled_stories", "id", prior.id));
  assert.equal((await collect()).compiled_deleted, 1);
  assert.equal(
    (
      await db.query(
        "select current_compiled_id from public.chimera_stories where id=$1",
        [publishedStory],
      )
    ).rows[0].current_compiled_id,
    publishedCurrent.id,
  );
  console.log(
    "PASS real compiler story publication serializes its current pointer with GC",
  );

  const existingPayload = await blob("compiler wins");
  const duringPublish = await publish("compiler wins", {
    test_fixture: user,
    label: "compiler wins",
  });
  assert.equal(duringPublish.hash, existingPayload);
  await collect();
  await worker.query("commit");
  assert.ok(await exists("chimera_compiled_stories", "id", duringPublish.id));
  assert.ok(
    await exists("chimera_content_blobs", "sha256", duringPublish.hash),
  );
  await collect();
  assert.equal(
    await exists("chimera_compiled_stories", "id", duringPublish.id),
    false,
  );
  const payload = { test_fixture: user, label: "GC wins" };
  const recycled = await blob("GC wins");
  await gc.query("begin");
  await collect();
  const waitingPublish = publish("GC wins", payload).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await waitForGcLock();
  await gc.query("commit");
  const published = await waitingPublish;
  if (published.error) throw published.error;
  const recreated = published.value;
  await worker.query("commit");
  assert.equal(recreated.hash, recycled);
  assert.ok(await exists("chimera_content_blobs", "sha256", recreated.hash));
  await collect();
  console.log(
    "PASS real compiler transaction versus GC: locked publication survives; collected payload is safely recreated",
  );

  const sessionFirst = await compiled("session wins");
  await worker.query("begin");
  await identity(worker, "service_role", user);
  await pin(worker, sessionFirst.id);
  assert.equal((await collect()).compiled_deleted, 0);
  await worker.query("commit");
  assert.equal((await collect()).compiled_deleted, 0);
  const gcFirst = await compiled("GC wins session");
  await gc.query("begin");
  assert.equal((await collect()).compiled_deleted, 1);
  await worker.query("begin");
  await identity(worker, "service_role", user);
  const pending = pin(worker, gcFirst.id).then(
    (id) => ({ id }),
    (error) => ({ error }),
  );
  await waitForGcLock();
  await gc.query("commit");
  const outcome = await pending;
  assert.match(outcome.error?.message || "", /compiled story not found/);
  await worker.query("rollback");
  assert.equal(
    (
      await db.query(
        "select count(*)::integer as count from public.chimera_game_states where compiled_story_id=$1",
        [gcFirst.id],
      )
    ).rows[0].count,
    0,
  );
  console.log(
    "PASS real session creation versus GC: winning pin retained; losing creation fails without a partial game",
  );

  const lateStory = await story(),
    late = await compiled("GC wins pointer", lateStory);
  await gc.query("begin");
  assert.equal((await collect()).compiled_deleted, 1);
  await worker.query("begin");
  const pointer = worker
    .query(
      "update public.chimera_stories set current_compiled_id=$1 where id=$2",
      [late.id, lateStory],
    )
    .then(
      () => ({ ok: true }),
      (error) => ({ error }),
    );
  await waitForGcLock();
  await gc.query("commit");
  assert.equal((await pointer).error?.code, "23503");
  await worker.query("rollback");
  assert.equal(
    (
      await db.query(
        "select current_compiled_id from public.chimera_stories where id=$1",
        [lateStory],
      )
    ).rows[0].current_compiled_id,
    null,
  );
  console.log(
    "PASS current-pointer foreign key rejects a publication that lost to GC",
  );

  assert.equal(
    (
      await db.query(
        "select count(*)::integer as count from public.chimera_compiled_stories where id=any($1::uuid[])",
        [originalCompiles],
      )
    ).rows[0].count,
    originalCompiles.length,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::integer as count from public.chimera_content_blobs where sha256=any($1::text[])",
        [originalBlobs],
      )
    ).rows[0].count,
    originalBlobs.length,
  );
  console.log("PASS all pre-existing snapshots/blobs preserved");
} finally {
  await gc.query("rollback");
  await worker.query("rollback");
  await db.query("rollback");
  try {
    if (baselineHeld) {
      await db.query(
        "delete from public.chimera_game_states where player_id=$1",
        [user],
      );
      await db.query(
        "delete from public.chimera_stories where id=any($1::uuid[])",
        [stories],
      );
      // All original rows stay locked while the actual bounded GC clears fixtures.
      for (let i = 0; i < 10; i++) {
        const receipt = await collect();
        if (receipt.compiled_deleted === 0 && receipt.blobs_deleted === 0)
          break;
      }
      assert.equal(
        (
          await db.query(
            "select count(*)::integer as count from public.chimera_compiled_stories where id=any($1::uuid[])",
            [compiles],
          )
        ).rows[0].count,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::integer as count from public.chimera_content_blobs where sha256=any($1::text[])",
            [[...hashes]],
          )
        ).rows[0].count,
        0,
      );
      await db.query("delete from auth.users where id=$1", [user]);
      await db.query(
        "delete from public.chimera_tier_limits where tier_key=$1",
        [tier],
      );
    }
  } finally {
    await baseline.query("rollback");
    await Promise.all(clients.map((client) => client.end()));
  }
}
