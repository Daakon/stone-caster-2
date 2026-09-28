import {ContentSyncService} from '../services/content/content-sync.service.js';

const service = new ContentSyncService();
try {
  const validated = service.validate();
  const {bundle} = validated;
  const counts = Object.fromEntries([...new Set(bundle.items.map((item) => item.kind))]
    .sort().map((kind) => [kind, bundle.items.filter((item) => item.kind === kind).length]));
  const result = {valid:true, item_count:bundle.items.length, counts, manifest_hash:validated.manifestHash};
  console.log(JSON.stringify(process.argv.includes('--hashes') ? {...result, item_hashes:validated.itemHashes} : result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Content validation failed');
  process.exitCode = 1;
}
