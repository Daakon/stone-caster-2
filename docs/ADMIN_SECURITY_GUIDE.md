# Admin Security Guide

This document outlines the security measures implemented for the Stone Caster admin panel to ensure prompt management is restricted to authorized users only.

## Security Architecture

### 1. Isolated Admin Surface
- **Separate Routing**: Admin routes are completely isolated from the main application
- **Dedicated Layout**: Admin components use a separate layout that never mounts for non-admins
- **No Shared Entry Points**: Admin UI is never exposed in shared navigation or components

### 2. Strict Access Control
- **Role-Based Access**: Only users with `raw_user_meta_data.role === 'prompt_admin'` can access admin features
- **Pre-route Verification**: Role verification happens before any admin components mount
- **Client-Side Guards**: All admin API calls are guarded with role verification
- **Server-Side Validation**: Backend API endpoints validate admin role on every request

### 3. Security-First UX
- **No Side-Channel Hints**: Admin links only appear when user has confirmed admin role
- **Clean Redirects**: Non-admin users are redirected to safe defaults (dashboard/404)
- **No Information Leakage**: Access denied messages don't reveal admin feature existence

## Implementation Details

### Admin Route Structure
```
/admin/* -> AdminRouter -> AdminLayout -> AdminRoute -> Admin Components
```

### Role Verification Flow
1. **Client-Side**: `useAdminRole` hook verifies role before rendering
2. **API Calls**: `useAdminService` guards all admin operations
3. **Server-Side**: Backend middleware validates `prompt_admin` role
4. **Database**: Supabase RLS policies enforce data access restrictions

### Security Components

#### `AdminLayout`
- Dedicated layout for admin interface
- Built-in role verification
- Admin-specific navigation
- Secure sign-out handling

#### `AdminRoute`
- Guards individual admin routes
- Shows loading states during verification
- Provides access denied fallbacks
- Handles different error states

#### `useAdminRole`
- Centralized role verification logic
- Handles authentication state
- Provides loading and error states
- Caches role verification results

#### `useAdminService`
- Guards all admin API operations
- Prevents unauthorized data fetching
- Provides consistent error handling
- Enforces role-based access patterns

## Access Control Matrix

| User Type | Admin Route Access | Admin API Access | Admin UI Visibility |
|-----------|-------------------|------------------|-------------------|
| Unauthenticated | ❌ Redirect to login | ❌ 401 Unauthorized | ❌ Hidden |
| Regular User | ❌ Access Denied | ❌ 403 Forbidden | ❌ Hidden |
| prompt_admin | ✅ Full Access | ✅ Full Access | ✅ Visible |

## Testing Strategy

### Unit Tests
- `useAdminRole.test.ts`: Role verification logic
- `AdminRoute.test.tsx`: Route protection
- `AdminRouter.test.tsx`: Router behavior

### E2E Tests
- `admin-access.spec.ts`: End-to-end access control
- Non-admin user scenarios
- Admin user scenarios
- Error handling

### Security Tests
- Role verification edge cases
- API access without proper role
- Navigation security
- Information leakage prevention

## Deployment Considerations

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Role Assignment
Admin roles must be assigned through Supabase dashboard:
1. Go to Authentication > Users
2. Select the user
3. Edit user metadata
4. Set `role: "prompt_admin"`

### Monitoring
- Monitor admin access attempts
- Log role verification failures
- Track unauthorized access attempts
- Alert on suspicious admin activity

## Security Best Practices

### For Developers
1. **Never bypass role checks** - Always use `useAdminRole` and `useAdminService`
2. **No admin code in shared components** - Keep admin logic isolated
3. **Validate on both client and server** - Don't rely on client-side only
4. **Test access control thoroughly** - Verify all user types and scenarios

### For Administrators
1. **Limit admin role assignment** - Only assign to trusted users
2. **Monitor admin activity** - Watch for unusual patterns
3. **Regular access reviews** - Audit who has admin access
4. **Secure admin sessions** - Use strong authentication

## Troubleshooting

### Common Issues

#### "Access Denied" for Admin Users
- Check user metadata in Supabase dashboard
- Verify role is set to `prompt_admin`
- Clear browser cache and re-authenticate

#### Admin Routes Not Loading
- Check Supabase connection
- Verify environment variables
- Check browser console for errors

#### API Calls Failing
- Verify JWT token is valid
- Check role in user metadata
- Ensure backend is running

### Debug Steps
1. Check user authentication status
2. Verify role in user metadata
3. Test API endpoints directly
4. Check browser network tab
5. Review server logs

## Security Updates

When updating admin security:
1. Update tests to cover new scenarios
2. Verify all access control paths
3. Test with different user types
4. Update documentation
5. Notify administrators of changes

## Contact

For security concerns or questions:
- Create an issue in the repository
- Contact the development team
- Follow security disclosure guidelines
