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
  !url.search &&
    !url.hash &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54422",
  "Isolated local database required",
);
const db = new Client({
  connectionString: url.toString(),
  statement_timeout: 10000,
  lock_timeout: 5000,
});
const admin = "00000000-0000-4000-8000-00000000a001",
  player = "00000000-0000-4000-8000-00000000b001";
const historyOnly = process.argv.includes("--history-only");
if (process.argv.slice(2).some((arg) => arg !== "--history-only"))
  throw new Error("Unsupported deploy test argument");
const configured =
  process.env.CONTENT_DEPLOY_DATABASE_URL || env.CONTENT_DEPLOY_DATABASE_URL;
if (!historyOnly && !configured)
  throw new Error(
    "CONTENT_DEPLOY_DATABASE_URL must contain an existing local dedicated deploy login; this harness never changes credentials.",
  );
const deployUrl = configured ? new URL(configured) : null;
if (!historyOnly)
  assert.ok(
    deployUrl &&
      !deployUrl.search &&
      !deployUrl.hash &&
      deployUrl.hostname === url.hostname &&
      deployUrl.port === url.port &&
      deployUrl.username === "stonecaster_content_deployer",
    "Existing isolated deploy login required",
  );
let deployer;
const commit = "a".repeat(40); // Rollback-only fixture provenance.
async function identity(role, id) {
  await db.query(`set local role ${role}`);
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',json_build_object('sub',$1::text,'role',$2::text)::text,true)",
    [id, role],
  );
}
async function denied(role, id, sql, args = [], code = "42501") {
  await db.query("begin");
  try {
    await identity(role, id);
    await assert.rejects(db.query(sql, args), { code });
  } finally {
    await db.query("rollback");
  }
}
async function fingerprint() {
  return (
    await db.query(
      "select (select generation::text from public.chimera_content_catalog_state where singleton) as generation,(select count(*)::integer from public.chimera_content_deploy_log) as receipts,(select md5(coalesce(jsonb_agg(to_jsonb(s) order by content_kind,owner_namespace,content_key)::text,'[]')) from public.chimera_content_source_items s) as sources",
    )
  ).rows[0];
}
await db.connect();
try {
  const before = await fingerprint();
  if (!historyOnly) {
    deployer = new Client({
      connectionString: deployUrl.toString(),
      statement_timeout: 10000,
      lock_timeout: 5000,
    });
    await deployer.connect();
    const baseline = (
      await db.query(
        "select content_kind as kind,content_key as key,owner_namespace,content_format_version as format_version,body,content_refs as refs from public.chimera_content_source_items order by content_kind,content_key",
      )
    ).rows;
    assert.ok(baseline.length, "Synced first-party catalog required");
    const key = `deploy-test-${randomUUID()}`;
    const fixture = {
      kind: "tag",
      key,
      owner_namespace: "first_party",
      format_version: 1,
      body: { name: "provenance fixture" },
      refs: [],
    };
    let items = [...baseline, fixture];
    await deployer.query("begin");
    async function apply(
      id = randomUUID(),
      deployment = { commit_sha: commit },
    ) {
      const generation = (
        await deployer.query(
          "select catalog_generation::text from content_deploy.validation_formats limit 1",
        )
      ).rows[0].catalog_generation;
      return (
        await deployer.query(
          "select content_deploy.content_sync_apply($1,$2,$3::jsonb) as receipt",
          [generation, id, JSON.stringify({ items, deployment })],
        )
      ).rows[0].receipt;
    }
    const first = await apply();
    assert.equal(first.commit_sha, commit);
    assert.equal(first.outcome, "applied");
    assert.equal(first.format_version, 1);
    assert.deepEqual(first.changed_keys, [
      { kind: "tag", namespace: "first_party", key },
    ]);
    assert.equal(first.old_new_hashes[0].old_hash, null);
    assert.match(first.old_new_hashes[0].new_hash, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      await fingerprint(),
      before,
      "Uncommitted catalog and receipt must be invisible to another connection",
    );
    items = [
      ...baseline,
      { ...fixture, body: { name: "changed provenance fixture" } },
    ];
    const second = await apply();
    assert.equal(
      second.old_new_hashes[0].old_hash,
      first.old_new_hashes[0].new_hash,
    );
    assert.notEqual(
      second.old_new_hashes[0].new_hash,
      first.old_new_hashes[0].new_hash,
    );
    const noOp = await apply();
    assert.deepEqual(noOp.changed_keys, []);
    assert.deepEqual(noOp.old_new_hashes, []);
    const generation = (
      await deployer.query(
        "select catalog_generation::text from content_deploy.validation_formats limit 1",
      )
    ).rows[0].catalog_generation;
    await deployer.query("savepoint stale_generation");
    await assert.rejects(
      deployer.query(
        "select content_deploy.content_sync_apply($1,$2,$3::jsonb)",
        [
          String(BigInt(generation) - 1n),
          randomUUID(),
          JSON.stringify({ items, deployment: { commit_sha: commit } }),
        ],
      ),
      { code: "40001" },
    );
    await deployer.query("rollback to savepoint stale_generation");
    for (const deployment of [{}, { commit_sha: "short" }]) {
      await deployer.query("savepoint invalid_metadata");
      await assert.rejects(apply(randomUUID(), deployment), { code: "22023" });
      await deployer.query("rollback to savepoint invalid_metadata");
    }
    await deployer.query("savepoint duplicate_receipt");
    await assert.rejects(apply(first.deploy_id), { code: "23505" });
    await deployer.query("rollback to savepoint duplicate_receipt");
    assert.equal(
      (
        await deployer.query(
          "select catalog_generation::text from content_deploy.validation_formats limit 1",
        )
      ).rows[0].catalog_generation,
      generation,
    );
    await deployer.query("savepoint missing_dependency");
    items = [
      ...baseline,
      {
        ...fixture,
        refs: [
          {
            kind: "world",
            owner_namespace: "first_party",
            key: `missing-${randomUUID()}`,
          },
        ],
      },
    ];
    await assert.rejects(apply(), /dangling first-party/);
    await deployer.query("rollback to savepoint missing_dependency");
    assert.equal(
      (
        await deployer.query(
          "select catalog_generation::text from content_deploy.validation_formats limit 1",
        )
      ).rows[0].catalog_generation,
      generation,
    );
    await deployer.query("savepoint privilege");
    await assert.rejects(
      deployer.query("select * from public.chimera_content_deploy_log"),
      { code: "42501" },
    );
    await deployer.query("rollback to savepoint privilege");
    await deployer.query("rollback");
    assert.deepEqual(await fingerprint(), before);
    console.log(
      "PASS database-computed added/changed/no-op hashes, required commit, generation fence, atomic receipt/catalog rollback and dedicated role denial",
    );
  }

  for (const [role, id] of [
    ["anon", player],
    ["authenticated", player],
    ["service_role", admin],
  ])
    await denied(
      role,
      id,
      "select public.chimera_admin_content_deploy_log(2,null)",
    );
  await denied(
    "service_role",
    admin,
    "select * from public.chimera_content_deploy_log",
  );
  await denied(
    "authenticated",
    admin,
    "select public.chimera_admin_content_deploy_log(0,null)",
    [],
    "22023",
  );
  await db.query("begin");
  const generationBase = BigInt(before.generation),
    ids = [randomUUID(), randomUUID(), randomUUID()];
  for (let i = 0; i < ids.length; i++)
    await db.query(
      "insert into public.chimera_content_deploy_log(id,catalog_generation,manifest_hash,item_count,deployed_by,commit_sha,format_version,changed_keys,old_new_hashes,outcome) values($1,$2,$3,1,'stonecaster_content_deployer',$4,1,'[]','[]','applied')",
      [ids[i], String(generationBase + BigInt(i + 1)), "b".repeat(64), commit],
    );
  await identity("authenticated", admin);
  const firstPage = (
    await db.query(
      "select public.chimera_admin_content_deploy_log(2,null) as page",
    )
  ).rows[0].page;
  assert.deepEqual(
    firstPage.items.map((item) => item.id),
    [ids[2], ids[1]],
  );
  assert.equal(firstPage.next_before_generation, String(generationBase + 2n));
  assert.equal(firstPage.items[0].actor, "stonecaster_content_deployer");
  assert.equal(firstPage.items[0].provenance, "recorded");
  assert.equal(firstPage.items[0].commit_sha, commit);
  const next = (
    await db.query(
      "select public.chimera_admin_content_deploy_log(100,$1) as page",
      [firstPage.next_before_generation],
    )
  ).rows[0].page;
  assert.equal(next.items[0].id, ids[0]);
  assert.equal(next.next_before_generation, null);
  const legacy = next.items.find((item) => item.provenance === "legacy");
  assert.ok(legacy, "Existing F0a receipt required");
  assert.equal(legacy.commit_sha, null);
  assert.equal(legacy.changed_keys, null);
  for (const item of [...firstPage.items, ...next.items]) {
    assert.equal(typeof item.generation, "string");
    assert.equal("body" in item, false);
  }
  await db.query("reset role");
  for (const sql of [
    "update public.chimera_content_deploy_log set item_count=2 where id=$1",
    "delete from public.chimera_content_deploy_log where id=$1",
  ]) {
    await db.query("savepoint immutable");
    await assert.rejects(db.query(sql, [ids[0]]), /append-only/);
    await db.query("rollback to savepoint immutable");
  }
  await db.query("rollback");
  assert.deepEqual(await fingerprint(), before);
  console.log(
    "PASS authenticated admin history, deterministic pagination, legacy unknowns, string cursors, no content bodies and append-only audit",
  );
} finally {
  if (deployer) {
    await deployer.query("rollback").catch(() => {});
    await deployer.end();
  }
  await db.query("rollback");
  await db.end();
}
