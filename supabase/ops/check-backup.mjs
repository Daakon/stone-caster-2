import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = argument.match(/^--([^=]+)(?:=(.*))?$/);
  if (!match) throw new Error(`Unsupported argument: ${argument}`);
  options.set(match[1],match[2] ?? true);
}
const fileArg = options.get('file');
if (!fileArg) throw new Error('--file=<pg_dump-custom-format-file> is required.');
const filePath = path.resolve(root,String(fileArg));
const bytes = fs.readFileSync(filePath);
if (bytes.length < 32) throw new Error('Backup file is unexpectedly small.');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const expected = options.get('sha256');
if (expected && sha256 !== String(expected).toLowerCase()) throw new Error('Backup SHA-256 does not match --sha256.');
const listing = spawnSync('pg_restore',['--list',filePath],{encoding:'utf8',windowsHide:true});
if (listing.error || listing.status !== 0) throw new Error(`pg_restore --list failed: ${listing.stderr || listing.error?.message || 'unknown error'}`);
const tocEntries = listing.stdout.split(/\r?\n/).filter((line) => line && !line.startsWith(';')).length;
if (!tocEntries) throw new Error('Backup archive has no restore entries.');

let restoreResult = null;
if (options.has('restore-test')) {
  const localEnvPath = path.join(root,'.env.stonecaster-local');
  if (!fs.existsSync(localEnvPath)) throw new Error('Isolated restore test requires .env.stonecaster-local.');
  const localEnv = dotenv.parse(fs.readFileSync(localEnvPath));
  const adminUrl = process.env.LOCAL_DATABASE_URL || localEnv.DATABASE_URL;
  if (!adminUrl || !['localhost','127.0.0.1','::1','[::1]'].includes(new URL(adminUrl).hostname.toLowerCase())) {
    throw new Error('Refusing isolated backup restore because LOCAL_DATABASE_URL is not loopback.');
  }
  const restoreDbName = `stonecaster_f0a_restore_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({connectionString:adminUrl,application_name:'stonecaster-f0a-backup-check'});
  let created = false;
  try {
    await admin.connect();
    await admin.query(`create database "${restoreDbName}" template template0`);
    created = true;
    const restoreUrl = new URL(adminUrl);
    restoreUrl.pathname = `/${restoreDbName}`;
    const restored = spawnSync('pg_restore',['--exit-on-error','--no-owner','--no-acl',`--dbname=${restoreUrl.toString()}`,filePath],
      {encoding:'utf8',windowsHide:true});
    if (restored.error || restored.status !== 0) throw new Error(`Isolated pg_restore failed: ${restored.stderr || restored.error?.message || 'unknown error'}`);
    const verification = new pg.Client({connectionString:restoreUrl.toString(),application_name:'stonecaster-f0a-backup-verify'});
    try {
      await verification.connect();
      const {rows} = await verification.query('select current_database() as restored_database, count(*)::bigint as public_tables from information_schema.tables where table_schema=\'public\' group by current_database()');
      if (rows[0].restored_database !== restoreDbName || Number(rows[0].public_tables) === 0) throw new Error('Restored database verification returned no public tables.');
      restoreResult = {database:restoreDbName,public_table_count:Number(rows[0].public_tables)};
    } finally { await verification.end().catch(()=>undefined); }
  } finally {
    if (created) {
      await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()',[restoreDbName]).catch(()=>undefined);
      await admin.query(`drop database if exists "${restoreDbName}"`).catch(()=>undefined);
    }
    await admin.end().catch(()=>undefined);
  }
}

process.stdout.write(JSON.stringify({file:path.relative(root,filePath),size_bytes:bytes.length,sha256,archive_entries:tocEntries,
  pg_restore_list:'passed',isolated_restore:restoreResult ?? 'not requested'})+'\n');
