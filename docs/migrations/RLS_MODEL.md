# RLS Access Model Documentation

## Overview

The Row-Level Security (RLS) model provides comprehensive access control for the Stone Caster system, supporting public browsing, creator workspaces, moderation workflows, and service role operations. The model is built on Supabase's RLS system with role-based access control.

## Access Patterns

### 1. Public Catalog Access
**Who**: Anonymous users and authenticated users  
**What**: Can view approved, public content only  
**Policy**: `lifecycle = 'active' AND visibility = 'public'`

```sql
-- Public users can only see published, public content
SELECT * FROM entry_points 
WHERE lifecycle = 'active' AND visibility = 'public';
```

### 2. Creator Workspace Access
**Who**: Content creators (authenticated users)  
**What**: Can manage their own content through the moderation workflow  
**Policies**: 
- Read: Own entries in any lifecycle state
- Insert: New drafts, pending reviews, or changes requested
- Update: Own entries that are not yet published (cannot self-publish)

```sql
-- Creator can see all their own content
SELECT * FROM entry_points WHERE owner_user_id = auth.uid();

-- Creator can create drafts
INSERT INTO entry_points (..., owner_user_id, lifecycle, ...)
VALUES (..., auth.uid(), 'draft', ...);

-- Creator can update their drafts (but not publish)
UPDATE entry_points 
SET description = 'Updated content'
WHERE owner_user_id = auth.uid() 
AND lifecycle IN ('draft', 'pending_review', 'changes_requested');
```

### 3. Moderation Access
**Who**: Moderators and Admins (via `app_roles` table)  
**What**: Full read/write access to all content and moderation controls  
**Policies**: Can read/write all entries, manage lifecycle states, view reports

```sql
-- Moderators can see all content
SELECT * FROM entry_points; -- No restrictions

-- Moderators can approve content
UPDATE entry_points 
SET lifecycle = 'active', visibility = 'public'
WHERE id = 'some-entry-id';

-- Moderators can reject content
UPDATE entry_points 
SET lifecycle = 'rejected'
WHERE id = 'some-entry-id';
```

### 4. Game Owner Access
**Who**: Game owners (authenticated users)  
**What**: Can only access their own games and turns  
**Policies**: Owner-only access to games and associated turns

```sql
-- Owner can see their games
SELECT * FROM games WHERE owner_user_id = auth.uid();

-- Owner can create games
INSERT INTO games (..., owner_user_id, ...)
VALUES (..., auth.uid(), ...);

-- Owner can see turns for their games
SELECT t.* FROM turns t
JOIN games g ON t.game_id = g.id
WHERE g.owner_user_id = auth.uid();
```

### 5. Service Role Access
**Who**: Server-side operations (service_role)  
**What**: Full access to all tables for system operations  
**Policies**: Bypass all RLS restrictions

## Table-Specific Access Control

### entry_points Table

| User Type | Read | Insert | Update | Delete |
|-----------|------|--------|--------|--------|
| Anonymous | Active + Public only | ❌ | ❌ | ❌ |
| Authenticated | Own entries + Active + Public | Own drafts only | Own non-published | ❌ |
| Moderator/Admin | All entries | All entries | All entries | All entries |
| Service Role | All entries | All entries | All entries | All entries |

**Key Constraints**:
- Creators cannot set `lifecycle = 'active'` (only moderators can publish)
- Public users only see `lifecycle = 'active' AND visibility = 'public'`
- Creators can only modify their own content

### games Table

| User Type | Read | Insert | Update | Delete |
|-----------|------|--------|--------|--------|
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| Authenticated | Own games only | Own games only | Own games only | Own games only |
| Moderator/Admin | All games | All games | All games | All games |
| Service Role | All games | All games | All games | All games |

**Key Constraints**:
- Games are strictly owner-only
- No public access to games
- Moderators have full access for administrative purposes

### turns Table

| User Type | Read | Insert | Update | Delete |
|-----------|------|--------|--------|--------|
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| Authenticated | Own games' turns only | Own games' turns only | Own games' turns only | Own games' turns only |
| Moderator/Admin | All turns | All turns | All turns | All turns |
| Service Role | All turns | All turns | All turns | All turns |

**Key Constraints**:
- Turns are accessible only through owned games
- No direct public access to turns
- Access is inherited through game ownership

### content_reviews Table

| User Type | Read | Insert | Update | Delete |
|-----------|------|--------|--------|--------|
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| Authenticated | Own reviews only | Own reviews only | Own reviews only | Own reviews only |
| Moderator/Admin | All reviews | All reviews | All reviews | All reviews |
| Service Role | All reviews | All reviews | All reviews | All reviews |

**Key Constraints**:
- Creators can only see reviews for content they submitted
- Moderators can manage the entire review queue
- No anonymous access to reviews

### content_reports Table

| User Type | Read | Insert | Update | Delete |
|-----------|------|--------|--------|--------|
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| Authenticated | ❌ | Own reports only | ❌ | ❌ |
| Moderator/Admin | All reports | All reports | All reports | All reports |
| Service Role | All reports | All reports | All reports | All reports |

**Key Constraints**:
- Only authenticated users can file reports
- Only moderators can view reports
- No public access to reports

## Role Management

### app_roles Table

The `app_roles` table manages user roles for moderation and administration:

```sql
-- Table structure
CREATE TABLE app_roles (
    user_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('moderator', 'admin')),
    PRIMARY KEY (user_id, role)
);
```

### Role Assignment

```sql
-- Assign moderator role
SELECT assign_moderator_role('user-uuid-here');

-- Assign admin role  
SELECT assign_admin_role('user-uuid-here');

-- Remove all roles from user
SELECT remove_user_roles('user-uuid-here');

-- Check if user has role
SELECT user_has_role('user-uuid-here', 'moderator');
```

### Role Hierarchy

1. **Anonymous**: No authentication, limited public access
2. **Authenticated**: Basic user with creator capabilities
3. **Moderator**: Can review and approve content
4. **Admin**: Full administrative access
5. **Service Role**: System-level access for server operations

## Security Boundaries

### Content Lifecycle Security

The system enforces a strict content lifecycle with security boundaries:

```
draft → pending_review → changes_requested → active → archived/rejected
```

**Security Rules**:
- Only creators can create drafts
- Only creators can submit for review
- Only moderators can approve/reject
- Only moderators can publish (set `lifecycle = 'active'`)
- Creators cannot self-publish

### Data Isolation

**Creator Isolation**: Each creator can only access their own content and associated data.

**Moderator Oversight**: Moderators can see all content but cannot access private user data (games, turns) unless they own them.

**Service Role Bypass**: Service role operations bypass all RLS restrictions for system functionality.

## Implementation Details

### RLS Policy Structure

Each table has multiple policies for different access patterns:

1. **Public Access**: Limited to approved, public content
2. **Owner Access**: Users can access their own content
3. **Moderator Access**: Role-based access for content management
4. **Service Access**: Full access for system operations

### JWT Integration

The system uses Supabase's JWT claims for user identification:

- `auth.uid()`: Current user ID from JWT
- `auth.role()`: Current user role (authenticated, service_role, etc.)
- JWT claims are set via `set_config('request.jwt.claims', ...)`

### Performance Considerations

- RLS policies are evaluated on every query
- Indexes on `owner_user_id` and `lifecycle` improve performance
- Role checks use `EXISTS` subqueries for efficiency
- Service role bypasses RLS for optimal performance

## Migration and Rollback

### Enabling RLS

```sql
-- Enable RLS on all tables
ALTER TABLE entry_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
```

### Policy Management

Policies are created with `CREATE POLICY` statements and can be dropped with `DROP POLICY` statements. The migration includes a rollback block for safe removal.

### Testing and Verification

The RLS model is verified through comprehensive testing that simulates different user contexts and validates access patterns. The verification script tests:

- Anonymous access restrictions
- Creator workspace functionality
- Moderation capabilities
- Game ownership isolation
- Report filing and viewing
- Service role bypass

## Best Practices

### Application Development

1. **Always use authenticated context** for user operations
2. **Check user roles** before showing moderation interfaces
3. **Handle RLS errors gracefully** in application code
4. **Use service role** for system operations that need full access

### Security Considerations

1. **Never bypass RLS** in application code
2. **Validate user permissions** before UI operations
3. **Audit role assignments** regularly
4. **Monitor access patterns** for security issues

### Performance Optimization

1. **Index frequently queried columns** (owner_user_id, lifecycle)
2. **Use efficient role checks** with EXISTS subqueries
3. **Cache role information** when possible
4. **Minimize RLS policy complexity** for better performance

## Troubleshooting

### Common Issues

1. **"Row Level Security" errors**: Check if RLS is enabled and policies exist
2. **Access denied errors**: Verify user authentication and role assignments
3. **Performance issues**: Check indexes on RLS policy columns
4. **Service role issues**: Ensure service role is properly configured

### Debugging Access

```sql
-- Check current user context
SELECT auth.uid(), auth.role();

-- Check user roles
SELECT * FROM app_roles WHERE user_id = auth.uid();

-- Test specific access patterns
SELECT COUNT(*) FROM entry_points; -- What can current user see?
```

This RLS model provides comprehensive security while maintaining usability for all user types in the Stone Caster system.
