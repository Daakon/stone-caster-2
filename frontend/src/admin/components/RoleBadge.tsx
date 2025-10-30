/**
 * Role Badge Component
 * Displays user's role with appropriate styling
 */

import { Badge } from '@/components/ui/badge';
import { useAppRoles } from '../routeGuard';

export function RoleBadge() {
  const { isCreator, isModerator, isAdmin, loading } = useAppRoles();

  if (loading) {
    return <Badge variant="secondary">Loading...</Badge>;
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












