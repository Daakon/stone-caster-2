# Admin Update Plan

## Phase 2 — Admin Shell & Navigation (Role-Gated) ✅ COMPLETE

### Objectives
- [x] Implement new admin navigation and route guards
- [x] Create role-gated access control using app_roles
- [x] Build placeholder pages for each admin section
- [x] Implement proper role hierarchy (Creator → Moderator → Admin)

### Deliverables Completed

#### Core Components
- [x] `src/admin/AppAdminShell.tsx` — Top-level admin layout with sidebar navigation
- [x] `src/admin/routeGuard.tsx` — Role guards and useAppRoles hook
- [x] `src/admin/AdminRoutes.tsx` — Route configuration with guards
- [x] `src/admin/components/AdminNav.tsx` — Navigation component with role filtering
- [x] `src/admin/components/RoleBadge.tsx` — User role display component

#### Admin Pages
- [x] `src/pages/admin/index.tsx` — Admin home dashboard
- [x] `src/pages/admin/entry-points/index.tsx` — Entry points placeholder
- [x] `src/pages/admin/prompt-segments/index.tsx` — Prompt segments placeholder
- [x] `src/pages/admin/npcs/index.tsx` — NPCs placeholder
- [x] `src/pages/admin/reviews/index.tsx` — Reviews (gated: moderator|admin)
- [x] `src/pages/admin/reports/index.tsx` — Reports (gated: moderator|admin)
- [x] `src/pages/admin/roles/index.tsx` — Roles (gated: admin)

#### Tests
- [x] `tests/admin/nav.spec.tsx` — Navigation rendering tests
- [x] `tests/admin/guards.spec.tsx` — Route protection tests

### Navigation Structure
```
Home (any)
├── Entry Points (any)
├── Prompt Segments (any)
├── NPCs (any)
├── Reviews (moderator|admin)
├── Reports (moderator|admin)
└── Roles (admin)
```

### Role Permissions
- **Creator**: Home, Entry Points, Prompt Segments, NPCs
- **Moderator**: All creator permissions + Reviews, Reports
- **Admin**: All permissions + Roles management

### Key Features Implemented
1. **Role-based Navigation**: Navigation items filtered by user role
2. **Route Guards**: Protected routes with proper access control
3. **Role Badge**: Visual indication of user's role level
4. **Placeholder Pages**: Each section shows schema info and next phase plans
5. **Error Handling**: Proper loading states and error boundaries
6. **Responsive Design**: Mobile-first admin interface

### Schema Integration
Each placeholder page includes:
- Key database fields from target schema
- Related table relationships
- Implementation roadmap for next phases
- Role-specific content and features

### Discovered Gaps
1. **Feature Flags**: Reports section needs feature flag implementation
2. **Role Caching**: Role state could be optimized with better caching
3. **Breadcrumbs**: Navigation breadcrumbs not implemented
4. **Search**: No global search functionality yet
5. **Notifications**: No notification system for pending reviews

## Phase 3 — Entry Points CRUD + Segments + NPC Bindings ✅ COMPLETE

### Objectives
- [x] Implement full CRUD interface for entry points
- [x] Create inline management for prompt segments and NPC bindings
- [x] Implement submit for review workflow
- [x] Add role-based lifecycle management
- [x] Create comprehensive test coverage

### Deliverables Completed

#### Services & API
- [x] `src/services/admin.entryPoints.ts` — Entry points CRUD operations
- [x] `src/services/admin.segments.ts` — Prompt segments management
- [x] `src/services/admin.npcBindings.ts` — NPC bindings management

#### Pages & Components
- [x] `src/pages/admin/entry-points/index.tsx` — Entry points list with filters
- [x] `src/pages/admin/entry-points/[id].tsx` — Edit/create page with tabs
- [x] `src/admin/components/EntryPointForm.tsx` — Form component with validation
- [x] `src/admin/components/EntryPointSegmentsTab.tsx` — Segments inline CRUD
- [x] `src/admin/components/EntryPointNpcsTab.tsx` — NPC bindings inline CRUD
- [x] `src/admin/components/SubmitForReviewButton.tsx` — Submit for review
- [x] `src/admin/components/ModerationButtons.tsx` — Stubbed moderation actions

#### Tests
- [x] `tests/admin/entry_points.list.spec.tsx` — List view tests
- [x] `tests/admin/entry_points.edit.spec.tsx` — Edit form tests
- [x] `tests/services/admin.entryPoints.spec.ts` — Service layer tests

### Key Features Implemented

#### Entry Points Management
1. **List View**: Filterable table with search, lifecycle, visibility, and world filters
2. **CRUD Operations**: Create, read, update, delete entry points
3. **Role-based Lifecycle**: Creators can't set active, moderators can manage all states
4. **Submit for Review**: Creators can submit drafts for moderation
5. **Form Validation**: Comprehensive validation with Zod schemas

#### Prompt Segments
1. **Scoped Management**: Segments scoped to entry and entry_start
2. **Inline CRUD**: Add, edit, delete segments within entry point
3. **Version Control**: Semantic versioning for segments
4. **Metadata Management**: JSON metadata with validation
5. **Active Toggle**: Enable/disable segments

#### NPC Bindings
1. **World Consistency**: Only NPCs from same world can be bound
2. **Role Configuration**: Set role hints and weights for NPCs
3. **Binding Management**: Add, edit, remove NPC bindings
4. **Typeahead Selection**: Search and select NPCs from world

#### Submit for Review
1. **Confirmation Dialog**: User-friendly submission process
2. **Lifecycle Update**: Changes lifecycle to pending_review
3. **Review Creation**: Creates content_reviews row
4. **Idempotent**: Prevents duplicate submissions

### Role-based Access Control
- **Creators**: Can create, edit drafts, submit for review
- **Moderators**: Can manage all lifecycle states, see moderation buttons
- **Admins**: Full access to all features and lifecycle management

### Form Features
1. **Dynamic Validation**: Real-time validation with helpful error messages
2. **Tag Management**: Add/remove tags with 10-tag limit
3. **Lifecycle Restrictions**: UI prevents creators from setting active
4. **World/Ruleset Selection**: Typeahead selection from available options
5. **Metadata Editor**: JSON editor with validation for segments

### Test Coverage
- **Unit Tests**: Service layer with mocked Supabase calls
- **Component Tests**: Form validation, role-based UI, error handling
- **Integration Tests**: Full CRUD workflows, role permissions
- **Error Scenarios**: Network failures, validation errors, permission denied

### Technical Implementation
- **Zod Validation**: Type-safe form validation
- **React Hook Form**: Efficient form state management
- **Supabase Integration**: Direct database operations with RLS
- **Role Caching**: Optimized role state management
- **Error Boundaries**: Graceful error handling throughout

## Phase 4 — Global Prompt Segments (All Scopes) ✅ COMPLETE

### Objectives
- [x] Implement standalone Prompt Segments screen for all scopes
- [x] Add search, filtering, and advanced metadata management
- [x] Implement i18n support with locale management
- [x] Add duplicate detection and bulk operations
- [x] Create comprehensive test coverage

### Deliverables Completed

#### Services & API
- [x] Extended `src/services/admin.segments.ts` — Global CRUD with advanced filtering
- [x] `src/services/admin.refs.ts` — Reference lookup helpers for pickers

#### Pages & Components
- [x] `src/pages/admin/prompt-segments/index.tsx` — Global segments list with advanced filters
- [x] `src/admin/components/SegmentFormModal.tsx` — Create/edit modal with validation
- [x] `src/admin/components/SegmentMetadataEditor.tsx` — JSON editor with schema hints
- [x] `src/admin/components/RefIdPicker.tsx` — Polymorphic picker for ref IDs
- [x] `src/admin/components/SegmentBulkBar.tsx` — Bulk operations toolbar

#### Tests
- [x] `tests/admin/prompt_segments.list.spec.tsx` — List view and filtering tests
- [x] `tests/admin/prompt_segments.crud.spec.tsx` — CRUD and validation tests
- [x] `tests/services/admin.segments.spec.ts` — Service layer comprehensive tests

### Key Features Implemented

#### Global Segments Management
1. **Multi-Scope Support**: All scopes (core, ruleset, world, entry, entry_start, npc, game_state, player, rng, input)
2. **Advanced Filtering**: Scope, status, locale, reference type with typeahead
3. **Search Functionality**: Full-text search across content with fallback
4. **Pagination**: Cursor-based pagination for large datasets
5. **Bulk Operations**: Activate/deactivate, export/import with JSON support

#### Form & Validation
1. **Smart Form**: Dynamic fields based on scope selection
2. **Reference Picker**: Polymorphic picker for worlds, rulesets, entries, NPCs
3. **Metadata Editor**: Dual-mode (form/JSON) with schema validation
4. **Duplicate Detection**: Content hash comparison with warning system
5. **Role Restrictions**: Creator limitations for scope access

#### i18n Support
1. **Locale Management**: Filter by locale, clone to new locales
2. **Metadata Integration**: Locale badges and selection hints
3. **Fallback Support**: Default locale handling in assembler
4. **Clone Workflow**: Easy duplication for new language versions

#### Advanced Features
1. **JSON Metadata**: Rich metadata with validation and hints
2. **Version Control**: Semantic versioning with active/inactive states
3. **Bulk Export/Import**: JSON-based data portability
4. **Duplicate Guardrails**: Content similarity detection
5. **Role-Based Access**: Proper RLS integration for all operations

### Technical Implementation

#### Service Architecture
- **Global Operations**: `listSegments`, `createSegment`, `updateSegment`, `deleteSegment`
- **Advanced Filtering**: Scope, locale, status, reference type filtering
- **Search Integration**: Full-text search with ILIKE and FTS fallback
- **Bulk Operations**: Efficient batch processing for large datasets
- **Duplicate Detection**: Client and server-side content hash comparison

#### Component Design
- **Polymorphic Picker**: Single component for all reference types
- **Dual-Mode Editor**: Form and JSON modes for metadata editing
- **Smart Validation**: Real-time validation with helpful error messages
- **Bulk Toolbar**: Context-aware bulk operations interface
- **Role Integration**: Proper permission checking throughout

#### Data Management
- **Cursor Pagination**: Efficient pagination for large datasets
- **Reference Caching**: Optimized lookup for picker components
- **Locale Discovery**: Dynamic locale extraction from existing data
- **Content Hashing**: Consistent duplicate detection across sessions

### Test Coverage
- **Unit Tests**: Service layer with comprehensive mocking
- **Component Tests**: Form validation, role restrictions, error handling
- **Integration Tests**: Full CRUD workflows, bulk operations, search
- **Error Scenarios**: Network failures, validation errors, permission denied

### Role-Based Access Control
- **Creators**: Can only create entry/entry_start segments
- **Moderators**: Can manage all scopes except core/system segments
- **Admins**: Full access to all scopes and operations
- **RLS Integration**: Server-side policy enforcement for all operations

## Phase 5 — Reviews Workflow & Role Management ✅ COMPLETE

### Objectives
- [x] Implement moderation queue with filters and quick actions
- [x] Create review detail page with diff view and moderation actions
- [x] Build role management screen for assigning/removing permissions
- [x] Integrate content_reviews and app_roles tables with proper RLS
- [x] Enforce moderation flows and state transitions

### Deliverables Completed

#### Services & API
- [x] `src/services/admin.reviews.ts` — Moderation workflow with state management
- [x] `src/services/admin.roles.ts` — Role assignment and user permission management

#### Pages & Components
- [x] `src/pages/admin/reviews/index.tsx` — Moderation queue with advanced filtering
- [x] `src/pages/admin/reviews/[id].tsx` — Review detail with diff view and actions
- [x] `src/pages/admin/roles/index.tsx` — Role management with user search and assignment

#### Tests
- [x] `tests/admin/reviews.list.spec.tsx` — Queue filtering and moderation actions
- [x] `tests/admin/roles.spec.tsx` — Role CRUD and permission management

### Key Features Implemented

#### Moderation Workflow
1. **Review Queue**: Advanced filtering by state, target type, reviewer, and search
2. **Quick Actions**: One-click approve, reject, request changes with confirmation
3. **Assignment System**: "Assign to Me" functionality for reviewer management
4. **State Transitions**: Proper lifecycle updates for entry points and segments
5. **Audit Trail**: Complete action logging for moderation decisions

#### Review Detail & Diff
1. **Content Viewing**: Current content display with proper formatting
2. **Change Detection**: Simple diff viewer showing additions, removals, unchanged
3. **Moderation Actions**: Approve, reject, request changes with notes
4. **Action History**: Timeline of all review actions and decisions
5. **Role Restrictions**: Proper permission checking for moderation actions

#### Role Management
1. **User Search**: Typeahead search by email or user ID
2. **Role Assignment**: Assign creator, moderator, admin roles with validation
3. **Role Removal**: Safe role removal with self-protection (cannot remove own admin)
4. **Statistics Dashboard**: Role distribution and user activity metrics
5. **Audit Logging**: Track all role changes with actor information

#### State Management & Transitions
1. **Lifecycle Sync**: Automatic target lifecycle updates based on review decisions
2. **Permission Enforcement**: RLS policies for creator/moderator/admin access
3. **Action Validation**: Prevent unauthorized state changes and role modifications
4. **Error Handling**: Graceful degradation with proper error messages
5. **Confirmation Dialogs**: Safety checks for irreversible actions

### Technical Implementation

#### Review System Architecture
- **State Machine**: Proper review state transitions (open → approved/rejected/changes_requested)
- **Target Integration**: Seamless updates to entry_points, prompt_segments, npcs
- **Audit Trail**: Complete action logging with actor and timestamp information
- **Permission Matrix**: Role-based access control for all moderation actions
- **Search Integration**: Full-text search across review content and metadata

#### Role Management System
- **User Discovery**: Efficient user search with email/ID matching
- **Role Hierarchy**: Creator < Moderator < Admin with proper inheritance
- **Self-Protection**: Admins cannot remove their own admin role
- **Bulk Operations**: Efficient role assignment and removal processes
- **Statistics**: Real-time role distribution and user activity metrics

#### Security & Validation
- **RLS Integration**: Server-side policy enforcement for all operations
- **Permission Checks**: UI and API-level role validation
- **Action Logging**: Complete audit trail for security and compliance
- **Input Validation**: Proper validation for all user inputs and actions
- **Error Boundaries**: Graceful error handling throughout the system

### Workflow Integration

#### Content Lifecycle
1. **Creator Submission**: Entry points submitted for review (draft → pending_review)
2. **Moderator Review**: Queue management with filtering and assignment
3. **Decision Making**: Approve, reject, or request changes with feedback
4. **Lifecycle Updates**: Automatic target state updates based on decisions
5. **Notification System**: Future-ready for creator notifications

#### Role-Based Access Control
1. **Creator Permissions**: Create content, submit for review, manage own content
2. **Moderator Permissions**: Review content, approve/reject, access reports
3. **Admin Permissions**: Full system access, role management, system configuration
4. **Permission Inheritance**: Higher roles inherit lower role permissions
5. **Security Enforcement**: RLS policies prevent unauthorized access

### Test Coverage
- **Queue Management**: Filtering, search, pagination, bulk operations
- **Moderation Actions**: Approve, reject, request changes with validation
- **Role Management**: User search, role assignment, permission enforcement
- **State Transitions**: Lifecycle updates, audit logging, error handling
- **Security**: Access control, permission validation, self-protection

## Phase 6 — NPCs Catalog & Bindings (Standalone) ✅ COMPLETE

### Objectives
- [x] Deliver complete NPC management experience decoupled from Entry Points
- [x] Implement NPC catalog with world-scoped search and filters
- [x] Create NPC CRUD operations with portrait upload and JSON document editing
- [x] Build tiered prompt segments system (scope=npc, tiers 0-3)
- [x] Implement bindings to entry points with role hints and weights
- [x] Add read-only relationships view for debugging and QA

### Deliverables Completed

#### Services & API
- [x] `src/services/admin.npcs.ts` — NPC CRUD with world-scoped operations and portrait upload
- [x] `src/services/admin.npcSegments.ts` — Tiered segments management with validation and duplicate detection
- [x] `src/services/admin.npcBindings.ts` — Entry point bindings with world consistency enforcement

#### Pages & Components
- [x] `src/pages/admin/npcs/index.tsx` — NPC catalog with advanced filtering and search
- [x] `src/pages/admin/npcs/[id].tsx` — NPC edit page with tabbed interface
- [x] `src/admin/components/NpcForm.tsx` — NPC details form with portrait upload and JSON editing
- [x] `src/admin/components/NpcTierEditor.tsx` — Tiered segments editor with CRUD operations
- [x] `src/admin/components/NpcBindingsTable.tsx` — Entry point bindings management
- [x] `src/admin/components/NpcPortraitUploader.tsx` — Portrait upload with validation and preview

#### Tests
- [x] `tests/admin/npcs.list.spec.tsx` — NPC catalog filtering, search, and management operations

### Key Features Implemented

#### NPC Catalog & Management
1. **World-Scoped Operations**: NPCs filtered by world with proper isolation
2. **Advanced Search & Filtering**: Search by name/archetype, filter by world and role tags
3. **Portrait Management**: Upload, preview, and manage NPC portraits with validation
4. **JSON Document Editing**: Rich character details with JSON validation and error handling
5. **Role Tag System**: Flexible tagging system for NPC categorization and filtering

#### Tiered Segments System
1. **Four-Tier Structure**: Baseline (0), Familiar (1), Close (2), Intimate (3) with color coding
2. **Segment CRUD**: Create, edit, delete segments with proper validation
3. **Metadata Management**: Locale, kind, version tracking with JSON metadata
4. **Duplicate Detection**: Content hash comparison to prevent duplicate segments
5. **Tier Management**: Promote/demote segments between tiers with validation

#### Entry Point Bindings
1. **World Consistency**: Enforce same-world binding between NPCs and entry points
2. **Role Hints**: Descriptive role assignments (Mentor, Guide, Companion, etc.)
3. **Weight System**: Numerical weight system (1-10) for binding prominence
4. **Duplicate Prevention**: Unique constraint enforcement for binding relationships
5. **Binding Management**: Add, edit, remove bindings with proper validation

#### User Experience & Interface
1. **Tabbed Interface**: Organized tabs for Details, Segments, Bindings, Relationships
2. **Visual Tier System**: Color-coded tier badges and organized segment display
3. **Portrait Preview**: Image preview with upload progress and error handling
4. **Responsive Design**: Mobile-first interface with proper responsive behavior
5. **Permission-Based UI**: Role-based access control with appropriate UI restrictions

### Technical Implementation

#### NPC Management Architecture
- **World Isolation**: Proper world-scoped operations with RLS enforcement
- **Portrait Storage**: Supabase Storage integration with public URL generation
- **JSON Validation**: Client-side JSON validation with helpful error messages
- **Role Tag System**: Dynamic tag management with autocomplete and filtering
- **Binding Validation**: Server-side validation for world consistency and uniqueness

#### Tiered Segments System
- **Tier Hierarchy**: Four-tier system with proper validation and color coding
- **Metadata Structure**: Flexible JSON metadata with locale and kind tracking
- **Duplicate Detection**: Content hash comparison for duplicate prevention
- **Version Management**: Semantic versioning for segment updates
- **Active State Management**: Toggle active/inactive segments with proper validation

#### Entry Point Bindings
- **World Consistency**: Automatic validation of world matching between NPCs and entry points
- **Role Assignment**: Flexible role hint system for descriptive binding purposes
- **Weight Management**: Numerical weight system for binding prominence
- **Unique Constraints**: Database-level uniqueness enforcement for binding relationships
- **Cascade Operations**: Proper handling of binding deletion and cleanup

#### Security & Validation
- **RLS Integration**: Row-level security for proper access control
- **Permission Matrix**: Role-based access control (Creator < Moderator < Admin)
- **Input Validation**: Comprehensive validation for all user inputs
- **File Upload Security**: File type and size validation for portrait uploads
- **JSON Validation**: Proper JSON parsing and validation with error handling

### Workflow Integration

#### NPC Lifecycle Management
1. **Creation**: World-scoped NPC creation with proper validation
2. **Editing**: Rich editing interface with portrait and document management
3. **Segments**: Tiered segment management with proper validation
4. **Bindings**: Entry point association with role and weight assignment
5. **Deletion**: Safe deletion with binding count checks and force delete options

#### Content Management
1. **Portrait Upload**: Secure file upload with validation and preview
2. **JSON Documents**: Rich character details with validation and error handling
3. **Role Tags**: Flexible categorization system for NPC organization
4. **Tiered Content**: Organized segment management with tier-based access
5. **Binding Management**: Entry point association with proper validation

#### User Experience
1. **Catalog View**: Advanced filtering and search with pagination
2. **Detail View**: Tabbed interface for organized content management
3. **Form Validation**: Real-time validation with helpful error messages
4. **Permission Awareness**: UI adapts based on user role and permissions
5. **Responsive Design**: Mobile-first interface for all screen sizes

### Test Coverage
- **Catalog Management**: Filtering, search, pagination, and CRUD operations
- **Form Validation**: Input validation, JSON parsing, and error handling
- **Portrait Upload**: File validation, upload progress, and error handling
- **Segment Management**: Tier CRUD, validation, and duplicate detection
- **Binding Operations**: Add, edit, remove bindings with world consistency
- **Permission Enforcement**: Role-based access control and UI restrictions

## Phase 7 — Admin: Reports & Analytics + Legacy Cleanup ✅ COMPLETE

### Objectives
- [x] Implement reports queue for content_reports triage and resolution
- [x] Create analytics dashboard with community and gameplay health metrics
- [x] Remove legacy admin routes/components/APIs per ADMIN_DELETE_LIST.md
- [x] Add resolved fields to content_reports with audit trail
- [x] Implement retention policies and privacy controls

### Deliverables Completed

#### Database Migration
- [x] `supabase/migrations/20250130_reports_analytics.sql` — Add resolved fields and analytics views
- [x] Added `resolved`, `resolved_by`, `resolved_at` columns to content_reports
- [x] Created analytics views for daily metrics (submissions, approvals, games, tokens)
- [x] Added RLS policies for reports and analytics access
- [x] Created helper functions for moderator/admin role checking

#### Reports Management
- [x] `src/services/admin.reports.ts` — Complete reports service with CRUD operations
- [x] `src/pages/admin/reports/index.tsx` — Reports queue with filters and bulk actions
- [x] `src/pages/admin/reports/[id].tsx` — Report detail with resolution workflow
- [x] `src/admin/components/ReportsTable.tsx` — Reports table with filtering and selection
- [x] `src/admin/components/ReportDetail.tsx` — Report detail view with action panel

#### Analytics Dashboard
- [x] `src/services/admin.analytics.ts` — Analytics service with KPI and chart data
- [x] `src/pages/admin/analytics/index.tsx` — Analytics dashboard with metrics
- [x] `src/admin/components/AnalyticsCards.tsx` — KPI cards for overview metrics
- [x] `src/admin/components/AnalyticsCharts.tsx` — Daily trends and performance charts

#### Legacy Cleanup
- [x] `scripts/admin/verify_no_legacy_imports.ts` — Verification script for legacy imports
- [x] `scripts/admin/cleanup_legacy.ts` — Safe cleanup script for legacy code
- [x] Removed old admin routes and components
- [x] Updated App.tsx to remove legacy AdminRouter references
- [x] Cleaned up old test files and service references

#### Tests
- [x] `tests/admin/reports.list.spec.tsx` — Reports queue functionality tests
- [x] `tests/admin/analytics.spec.tsx` — Analytics dashboard tests
- [x] `tests/services/admin.reports.spec.ts` — Reports service tests
- [x] `tests/services/admin.analytics.spec.ts` — Analytics service tests

### Key Features Implemented

#### Reports Management System
1. **Queue Management**: Advanced filtering by state, target type, and time period
2. **Bulk Operations**: Multi-select and bulk resolve with audit trail
3. **Resolution Workflow**: Single and bulk resolution with notes and timestamps
4. **PII Protection**: Content masking for privacy in report previews
5. **Audit Trail**: Complete resolution history with moderator actions

#### Analytics Dashboard
1. **KPI Cards**: Active entries, pending reviews, SLA metrics, games started, tokens used
2. **Daily Trends**: Configurable charts for submissions, approvals, games, and tokens
3. **Performance Metrics**: Review SLA tracking with time-based analysis
4. **Community Health**: Creator activity and content quality metrics
5. **System Status**: Database and service health monitoring

#### Legacy Cleanup
1. **Safe Removal**: Backup and verification before deletion
2. **Import Verification**: Automated checking for legacy import references
3. **Route Cleanup**: Removal of old admin routes and components
4. **Service Cleanup**: Removal of deprecated admin services
5. **Test Cleanup**: Removal of outdated test files

### Technical Implementation

#### Reports Architecture
- **Database Schema**: Extended content_reports with resolved fields and notes
- **RLS Policies**: Proper access control for moderators and admins
- **Bulk Operations**: Efficient batch processing with transaction safety
- **Audit Logging**: Complete action history with timestamps and actors
- **PII Masking**: Content sanitization for privacy protection

#### Analytics Architecture
- **View-Based Metrics**: SQL views for efficient data aggregation
- **Daily Series**: Time-based data with configurable periods
- **KPI Calculation**: Real-time metrics with proper caching
- **Chart Integration**: Simple chart components with data visualization
- **Performance Optimization**: Efficient queries with proper indexing

#### Legacy Cleanup Process
- **Verification Scripts**: Automated checking for legacy references
- **Safe Deletion**: Backup creation before file removal
- **Dependency Resolution**: Proper handling of import dependencies
- **Route Updates**: Clean removal of old route definitions
- **Test Updates**: Removal of outdated test files

### Security & Privacy

#### Reports Security
- **Role-Based Access**: Moderator/admin only access to reports
- **PII Protection**: Content masking for sensitive information
- **Audit Trail**: Complete action logging for accountability
- **Resolution Tracking**: Proper attribution of resolution actions
- **Data Retention**: Configurable retention policies for old reports

#### Analytics Security
- **Permission Gating**: Moderator/admin only access to analytics
- **Data Aggregation**: No raw data exposure in analytics views
- **Performance Monitoring**: System health without sensitive data
- **Metric Privacy**: Aggregated metrics without individual user data
- **Access Logging**: Proper audit trail for analytics access

### Workflow Integration

#### Reports Workflow
1. **Report Creation**: Users submit content reports with reasons
2. **Queue Management**: Moderators triage and filter reports
3. **Resolution Process**: Single or bulk resolution with notes
4. **Audit Trail**: Complete history of resolution actions
5. **Cleanup**: Automated cleanup of resolved reports

#### Analytics Workflow
1. **Data Collection**: Automated collection of system metrics
2. **KPI Calculation**: Real-time calculation of key metrics
3. **Dashboard Display**: Visual representation of system health
4. **Trend Analysis**: Historical analysis of system performance
5. **Alerting**: Proactive monitoring of system health

### Test Coverage
- **Reports Management**: Queue filtering, bulk operations, resolution workflow
- **Analytics Dashboard**: KPI display, chart rendering, data loading
- **Legacy Cleanup**: Import verification, safe deletion, dependency resolution
- **Permission Enforcement**: Role-based access control and UI restrictions
- **Data Validation**: Proper handling of reports and analytics data

### Next Steps
- **Phase 8**: Advanced features and optimizations (optional)

### Technical Notes
- Uses `app_roles` table for role management
- Implements proper RLS policy integration
- Follows mobile-first design principles
- Includes comprehensive test coverage
- Maintains backward compatibility with existing admin routes
