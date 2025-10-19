# Phase 26: Mod Marketplace & Creator Portal

## Overview

Phase 26 implements a secure, deterministic Mod Marketplace & Creator Portal on top of the existing mod system (Phase 22) and authoring capabilities (Phase 20). This includes creator onboarding, pack upload/review/certification, dependency resolution, compatibility matrix, ratings & telemetry summaries, safe distribution (signed packages), and takedown/moderation workflows.

## Key Features

### Creator Accounts & Onboarding
- Creator profile with namespace ownership (maps to `manifest.namespace`)
- Verification workflow (email + manual approval toggle)
- Terms acceptance and content policy acknowledgment logs

### Pack Registry & Versioning
- Public registry of certified packs with:
  - Namespace, versions, dependencies
  - Capabilities (declared hooks)
  - Compatibility (`awf_core` semver)
  - Hashes and signatures
- Status states: `draft` → `submitted` → `reviewing` → `certified` → `listed` (or `rejected`)

### Upload, CI, and Certification Pipeline
- Upload ZIP → run mods linter (Phase 22), playtest subset (Phase 9 harness), and security scan
- Deterministic artifact build: normalize JSON ordering, compute package hash, sign with server key
- Store SBOM (manifest of contents + checksums)
- Human reviewer UI to approve/reject with reasons; auto-certify path for trusted creators

### Dependencies & Compatibility
- Dependency graph solver (semantic version ranges; detect conflicts/cycles)
- Compatibility matrix by AWF core version (from `awf_core` in manifest)
- Install plan generator: ordered list of packs with checks for token budgets (per-namespace caps)

### Distribution
- Signed package download URLs with short-lived tokens (mTLS or HMAC)
- Rate-limited downloads; per-namespace quotas; revoke on takedown
- Integrity validation on install (hash + signature)

### Ratings, Quality & Telemetry Summaries
- 1–5 star ratings + tags (e.g., "lore-rich", "combat-heavy") with k-anonymity ≥10
- Public metrics snapshot (aggregated from Phase 24 rollups):
  - Adoption count, error/violation rate
  - Avg acts/turn, token budget usage
  - P95 turn latency delta vs baseline
- Abuse prevention: one rating per user per version; RBAC + audit

### Moderation & Takedowns
- Report flow: users/ops can file reports; queue for review
- Actions: warn, delist, decertify
- Takedown banner shows in portal; installs blocked; existing installs warned via admin notes feed

## Database Schema

### New Tables

#### `creators`
- `creator_id` (PK): UUID primary key
- `display_name`: Creator's display name
- `email_hash`: Hashed email for privacy
- `verified`: Boolean verification status
- `terms_accepted_at`: Timestamp of terms acceptance
- `notes`: Admin notes
- `created_at`, `updated_at`: Timestamps

#### `creator_namespaces`
- `namespace` (PK): Namespace string
- `creator_id` (FK): Reference to creators table
- `verified`: Boolean namespace verification
- `created_at`, `updated_at`: Timestamps

#### `mod_pack_registry`
- `namespace` (FK): Reference to creator_namespaces
- `version`: Semantic version string
- `status`: Enum (draft|submitted|reviewing|certified|listed|rejected|delisted|decertified)
- `manifest`: JSONB manifest data
- `sbom`: JSONB Software Bill of Materials
- `hash`: Package integrity hash
- `signature`: Digital signature
- `awf_core_range`: Compatible AWF core versions
- `deps`: JSONB dependencies
- `review_notes`: Reviewer notes
- `created_at`, `updated_at`: Timestamps
- Primary Key: (namespace, version)

#### `mod_ratings`
- `namespace`: Pack namespace
- `version`: Pack version
- `user_hash`: Hashed user identifier
- `stars`: Integer rating (1-5)
- `tags`: Array of rating tags
- `comment`: Optional comment
- `created_at`: Timestamp
- Primary Key: (namespace, version, user_hash)

#### `mod_reports`
- `report_id` (PK): UUID primary key
- `namespace`: Pack namespace
- `version`: Pack version
- `reporter_hash`: Hashed reporter identifier
- `reason`: Report reason
- `details`: JSONB report details
- `status`: Enum (open|triage|resolved|rejected)
- `action`: Enum (none|warn|delist|decertify)
- `created_at`, `updated_at`: Timestamps

#### `mod_download_tokens`
- `token` (PK): Token string
- `namespace`: Pack namespace
- `version`: Pack version
- `expires_at`: Token expiration
- `scopes`: Array of token scopes
- `issued_to`: Issuer identifier
- `used`: Boolean usage status
- `created_at`, `updated_at`: Timestamps

### Indexes
- `idx_creators_verified`: On `creators.verified`
- `idx_creator_namespaces_creator_id`: On `creator_namespaces.creator_id`
- `idx_mod_pack_registry_status`: On `mod_pack_registry.status`
- `idx_mod_pack_registry_awf_core`: On `mod_pack_registry.awf_core_range`
- `idx_mod_ratings_namespace_version`: On `mod_ratings.namespace, version`
- `idx_mod_reports_status`: On `mod_reports.status`
- `idx_mod_download_tokens_expires`: On `mod_download_tokens.expires_at`

### RLS Policies
- Creators can see their own drafts
- Public can read listed+certified metadata only
- Admin can access all data
- Ratings respect k-anonymity requirements

## Backend Implementation

### Creator Service (`backend/src/marketplace/creator-service.ts`)
- Namespace claim/verification
- Terms logging
- Profile CRUD operations
- Creator verification workflow

### Pack Pipeline Service (`backend/src/marketplace/pack-pipeline.ts`)
- Upload → lint → playtest → security scan
- Build SBOM → compute hash → sign
- Submit for review → certify/list
- Deterministic artifact creation

### Dependency Solver Service (`backend/src/marketplace/dep-solver.ts`)
- Resolve semver ranges
- Detect cycles/conflicts
- Output install plan
- Validate token budgets

### Distribution Service (`backend/src/marketplace/distribution.ts`)
- Issue short-lived download tokens
- Sign URLs
- Verify signature/hash at install
- Revoke on takedown

### Moderation Service (`backend/src/marketplace/moderation.ts`)
- Reports triage
- Actions: warn/delist/decertify
- Notify creators
- Write audit logs

### Metrics Summaries Service (`backend/src/marketplace/metrics-summaries.ts`)
- Query Phase 24 rollups
- Compute per-pack snapshots
- Generate telemetry summaries

### API Routes (`backend/src/routes/awf-marketplace.ts`)

#### Creator Endpoints
- `POST /creator/onboard`: Creator onboarding
- `POST /namespace/claim`: Namespace claim
- `GET /my/packs`: Creator's packs
- `POST /pack/upload`: Pack upload
- `POST /pack/submit`: Submit for review
- `GET /pack/:ns/:ver/status`: Pack status
- `GET /pack/:ns/:ver/metrics`: Pack metrics
- `POST /pack/:ns/:ver/delist`: Delist pack

#### Admin Endpoints
- `POST /pack/:ns/:ver/review`: Review pack
- `POST /pack/:ns/:ver/certify`: Certify pack
- `POST /pack/:ns/:ver/takedown`: Takedown pack
- `POST /token/issue`: Issue download token
- `GET /reports`: Get reports
- `POST /reports/:id/resolve`: Resolve report

#### Public Endpoints
- `GET /registry`: Browse registry
- `GET /pack/:ns`: Pack versions/status
- `GET /pack/:ns/:ver`: Pack manifest
- `GET /pack/:ns/:ver/metrics`: Public metrics

## Frontend Implementation

### Creator Portal UI
- **Dashboard**: Namespace status, pack list, certification pipeline stages, metrics cards
- **New Release Wizard**: Upload ZIP → automated checks → show lints/playtests → submit for review
- **Pack Detail**: Version timeline, dependency graph, metrics snapshot, ratings & feedback, download tokens

### Admin Review UI
- **Review Queue**: Pending reviews with diffs, lints, playtest results
- **Approve/Reject**: Review actions with notes
- **Takedown Actions**: Moderation tools

### Registry Browser
- **Filter by Tags**: Content filtering
- **AWF Core Compatibility**: Version compatibility
- **Popularity**: Sort by adoption metrics
- **Metadata Only**: No sensitive data exposure

## Security & Integrity

### Signing & Distribution
- Sign artifacts with server private key
- Verify on install
- Rotate keys (Phase 25 ops)
- Short-lived signed URLs with HMAC/mTLS
- Rate limits on downloads

### Privacy & Anonymity
- PII-safe ratings (hashed ids)
- K-anonymity for public metrics (≥10 users)
- Spam/abuse prevention: cooldowns, captcha (config flag)
- Moderation queue for content review

### Access Control
- RBAC: creator/editor/admin roles
- All actions audited (Phase 7)
- Namespace ownership verification
- Token-based download access

## Observability

### Metrics
- `awf.marketplace.uploads`: Upload count
- `awf.marketplace.certified`: Certification count
- `awf.marketplace.delisted`: Delisting count
- `awf.marketplace.downloads`: Download count
- `awf.marketplace.failed_installs`: Failed install count
- `awf.marketplace.dep_conflicts`: Dependency conflicts
- `awf.marketplace.playtest_fail_rate`: Playtest failure rate

### Structured Logs
- Reviewer decisions
- Signatures/hashes
- Dependency conflicts
- Moderation actions
- Token issuance/revocation

## Configuration

### Environment Variables
```bash
MARKETPLACE_ENABLED=true
MARKETPLACE_SIGNING_KEY_PATH=/secrets/marketplace_signing.pem
MARKETPLACE_URL_TTL_SECONDS=300
MARKETPLACE_MAX_UPLOAD_MB=50
MARKETPLACE_KANON_MIN=10
MARKETPLACE_AUTO_CERTIFY_TRUSTED=false
```

## Testing

### Unit Tests
- Dep solver (conflicts, ranges, cycles)
- Signature verify/rotate
- Token issuance & expiry
- Linter/playtest pipeline state transitions

### Integration Tests
- Creator onboarding → namespace claim → upload → pipeline → certify → list
- Dependency graph with 3 packs; generate install plan; detect conflict
- Takedown flow: delist + token revoke; existing installs blocked from updating

### E2E Tests (Mock)
- Public registry browse; metrics snapshots respect k-anonymity
- Admin review approves, signs, and lists
- Download works and verifies

### Performance
- Pipeline end-to-end target: ≤ 90s for typical pack

## Migration Plan

### Phase 1: Database Schema
1. Create marketplace tables
2. Add indexes and RLS policies
3. Test schema with sample data

### Phase 2: Backend Services
1. Implement creator service
2. Implement pack pipeline service
3. Implement dependency solver service
4. Implement distribution service
5. Implement moderation service
6. Implement metrics summaries service

### Phase 3: API Routes
1. Create marketplace API routes
2. Implement RBAC and auditing
3. Test all endpoints

### Phase 4: Frontend UI
1. Create creator portal
2. Create admin review UI
3. Create registry browser
4. Test all user flows

### Phase 5: Testing & Documentation
1. Write comprehensive tests
2. Update documentation
3. Performance testing
4. Security audit

## Definition of Done

- [ ] Creator accounts + namespace ownership with terms logging
- [ ] Pack upload → lint/playtest/security scan → signed artifact → review → certify/list
- [ ] Dependency solver + compatibility matrix; install plan generator
- [ ] Signed distribution with revocation; takedown/moderation workflows
- [ ] Ratings & metrics snapshots (PII-safe; k-anonymity)
- [ ] Admin & Creator UIs live; APIs RBAC'd & audited
- [ ] Metrics emitted; tests pass; CI/lint/format clean; docs complete
- [ ] No player-UI changes

## Security Considerations

### Data Protection
- All PII is hashed or encrypted
- K-anonymity enforced for public metrics
- Audit logs for all actions
- Secure key management

### Content Moderation
- Automated content scanning
- Human review process
- Report and takedown workflows
- Creator notification system

### Access Control
- Role-based permissions
- Namespace ownership verification
- Token-based access with expiration
- Rate limiting and quotas

## Future Enhancements

### Revenue System
- Creator revenue sharing
- Premium pack features
- Subscription models
- Payment processing

### Advanced Features
- Pack dependencies visualization
- Automated compatibility testing
- A/B testing for pack features
- Advanced analytics dashboard

### Community Features
- Creator forums
- Pack collaboration tools
- Community voting
- Featured pack system

## Conclusion

Phase 26 establishes a comprehensive Mod Marketplace & Creator Portal that enables secure, deterministic mod distribution while maintaining high standards for content quality and user safety. The system provides creators with powerful tools for pack management while ensuring players receive high-quality, compatible content through a robust review and certification process.
