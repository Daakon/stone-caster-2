import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = argument.match(/^--([^=]+)(?:=(.*))?$/);
  if (!match) throw new Error(`Unsupported argument: ${argument}`);
  options.set(match[1], match[2] ?? true);
}
const dryRun = options.get('dry-run') === true;
const execute = options.get('execute') === true;
if (dryRun === execute) throw new Error('Choose exactly one of --dry-run or --execute.');
const target = options.get('target');
if (!['local','operator'].includes(target)) throw new Error('--target must be local or operator.');
const localEnv = fs.existsSync(path.join(root,'.env.stonecaster-local'))
  ? dotenv.parse(fs.readFileSync(path.join(root,'.env.stonecaster-local'))) : {};
const connectionString = target === 'local' ? (process.env.DATABASE_URL || localEnv.DATABASE_URL) : process.env.PRELAUNCH_DATABASE_URL;
if (!connectionString) throw new Error(target === 'local' ? 'The local DB URL is missing.' : 'PRELAUNCH_DATABASE_URL is required for --target=operator.');
const parsedUrl = new URL(connectionString);
if (target === 'local' && !['localhost','127.0.0.1','::1','[::1]'].includes(parsedUrl.hostname.toLowerCase())) {
  throw new Error('Refusing --target=local because its DB URL is not loopback.');
}
if (parsedUrl.pathname !== '/postgres') throw new Error('Prelaunch wipe requires the Supabase postgres database.');

const resetKey = String(options.get('reset-key') || 'f0a-pre-setup-v1');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowlistPath = options.get('tester-allowlist');
if (!allowlistPath) throw new Error('--tester-allowlist=<json-file> is required.');
const resolvedAllowlistPath = path.resolve(root, String(allowlistPath));
const testerIds = JSON.parse(fs.readFileSync(resolvedAllowlistPath,'utf8'));
if (!Array.isArray(testerIds) || testerIds.length === 0 || testerIds.some((id) => !uuidPattern.test(id))) {
  throw new Error('Tester allowlist must be a non-empty JSON array of user UUIDs.');
}

const deleteTables = [
  'chimera_turn_progress','chimera_turns','chimera_game_states','chimera_compiled_content_refs','chimera_compiled_stories',
  'chimera_instances_v3','chimera_player_characters','chimera_story_compiled_ruleset','chimera_story_links',
  'chimera_story_entity_links','chimera_story_content_pack_links','chimera_stories',
  'chimera_content_pack_entity_links','chimera_content_pack_lore_links','chimera_content_pack_ruleset_links',
  'chimera_pack_dependencies','chimera_content_packs','chimera_asset_tags','chimera_assets','chimera_lore','chimera_entities',
  'chimera_world_ruleset_link','chimera_worlds','premade_characters','chimera_tags','chimera_exclusion_groups',
  'mechanics_skills','mechanics_conditions','mechanics_resources','localization_glossary','localization_rules',
  'localization_packs','injection_map','dialogue_config','dialogue_graphs','quest_graphs','quest_graph_indexes',
  'chimera_content_source_items',
];
const retainedCounts = [
  ['auth','users'],['public','profiles'],['public','app_roles'],['public','user_profiles'],
  ['public','app_config'],['public','pricing_config'],['public','feature_flags'],['public','config_meta'],
  ['public','chimera_ruleset_templates'],
];

const client = new pg.Client({connectionString,application_name:'stonecaster-prelaunch-wipe'});
const qualified = (schema,table) => `"${schema}"."${table}"`;
async function tableExists(schema,table) {
  const {rows} = await client.query('select to_regclass($1) is not null as exists', [`${schema}.${table}`]);
  return rows[0].exists;
}
async function ensureGuardTables() {
  await client.query(`
    create table if not exists public.chimera_launch_guard (
      id boolean primary key default true check (id), real_players_started_at timestamptz
    );
    insert into public.chimera_launch_guard(id) values (true) on conflict (id) do nothing;
    create table if not exists public.chimera_prelaunch_resets (
      reset_key text primary key,
      backup_sha256 text not null check (backup_sha256 ~ '^[0-9a-f]{64}$'),
      operator_id uuid not null,
      completed_at timestamptz not null default now(),
      row_counts jsonb not null
    );
    revoke all on public.chimera_launch_guard, public.chimera_prelaunch_resets from public, anon, authenticated, service_role;
  `);
}
async function inventory() {
  const presentTables = [];
  for (const table of deleteTables) if (await tableExists('public',table)) presentTables.push(table);
  const {rows: fkRows} = await client.query(`
    select child.relname as child_table, parent.relname as parent_table, constraint_row.conname,
           constraint_row.confdeltype, constraint_row.condeferrable
    from pg_constraint constraint_row
    join pg_class child on child.oid=constraint_row.conrelid
    join pg_namespace child_ns on child_ns.oid=child.relnamespace
    join pg_class parent on parent.oid=constraint_row.confrelid
    join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
    where constraint_row.contype='f' and child_ns.nspname='public' and parent_ns.nspname='public'
      and (child.relname=any($1::text[]) or parent.relname=any($1::text[]))
    order by parent.relname, child.relname, constraint_row.conname
  `,[presentTables]);
  const selected = new Set(presentTables);
  const externalCascades = fkRows.filter((fk) => selected.has(fk.parent_table) && !selected.has(fk.child_table) && fk.confdeltype === 'c');
  if (externalCascades.length) throw new Error(`Unmapped cascading child tables found: ${externalCascades.map((fk)=>`${fk.child_table}.${fk.conname}->${fk.parent_table}`).join(', ')}`);

  // A child must be deleted before its parent when the FK blocks parent deletion. SET NULL/DEFAULT
  // constraints can remain outside the wipe order because PostgreSQL preserves the child row.
  const outgoing = new Map(presentTables.map((table) => [table,new Set()]));
  const indegree = new Map(presentTables.map((table) => [table,0]));
  for (const fk of fkRows) {
    if (!selected.has(fk.child_table) || !selected.has(fk.parent_table) || fk.confdeltype === 'n' || fk.confdeltype === 'd') continue;
    if (!outgoing.get(fk.child_table).has(fk.parent_table)) {
      outgoing.get(fk.child_table).add(fk.parent_table);
      indegree.set(fk.parent_table,indegree.get(fk.parent_table)+1);
    }
  }
  const ready = [...indegree].filter(([,degree]) => degree===0).map(([table])=>table).sort();
  const order = [];
  while (ready.length) {
    const table = ready.shift();
    order.push(table);
    for (const parent of outgoing.get(table)) {
      indegree.set(parent,indegree.get(parent)-1);
      if (indegree.get(parent)===0) { ready.push(parent); ready.sort(); }
    }
  }
  if (order.length !== presentTables.length) {
    const cycle = [...indegree].filter(([,degree])=>degree>0).map(([table])=>table);
    throw new Error(`Foreign-key delete order has an unresolved cycle: ${cycle.join(', ')}`);
  }
  const counts = {};
  for (const table of order) {
    counts[table] = table === 'chimera_content_source_items'
      ? Number((await client.query('select count(*)::bigint as count from public.chimera_content_source_items where content_kind <> $1',['ruleset'])).rows[0].count)
      : Number((await client.query(`select count(*)::bigint as count from ${qualified('public',table)}`)).rows[0].count);
  }
  let financialRows = null;
  if (await tableExists('public','auth_ledger')) {
    financialRows = Number((await client.query('select count(*)::bigint as count from public.auth_ledger where user_id=any($1::uuid[])',[testerIds])).rows[0].count);
  }
  const retained = {};
  for (const [schema,table] of retainedCounts) {
    if (await tableExists(schema,table)) retained[`${schema}.${table}`] = Number((await client.query(`select count(*)::bigint as count from ${qualified(schema,table)}`)).rows[0].count);
  }
  const guard = (await client.query('select real_players_started_at from public.chimera_launch_guard where id=true')).rows[0];
  const markerCount = Number((await client.query('select count(*)::bigint as count from public.chimera_prelaunch_resets')).rows[0].count);
  return {order, fkRows, counts, financialRows, retained, launchMarker:guard?.real_players_started_at ?? null, markerCount};
}

function verifyBackup(fileName, expectedHash) {
  const filePath = path.resolve(root,String(fileName));
  const bytes = fs.readFileSync(filePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedHash && sha256 !== String(expectedHash).toLowerCase()) throw new Error('Backup SHA-256 does not match --backup-sha256.');
  const result = spawnSync('pg_restore',['--list',filePath],{encoding:'utf8',windowsHide:true});
  if (result.error || result.status !== 0) throw new Error(`pg_restore --list could not verify the supplied backup: ${result.stderr || result.error?.message || 'unknown error'}`);
  return sha256;
}

await client.connect();
try {
  await ensureGuardTables();
  const report = await inventory();
  process.stdout.write(JSON.stringify({mode:dryRun?'dry_run':'execute',target,reset_key:resetKey,foreign_key_delete_order:report.order,
    delete_row_counts:report.counts,tester_financial_rows:report.financialRows,retained_row_counts:report.retained,
    real_players_started_at:report.launchMarker,existing_reset_markers:report.markerCount},null,2)+'\n');
  if (dryRun) process.exitCode = 0;
  else {
    if (report.launchMarker) throw new Error('Refusing prelaunch wipe because real players have already started.');
    if (report.markerCount !== 0) throw new Error('Refusing prelaunch wipe because a reset marker already exists.');
    const operatorId = String(options.get('operator-id') || '');
    if (!uuidPattern.test(operatorId)) throw new Error('--operator-id=<uuid> is required for execution.');
    const backupFile = options.get('backup-file');
    const suppliedHash = options.get('backup-sha256');
    if (!backupFile || !suppliedHash) throw new Error('--backup-file and --backup-sha256 are required for execution.');
    const backupHash = verifyBackup(backupFile,suppliedHash);
    await client.query('begin');
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('stonecaster-f0a-prelaunch-reset'))");
      const current = await client.query('select real_players_started_at from public.chimera_launch_guard where id=true for update');
      const markers = await client.query('select count(*)::bigint as count from public.chimera_prelaunch_resets');
      if (current.rows[0]?.real_players_started_at) throw new Error('Real-player launch guard was set before the wipe transaction.');
      if (Number(markers.rows[0].count)!==0) throw new Error('A reset marker exists; this wipe is one-time only.');
      const actualCounts = {};
      for (const table of report.order) {
        if (table === 'chimera_content_source_items') {
          const result = await client.query("delete from public.chimera_content_source_items where content_kind <> 'ruleset'");
          actualCounts[table] = result.rowCount;
        } else {
          const result = await client.query(`delete from ${qualified('public',table)}`);
          actualCounts[table] = result.rowCount;
        }
      }
      if (report.financialRows !== null) {
        const result = await client.query('delete from public.auth_ledger where user_id=any($1::uuid[])',[testerIds]);
        actualCounts['auth_ledger[testers]'] = result.rowCount;
      }
      await client.query(`insert into public.chimera_prelaunch_resets(reset_key,backup_sha256,operator_id,row_counts)
        values($1,$2,$3::uuid,$4::jsonb)`,[resetKey,backupHash,operatorId,JSON.stringify(actualCounts)]);
      await client.query('commit');
      process.stdout.write(JSON.stringify({completed:true,backup_sha256:backupHash,row_counts:actualCounts})+'\n');
    } catch (error) {
      await client.query('rollback').catch(()=>undefined);
      throw error;
    }
  }
} finally {
  await client.end();
}
