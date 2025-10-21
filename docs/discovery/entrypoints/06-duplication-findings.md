# Duplication Findings

## Overview
This document identifies areas of duplication across the Stone Caster codebase that could be consolidated under a unified EntryPoint abstraction.

## Database Schema Duplication

### 1. Dual Adventure Tables
**Problem**: Two separate `adventures` tables with different schemas
- **Legacy**: `adventures` (UUID primary key, simple fields)
- **AWF**: `adventures` (TEXT primary key, versioned documents)

**Impact**: 
- Confusing data model
- Different API endpoints for same concept
- Maintenance overhead

**Unification Opportunity**: Single `entry_points` table with type field

### 2. Similar Document Structures
**Problem**: Multiple tables storing JSONB documents with similar structures
- `adventures.doc` (AWF)
- `scenarios.doc` (AWF) 
- `worlds.doc` (AWF)

**Common Fields**:
- `id`, `name`, `version`
- `world_ref`, `adventure_ref`
- `display_name`, `synopsis`
- `tags`, `i18n`

**Unification Opportunity**: Shared document schema with type-specific extensions

## API Endpoint Duplication

### 1. Admin CRUD Operations
**Problem**: Similar CRUD patterns across different entity types
- `POST /api/admin/awf/adventures`
- `POST /api/admin/awf/scenarios`
- `POST /api/admin/awf/worlds`

**Common Pattern**:
- Validate request body
- Parse document
- Compute hash
- Upsert record
- Return response

**Unification Opportunity**: Generic admin CRUD endpoints with type parameter

### 2. Game Start Endpoints
**Problem**: Multiple ways to start games
- `POST /api/games` (legacy adventures)
- `POST /api/player/games/start` (scenarios)
- `POST /api/games/:id/auto-initialize` (game initialization)

**Common Pattern**:
- Validate input
- Create game state
- Initialize prompt
- Return game ID

**Unification Opportunity**: Single game start endpoint with entry point type

## Frontend Component Duplication

### 1. Admin Interface Patterns
**Problem**: Similar admin interfaces for different entity types
- `AwfAdventuresAdmin.tsx`
- `AwfScenariosAdmin.tsx`
- `AwfWorldsAdmin.tsx`

**Common Features**:
- JSON editor
- Validation errors
- Import/export
- Search and filter
- CRUD operations

**Unification Opportunity**: Generic admin component with entity type configuration

### 2. Listing and Selection Patterns
**Problem**: Similar patterns for displaying and selecting entry points
- Adventure listing pages
- Scenario picker
- World selection

**Common Features**:
- Card-based display
- Search and filter
- Tag display
- Selection handling

**Unification Opportunity**: Generic entry point picker component

## Service Layer Duplication

### 1. Repository Patterns
**Problem**: Similar repository implementations
- `AdventuresRepository`
- `ScenarioRepository`
- `WorldsRepository`

**Common Methods**:
- `getByIdVersion()`
- `upsert()`
- `validate()`
- `computeHash()`

**Unification Opportunity**: Generic repository with entity type configuration

### 2. Prompt Assembly
**Problem**: Multiple prompt assembly approaches
- Database prompt assembler
- Legacy file-based assembler
- Prompt wrapper

**Common Functionality**:
- Segment loading
- Variable replacement
- Section assembly
- Token estimation

**Unification Opportunity**: Single prompt assembly service with multiple backends

## Data Model Duplication

### 1. Similar Entity Structures
**Problem**: Repeated patterns across entity types
- All have `id`, `version`, `doc`, `created_at`, `updated_at`
- All have world references
- All have display names and descriptions
- All have tags and metadata

**Unification Opportunity**: Base entity interface with type-specific extensions

### 2. Search and Filter Fields
**Problem**: Similar search capabilities across entity types
- All support text search
- All support tag filtering
- All support world filtering
- All support status filtering

**Unification Opportunity**: Standardized search interface

## Configuration Duplication

### 1. Validation Schemas
**Problem**: Similar Zod schemas across entity types
- `AdventureDocSchema`
- `ScenarioDocV1Schema`
- `WorldDocSchema`

**Common Fields**:
- `id`, `name`, `version`
- `world_ref`
- `display_name`, `synopsis`
- `tags`, `i18n`

**Unification Opportunity**: Base schema with type-specific extensions

### 2. API Response Patterns
**Problem**: Similar response structures across endpoints
- Success responses with `ok: true, data: {}`
- Error responses with `ok: false, error: string`
- Validation error responses

**Unification Opportunity**: Standardized response types

## Navigation Duplication

### 1. Similar Route Patterns
**Problem**: Repeated navigation patterns
- `/adventures` → adventure listing
- `/scenarios` → scenario picker
- `/admin/awf/adventures` → adventure admin
- `/admin/awf/scenarios` → scenario admin

**Common Pattern**:
- List view with search/filter
- Detail view with edit capabilities
- Admin interface with CRUD operations

**Unification Opportunity**: Generic routing with entity type configuration

### 2. Breadcrumb Patterns
**Problem**: Similar breadcrumb structures
- Home → Adventures → Adventure Detail
- Home → Scenarios → Scenario Detail
- Home → Admin → Entity Management

**Unification Opportunity**: Dynamic breadcrumb generation

## State Management Duplication

### 1. Similar State Patterns
**Problem**: Repeated state management patterns
- Loading states
- Error states
- Selection states
- Form states

**Common State**:
- `loading: boolean`
- `error: string | null`
- `selectedItem: Entity | null`
- `editingItem: Entity | null`

**Unification Opportunity**: Generic state management hooks

### 2. API Call Patterns
**Problem**: Similar API call patterns
- Load entities
- Create/update entities
- Delete entities
- Search entities

**Common Pattern**:
- Fetch with loading state
- Handle errors
- Update local state
- Show success/error messages

**Unification Opportunity**: Generic API hooks

## Performance Duplication

### 1. Caching Patterns
**Problem**: Similar caching strategies
- Entity caching
- Prompt segment caching
- Search result caching

**Common Pattern**:
- Cache by key
- Invalidate on update
- TTL-based expiration

**Unification Opportunity**: Generic caching service

### 2. Database Query Patterns
**Problem**: Similar query patterns
- Indexed lookups
- Filtered searches
- Paginated results

**Common Pattern**:
- WHERE clauses
- ORDER BY clauses
- LIMIT/OFFSET pagination

**Unification Opportunity**: Generic query builder

## Security Duplication

### 1. RLS Policy Patterns
**Problem**: Similar RLS policies across tables
- Admin can manage all
- Users can read active
- Service role can do everything

**Common Pattern**:
- Role-based access
- Active/inactive filtering
- Ownership-based access

**Unification Opportunity**: Generic RLS policy generator

### 2. Authentication Patterns
**Problem**: Similar authentication requirements
- Admin endpoints require admin role
- Player endpoints require authentication
- Public endpoints allow anonymous access

**Common Pattern**:
- Token validation
- Role checking
- Permission verification

**Unification Opportunity**: Generic authentication middleware

## Testing Duplication

### 1. Similar Test Patterns
**Problem**: Repeated test structures
- CRUD operation tests
- Validation tests
- Error handling tests
- Integration tests

**Common Pattern**:
- Setup test data
- Execute operation
- Assert results
- Cleanup

**Unification Opportunity**: Generic test utilities

### 2. Mock Patterns
**Problem**: Similar mocking requirements
- Database mocks
- API mocks
- Service mocks

**Common Pattern**:
- Mock responses
- Mock errors
- Mock loading states

**Unification Opportunity**: Generic mocking utilities


