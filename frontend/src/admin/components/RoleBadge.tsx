/**
 * Role Badge Component
 * Displays user's role with appropriate styling
 */

import { Badge } from '@/components/ui/badge';
import { useAppRoles } from '../routeGuard';

export function RoleBadge() {
  const { isCreator, isModerator, isAdmin, roles, loading } = useAppRoles();

  // Debug: log roles to console
  if (!loading && roles.length > 0) {
    console.log('[RoleBadge] User roles:', roles);
  }

  if (loading) {
    return <Badge variant="secondary">Loading...</Badge>;
  }

  // Show all roles if user has multiple
  if (roles.length > 1) {
    return (
      <div className="flex gap-1">
        {roles.map((role) => (
          <Badge
            key={role}
            variant={
              role === 'admin'
                ? 'destructive'
                : role === 'moderator'
                  ? 'default'
                  : 'secondary'
            }
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Badge>
        ))}
      </div>
    );
  }

  if (isAdmin) {
    return <Badge variant="destructive">Admin</Badge>;
  }

  if (isModerator) {
    return <Badge variant="default">Moderator</Badge>;
  }

  if (isCreator) {
    return <Badge variant="secondary">Creator</Badge>;
  }

  return <Badge variant="outline">Guest</Badge>;
}















