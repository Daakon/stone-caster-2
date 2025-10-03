# Layer M6: Profile Auth Safety - QA Verification Guide

## Overview

Layer M6 implements secure profile management with authentication, CSRF protection, session safety controls, and guest account integration. This document provides QA verification steps for all acceptance criteria.

## Database Schema Integration

### User Profiles Table
The implementation uses a `user_profiles` table that links to Supabase auth users:
- `auth_user_id` → `auth.users(id)` (primary link)
- `cookie_group_id` → `cookie_groups(id)` (for guest account linking)
- Profile data: `display_name`, `avatar_url`, `email`, `preferences`
- Timestamps: `created_at`, `last_seen_at`, `updated_at`

### Guest Account Support
- Guest users are managed through `cookie_groups` and `cookie_group_members` tables
- Guest accounts can be linked to authenticated users via `link_cookie_group_to_user`
- Characters and game saves support both `user_id` (auth) and `cookie_id` (guest)

### Migration Requirements
- Apply migration `008_user_profiles.sql` to create the user profiles table
- The migration includes RLS policies and database functions for profile management
- CSRF tokens table is created for profile update protection

## Test Matrix Coverage

### ✅ Unit Tests (15 tests)
- Profile DTO redaction (no forbidden fields)
- Input validation edge cases (name length, URL validation, preference toggles)
- CSRF token required & verified for update
- Session revoke logic (ensures "others" are invalidated, current remains)

### ✅ Integration Tests (11 tests)
- Read profile (auth vs unauth)
- Update profile happy path + invalid input path
- Revoke sessions then attempt a call with a revoked session → UNAUTHORIZED

### ✅ E2E Tests (6 tests)
- Sign in → view profile → update display name → refresh → see updated data
- Revoke other sessions, verify old session token no longer works

## QA Verification Steps

### 1. Profile Read Verification

**Test Case: Authenticated Profile Read**
```bash
# 1. Get valid JWT token (from auth flow)
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Test User",
    "avatarUrl": "https://example.com/avatar.jpg",
    "email": "test@example.com",
    "preferences": {
      "showTips": true,
      "theme": "dark",
      "notifications": {
        "email": true,
        "push": false
      }
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "lastSeen": "2023-01-02T00:00:00Z"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

**Verification Points:**
- ✅ Response is within standard envelope
- ✅ No internal fields exposed (providerId, accessTokens, internalFlags, auditLog)
- ✅ All required fields present (displayName, avatarUrl, email, preferences, timestamps)

**Test Case: Unauthenticated Profile Read**
```bash
curl -X GET "http://localhost:3000/api/profile" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User authentication required"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

### 2. Profile Update Verification

**Test Case: Valid Profile Update**
```bash
# 1. First get CSRF token
curl -X POST "http://localhost:3000/api/profile/csrf-token" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json"

# 2. Update profile with valid data
curl -X PUT "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Updated Name",
    "avatarUrl": "https://example.com/new-avatar.jpg",
    "preferences": {
      "showTips": false,
      "theme": "light",
      "notifications": {
        "email": false,
        "push": true
      }
    }
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Updated Name",
    "avatarUrl": "https://example.com/new-avatar.jpg",
    "email": "test@example.com",
    "preferences": {
      "showTips": false,
      "theme": "light",
      "notifications": {
        "email": false,
        "push": true
      }
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "lastSeen": "2023-01-02T12:00:00Z"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

**Test Case: Invalid Input Validation**
```bash
# Test display name too long
curl -X PUT "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "a'.repeat(101)
  }'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Display name must be between 1 and 100 characters"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

**Test Case: Invalid Avatar URL**
```bash
curl -X PUT "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "avatarUrl": "not-a-valid-url"
  }'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid avatar URL format"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

### 3. CSRF Protection Verification

**Test Case: CSRF Token Required for Session Revocation**
```bash
# 1. Get CSRF token
curl -X POST "http://localhost:3000/api/profile/csrf-token" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json"

# 2. Revoke sessions with valid CSRF token
curl -X POST "http://localhost:3000/api/profile/revoke-sessions" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "csrfToken": "<csrf-token-from-step-1>"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "revokedCount": 2,
    "currentSessionPreserved": true
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

**Test Case: Invalid CSRF Token**
```bash
curl -X POST "http://localhost:3000/api/profile/revoke-sessions" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "csrfToken": "invalid-token"
  }'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": {
    "code": "CSRF_TOKEN_INVALID",
    "message": "Invalid or expired CSRF token"
  },
  "meta": {
    "traceId": "uuid-here"
  }
}
```

### 4. Session Safety Verification

**Test Case: Session Revocation Flow**
```bash
# 1. Create multiple sessions (simulate different devices)
# Session 1 (current)
TOKEN1="<jwt-token-1>"

# Session 2 (other device)
TOKEN2="<jwt-token-2>"

# 2. Verify both sessions work
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer $TOKEN1"

curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer $TOKEN2"

# 3. Revoke other sessions from Session 1
curl -X POST "http://localhost:3000/api/profile/csrf-token" \
  -H "Authorization: Bearer $TOKEN1"

curl -X POST "http://localhost:3000/api/profile/revoke-sessions" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"csrfToken": "<csrf-token>"}'

# 4. Verify Session 1 still works
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer $TOKEN1"
# Should return 200 OK

# 5. Verify Session 2 is revoked
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer $TOKEN2"
# Should return 401 UNAUTHORIZED
```

### 5. Rate Limiting Verification

**Test Case: Profile Update Rate Limiting**
```bash
# Make 11 rapid profile update requests (limit is 10 per minute)
for i in {1..11}; do
  curl -X PUT "http://localhost:3000/api/profile" \
    -H "Authorization: Bearer <valid-jwt-token>" \
    -H "Content-Type: application/json" \
    -d "{\"displayName\": \"Test $i\"}"
  echo "Request $i completed"
done
```

**Expected Behavior:**
- Requests 1-10: Return 200 OK
- Request 11: Return 429 RATE_LIMITED

**Test Case: Session Revocation Rate Limiting**
```bash
# Make 6 rapid session revocation requests (limit is 5 per 5 minutes)
for i in {1..6}; do
  curl -X POST "http://localhost:3000/api/profile/revoke-sessions" \
    -H "Authorization: Bearer <valid-jwt-token>" \
    -H "Content-Type: application/json" \
    -d '{"csrfToken": "<valid-csrf-token>"}'
  echo "Revocation request $i completed"
done
```

**Expected Behavior:**
- Requests 1-5: Return 200 OK
- Request 6: Return 429 RATE_LIMITED

### 6. Security & Privacy Verification

**Test Case: Data Redaction**
```bash
# Get profile and verify no sensitive data is exposed
curl -X GET "http://localhost:3000/api/profile" \
  -H "Authorization: Bearer <valid-jwt-token>" | jq '.'
```

**Verification Points:**
- ✅ No `providerId` field
- ✅ No `accessTokens` field
- ✅ No `internalFlags` field
- ✅ No `auditLog` field
- ✅ No database internal IDs
- ✅ No server-side configuration data

**Test Case: Logging Verification**
```bash
# Check server logs for profile operations
# Should see trace IDs and no sensitive PII
tail -f /var/log/stone-caster-api.log | grep "Profile updated"
```

**Expected Log Format:**
```
Profile updated for user 550e8400-e29b-41d4-a716-446655440000 {
  traceId: "uuid-here",
  updatedFields: ["displayName", "avatarUrl"]
}
```

### 7. Regression Safety Verification

**Test Case: Existing User Flows Still Work**
```bash
# Verify existing endpoints still function
curl -X GET "http://localhost:3000/api/characters" \
  -H "Authorization: Bearer <valid-jwt-token>"

curl -X GET "http://localhost:3000/api/games" \
  -H "Authorization: Bearer <valid-jwt-token>"

curl -X GET "http://localhost:3000/api/me" \
  -H "Authorization: Bearer <valid-jwt-token>"
```

**Expected Behavior:**
- All existing endpoints return expected responses
- No breaking changes to existing API contracts
- Envelope format remains consistent

## Test Data Setup

### Required Test Users
```sql
-- Create test user profile
INSERT INTO user_profiles (
  id,
  display_name,
  avatar_url,
  email,
  preferences,
  created_at,
  last_seen
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Test User',
  'https://example.com/avatar.jpg',
  'test@example.com',
  '{"show_tips": true, "theme": "dark", "notifications": {"email": true, "push": false}}',
  '2023-01-01T00:00:00Z',
  '2023-01-02T00:00:00Z'
);
```

### Required Test CSRF Tokens
```sql
-- Create test CSRF token
INSERT INTO csrf_tokens (
  user_id,
  token,
  expires_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test-csrf-token-123',
  NOW() + INTERVAL '1 hour'
);
```

### 5. Guest Account Integration Verification

**Test Case: Create Guest Profile**
```bash
# 1. Create a new guest profile
curl -X POST "http://localhost:3000/api/profile/guest" \
  -H "Content-Type: application/json" \
  -d '{
    "cookieId": "guest-cookie-123",
    "deviceLabel": "Test Device"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "cookieId": "guest-cookie-123",
    "groupId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceLabel": "Test Device",
    "lastSeen": "2023-01-01T12:00:00Z",
    "createdAt": "2023-01-01T12:00:00Z"
  }
}
```

**Test Case: Get Guest Profile**
```bash
# 2. Retrieve guest profile
curl -X GET "http://localhost:3000/api/profile/guest/guest-cookie-123" \
  -H "Content-Type: application/json"
```

**Test Case: Link Guest to Authenticated User**
```bash
# 3. Link guest account to authenticated user
curl -X POST "http://localhost:3000/api/profile/link-guest" \
  -H "Authorization: Bearer <valid-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cookieGroupId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "success": true
  }
}
```

**Verification Steps:**
1. ✅ Guest profile creation works without authentication
2. ✅ Guest profile retrieval works with cookie ID
3. ✅ Guest account linking requires authentication
4. ✅ Linked guest data is accessible through user profile
5. ✅ Guest characters/games are preserved after linking

## Acceptance Criteria Checklist

### Profile Read
- [ ] Valid authenticated request returns profile data with proper fields
- [ ] Response is within standard envelope and passes DTO redaction checks
- [ ] Unauthenticated request returns UNAUTHORIZED within standard error envelope

### Profile Update
- [ ] Valid updates (display name, avatar URL, preferences) succeed and are persisted
- [ ] Invalid inputs return VALIDATION_FAILED without changing data
- [ ] CSRF protection is enforced and validated with failing test

### Session Safety
- [ ] "Revoke other sessions" action invalidates all but current session
- [ ] After revocation, subsequent calls using revoked sessions fail with UNAUTHORIZED
- [ ] Action is idempotent and safe to repeat without side effects

### Security & Privacy
- [ ] Profile responses never expose provider IDs, access tokens, or internal flags
- [ ] Logs contain trace identifier and no sensitive PII beyond policy
- [ ] Rate-limit or abuse guard is present for profile updates

### Guest Account Integration
- [ ] Guest profiles can be created without authentication
- [ ] Guest profiles can be retrieved by cookie ID
- [ ] Guest accounts can be linked to authenticated users
- [ ] Guest characters and games are preserved after account linking
- [ ] Rate limiting is applied to account linking operations

### Regression Safety
- [ ] All existing user flows (auth, characters, games, turns) still operate unchanged
- [ ] Envelope format is consistent with prior layers
- [ ] Database schema changes are backward compatible

## Performance Benchmarks

### Expected Response Times
- Profile Read: < 100ms
- Profile Update: < 200ms
- CSRF Token Generation: < 50ms
- Session Revocation: < 500ms

### Rate Limits
- Profile Updates: 10 requests per minute
- Session Revocation: 5 requests per 5 minutes
- CSRF Token Generation: 20 requests per minute

## Troubleshooting

### Common Issues

**Issue: CSRF Token Invalid**
- Verify token was generated within the last hour
- Check that token matches the user ID
- Ensure token hasn't been used already

**Issue: Rate Limit Exceeded**
- Wait for the rate limit window to reset
- Check server logs for rate limit configuration
- Verify client isn't making duplicate requests

**Issue: Profile Not Found**
- Verify user ID is valid UUID format
- Check that profile exists in database
- Ensure user is properly authenticated

**Issue: Validation Failed**
- Check input data format and length limits
- Verify URL format for avatar URLs
- Ensure preference values are valid enums

### Debug Commands
```bash
# Check profile service logs
grep "ProfileService" /var/log/stone-caster-api.log

# Check rate limiting
grep "RATE_LIMITED" /var/log/stone-caster-api.log

# Check CSRF validation
grep "CSRF" /var/log/stone-caster-api.log
```

## Sign-off Criteria

All acceptance criteria must pass before Layer M6 can be considered complete:

- [ ] All unit tests pass (15/15)
- [ ] All integration tests pass (11/11)
- [ ] All E2E tests pass (6/6)
- [ ] Manual QA verification completed
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
