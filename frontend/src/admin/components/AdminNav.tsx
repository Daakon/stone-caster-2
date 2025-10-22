/**
 * Admin Navigation Component
 * Phase 2: Role-gated navigation with proper access control
 */

import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppRoles } from '../routeGuard';

// Navigation configuration
const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/admin',
    roles: 'any' as const,
    icon: '🏠'
  },
  {
    label: 'Entry Points',
    href: '/admin/entry-points',
    roles: 'any' as const,
    icon: '🎯'
  },
  {
    label: 'Prompt Segments',
    href: '/admin/prompt-segments',
    roles: 'any' as const,
    icon: '📝'
  },
  {
    label: 'NPCs',
    href: '/admin/npcs',
    roles: 'any' as const,
    icon: '👥'
  },
  {
    label: 'Worlds',
    href: '/admin/worlds',
    roles: ['creator', 'moderator', 'admin'] as const,
    icon: '🌍'
  },
  {
    label: 'Rulesets',
    href: '/admin/rulesets',
    roles: ['creator', 'moderator', 'admin'] as const,
    icon: '📋'
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    roles: ['moderator', 'admin'] as const,
    icon: '✅'
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    roles: ['moderator', 'admin'] as const,
    icon: '📊'
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    roles: ['moderator', 'admin'] as const,
    icon: '📈'
  },
  {
    label: 'Roles',
    href: '/admin/roles',
    roles: ['admin'] as const,
    icon: '🔐'
  }
] as const;

export function AdminNav() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();

  const visibleItems = NAV_ITEMS.filter(item => {
    // Check if user has access to this item
    if (item.roles === 'any') {
      return isCreator;
    }

    if (Array.isArray(item.roles)) {
      return item.roles.some(role => {
        switch (role) {
          case 'moderator':
            return isModerator;
          case 'admin':
            return isAdmin;
          default:
            return false;
        }
      });
    }

    return false;
  });

  return (
    <nav className="space-y-1">
      {visibleItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )
          }
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
