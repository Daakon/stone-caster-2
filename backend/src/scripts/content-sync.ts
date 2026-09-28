import {ContentSyncService} from '../services/content/content-sync.service.js';

function targetFromArgs(): string | undefined {
  return process.argv.slice(2).find((argument) => argument.startsWith('--target='))?.slice('--target='.length);
}

const target = targetFromArgs();
if (target !== 'local') {
  console.error('F0a content sync accepts only --target=local. Hosted targets require a later approved release gate.');
  process.exit(2);
}
if (process.argv.slice(2).some((argument) => argument !== '--target=local')) {
  console.error('Unsupported content sync argument.');
  process.exit(2);
}
const connectionString = process.env.CONTENT_DEPLOY_DATABASE_URL;
if (!connectionString) {
  console.error('CONTENT_DEPLOY_DATABASE_URL is required; no app or service-role credential is accepted.');
  process.exit(2);
}
const databaseUrl = new URL(connectionString);
if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname.toLowerCase())) {
  console.error('Refusing content sync because --target=local requires a loopback database host.');
  process.exit(2);
}

try {
  const receipt = await new ContentSyncService().sync(connectionString);
  console.log(JSON.stringify({target:'local', generation:receipt.generation, manifest_hash:receipt.manifest_hash, item_count:receipt.item_count}));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Content sync failed');
  process.exitCode = 1;
}
