# Author CLI

CLI tool for importing and exporting authoring assets (packs, templates, field definitions, etc.).

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Export

Export assets to a zip archive:

```bash
author export --out ./export.zip --scope story --id <storyId> --include worlds,rulesets,npcs
```

Export as unzipped directory (for git storage):

```bash
author export --out ./export --scope story --id <storyId> --pretty
```

### Import

Dry-run (preview changes):

```bash
author import --in ./export.zip --mode dry --conflict skip
```

Apply import:

```bash
author import --in ./export.zip --mode apply --conflict replace --allow-prod
```

## Conflict Policies

- `skip`: Ignore existing rows with same id/version
- `replace`: Overwrite body/versioned content (where legal)
- `merge`: For field_defs/extras and templates, keep-latest or 3-way merge where possible

## Versioning

The manifest includes a `version` field. The CLI will refuse to import archives with incompatible versions.

## Safety

- Imports to production require `--allow-prod` flag
- Dry-run mode is default for safety
- All imports are validated against schemas before execution

