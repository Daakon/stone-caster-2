# Phase 2: AWF Bundle Migration - Admin UI Mapping

This document outlines the implementation of Phase 2 for the AWF (Adventure World Format) bundle migration. This phase focuses on mapping the existing Admin UI to support the new versioned AWF documents without changing any player-facing functionality.

## Overview

Phase 2 reuses the existing Admin "layers" editor to manage the new versioned AWF documents. The admin interface now supports creating, editing, validating, and managing Core Contracts, Worlds, Adventures, and Adventure Starts with proper versioning, hashing, and validation.

## Admin UI Structure

### Navigation

The admin interface now includes four new tabs in the navigation:

- **Core Contracts** (`/admin/awf/core-contracts`) - Manage versioned core contract documents
- **Worlds** (`/admin/awf/worlds`) - Manage versioned world documents  
- **Adventures** (`/admin/awf/adventures`) - Manage versioned adventure documents
- **Adventure Starts** (`/admin/awf/adventure-starts`) - Manage adventure start documents

### Document Management

Each document type follows the same pattern:

1. **List View** - Shows all documents with key metadata
2. **Editor Form** - Create/edit documents with validation
3. **Import/Export** - JSON file import/export functionality
4. **Validation** - Real-time validation with error display

## Document Types & Fields

### Core Contracts

**Fields:**
- `id` (text) - Contract identifier (e.g., "core.contract.v4")
- `version` (text) - Version string (e.g., "v4")
- `doc` (JSON editor) - Contract document content
- `hash` (read-only) - Computed SHA-256 hash
- `active` (checkbox) - Whether this is the active contract

**Validation:**
- Uses `CoreContractSchema` from Phase 1
- Validates contract structure, acts, and memory fields
- Computes hash using stable JSON stringification

**Special Features:**
- Only one contract can be active at a time
- Activate button to set active status
- Prevents deletion of the only active contract

### Worlds

**Fields:**
- `id` (text) - World identifier (e.g., "world.mystika")
- `version` (text) - Version string (e.g., "v1")
- `doc` (JSON editor) - World document content
- `hash` (read-only) - Computed SHA-256 hash
- `slices` (tag input) - Named subsets for token reduction

**Validation:**
- Uses `WorldSchema` from Phase 1
- Validates world structure, timeworld, and slices
- Slices are stored in `doc.slices` array

**Special Features:**
- Slices editor with add/remove functionality
- Helper text explaining slices purpose
- Slices persist in document under `doc.slices`

### Adventures

**Fields:**
- `id` (text) - Adventure identifier (e.g., "adv.whispercross")
- `world_ref` (select) - Reference to existing world
- `version` (text) - Version string (e.g., "v1")
- `doc` (JSON editor) - Adventure document content
- `hash` (read-only) - Computed SHA-256 hash
- `slices` (tag input) - Named subsets for token reduction

**Validation:**
- Uses `AdventureSchema` from Phase 1
- Validates adventure structure, locations, objectives, NPCs
- Enforces valid `world_ref` reference
- Slices are stored in `doc.slices` array

**Special Features:**
- World reference dropdown with validation
- Warning if selected world doesn't exist
- Slices editor with add/remove functionality
- Prevents save if world_ref is invalid

### Adventure Starts

**Fields:**
- `adventure_ref` (select) - Reference to existing adventure
- `doc` (JSON editor) - Adventure start document content
- `use_once` (checkbox) - Whether this start can only be used once

**Validation:**
- Uses `AdventureStartSchema` from Phase 1
- Validates start structure and rules
- Enforces valid `adventure_ref` reference

**Special Features:**
- Adventure reference dropdown with validation
- Warning if selected adventure doesn't exist
- Prevents save if adventure_ref is invalid

## Validation & Hashing

### Document Validation

All documents are validated using the Phase 1 Zod schemas:

- **Core Contracts**: `CoreContractSchema` - Validates contract structure, acts, memory
- **Worlds**: `WorldSchema` - Validates world structure, timeworld, slices
- **Adventures**: `AdventureSchema` - Validates adventure structure, world_ref, locations, objectives, NPCs
- **Adventure Starts**: `AdventureStartSchema` - Validates start structure, rules

### Content Hashing

All documents use SHA-256 hashing with stable JSON stringification:

- Keys are sorted for consistent ordering
- No whitespace in JSON output
- Same document content always produces the same hash
- Hash is computed on save and stored in database

### Error Handling

- **Validation Errors**: Displayed inline with specific error messages
- **Network Errors**: Toast notifications for API failures
- **Form Validation**: Real-time validation with error highlighting

## Active Core Contract Management

### Single Active Contract

Only one core contract can be active at a time:

1. **Activation**: Click "Activate" button on any contract
2. **Automatic Deactivation**: All other contracts are automatically deactivated
3. **Database Update**: Single transaction ensures consistency
4. **UI Update**: Active status is immediately reflected in the UI

### Protection Rules

- **Prevent Deletion**: Cannot delete the only active contract
- **Hard Error**: Clear error message if deletion is attempted
- **UI Indication**: Active contracts are clearly marked with badges

## JSON Import/Export

### Export Functionality

Each document can be exported as a JSON file:

- **Filename Format**: `{id}.{version}.json` (e.g., `core.contract.v4.json`)
- **Content**: Document metadata + full document content
- **Download**: Automatic file download via browser

### Import Functionality

JSON files can be imported to prefill editors:

- **File Selection**: Choose JSON file from local filesystem
- **Validation**: File is parsed and validated before import
- **Prefill**: Editor is populated with imported data
- **Review**: User can review and modify before saving

### Import/Export Format

```json
{
  "id": "core.contract.v4",
  "version": "v4",
  "hash": "abc123...",
  "doc": {
    "contract": {
      "version": "v4",
      "name": "Test Contract",
      "description": "A test contract"
    },
    "acts": {
      "allowed": ["move", "interact"]
    }
  }
}
```

## Slices Management

### Purpose

Slices are named subsets that the runtime can request to reduce tokens:

- **Examples**: `timekeeping`, `whispercross_region`, `encounter_forest_edge`
- **Storage**: Stored in `doc.slices` as array of strings
- **Usage**: Runtime can request specific slices to reduce token usage

### Editor Interface

- **Tag Input**: Add new slices with enter key or button
- **Remove**: Click X on any slice to remove it
- **Validation**: No duplicate slices allowed
- **Helper Text**: Explains purpose and provides examples

### Persistence

- **World Documents**: Slices stored in `doc.slices`
- **Adventure Documents**: Slices stored in `doc.slices`
- **Round-trip**: Create → Save → Read back maintains slices

## Adventure ↔ World Linkage

### World Reference Validation

Adventures must reference existing worlds:

1. **Dropdown Selection**: Choose from list of existing worlds
2. **Real-time Validation**: Warning shown if world doesn't exist
3. **Save Prevention**: Cannot save with invalid world reference
4. **Error Display**: Clear error messages for invalid references

### UI Indicators

- **World Badge**: Shows linked world name and version
- **Warning Alerts**: Red alert if world reference is invalid
- **Validation Errors**: Specific error messages for missing worlds

## RBAC & Audit Logs

### Role-Based Access Control

- **Admin Role Required**: Only `prompt_admin` role can access AWF documents
- **Existing RBAC**: Reuses current admin authentication system
- **Permission Check**: Verified on every API request

### Audit Logging

All admin actions are logged:

- **Actions Tracked**: `upsert`, `activate`, `import`, `export`
- **Metadata**: User, document type, ID, version, timestamp
- **Database**: Stored in audit log table for compliance

## API Endpoints

### Core Contracts

- `GET /api/admin/awf/core-contracts` - List all contracts
- `POST /api/admin/awf/core-contracts` - Create/update contract
- `PATCH /api/admin/awf/core-contracts/:id/:version/activate` - Activate contract

### Worlds

- `GET /api/admin/awf/worlds` - List all worlds
- `POST /api/admin/awf/worlds` - Create/update world

### Adventures

- `GET /api/admin/awf/adventures` - List all adventures
- `POST /api/admin/awf/adventures` - Create/update adventure

### Adventure Starts

- `GET /api/admin/awf/adventure-starts` - List all adventure starts
- `POST /api/admin/awf/adventure-starts` - Create/update adventure start

## Testing

### Unit Tests

- **Validation Tests**: Test all document validators with valid/invalid inputs
- **Hashing Tests**: Test hash computation and consistency
- **Active Core Tests**: Test single active contract enforcement
- **World Reference Tests**: Test adventure-world linkage validation
- **Slices Tests**: Test slices round-trip persistence

### Integration Tests

- **Admin Flow**: Create world → create adventure → create start
- **Validation Flow**: Test validation errors and error handling
- **Import/Export Flow**: Test JSON import/export functionality
- **Active Contract Flow**: Test activation and deactivation

## Usage Examples

### Creating a Core Contract

1. Navigate to Core Contracts tab
2. Click "New Contract"
3. Fill in ID, version, and document JSON
4. Check "Active" if this should be the active contract
5. Click "Save" - document is validated and hashed
6. Success message confirms creation

### Creating a World with Slices

1. Navigate to Worlds tab
2. Click "New World"
3. Fill in ID, version, and document JSON
4. Add slices using the tag input (e.g., "timekeeping", "magic_system")
5. Click "Save" - slices are stored in `doc.slices`
6. Success message confirms creation

### Creating an Adventure Linked to World

1. Navigate to Adventures tab
2. Click "New Adventure"
3. Fill in ID, version, and document JSON
4. Select world from dropdown (must exist)
5. Add slices if needed
6. Click "Save" - world reference is validated
7. Success message confirms creation

### Activating a Core Contract

1. Navigate to Core Contracts tab
2. Find the contract to activate
3. Click "Activate" button
4. All other contracts are automatically deactivated
5. Active badge appears on the activated contract
6. Success message confirms activation

### Importing/Exporting Documents

1. **Export**: Click "Export" button on any document
2. **Import**: Click "Import" button, select JSON file
3. **Review**: Editor is prefilled with imported data
4. **Save**: Click "Save" to persist imported document

## Rollback Instructions

To rollback Phase 2 changes:

1. **Remove Frontend Routes**: Delete AWF admin page components
2. **Remove Backend Routes**: Delete AWF admin API endpoints
3. **Remove Navigation**: Remove AWF tabs from admin navigation
4. **Remove Service**: Delete AWF admin service
5. **Database**: AWF tables remain (Phase 1 data model)

## Next Steps

Phase 2 provides the admin interface for:

- **Phase 3**: Bundle assembly logic using injection maps
- **Phase 4**: Act application system with session management
- **Phase 5**: Integration with existing turn processing
- **Phase 6**: Performance optimization and monitoring

The admin interface is now ready for managing AWF documents with full validation, hashing, and versioning support.


