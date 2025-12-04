/**
 * Admin Navigation Component
 * Phase 2: Role-gated navigation with proper access control
 */

import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppRoles } from '../routeGuard';
import { isPublishingWizardEntryEnabled, isPublishingAuditViewerEnabled, isAdminMediaEnabled } from '@/lib/feature-flags';
import { useAppConfig } from '@/hooks/useAppConfig';

// Navigation configuration
const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/admin',
    roles: 'any' as const,
    icon: '🏠'
  },
  {
    label: 'Ruleset Templates',
    href: '/admin/chimera/rulesets',
    roles: ['moderator', 'admin'] as const,
    icon: '📋'
  },
  {
    label: 'Tag Management',
    href: '/admin/chimera/tags',
    roles: ['moderator', 'admin'] as const,
    icon: '🏷️'
  },
  // PHASE 1.7: Legacy nav items removed - Stories, NPCs, Worlds, and Rulesets
  // These routes used legacy tables and have been deleted.
  // Will be replaced with Chimera V3 routes in Phase 2.
  {
    label: 'Roles',
    href: '/admin/roles',
    roles: ['admin'] as const,
    icon: '🔐'
  },
  {
    label: 'Early Access Requests',
    href: '/admin/access-requests',
    roles: ['admin'] as const,
    icon: '🎟️'
  },
  {
    label: 'Image Approvals',
    href: '/admin/media/approvals',
    roles: ['admin'] as const,
    icon: '🖼️',
    featureFlag: 'adminMedia' as const,
  },
  {
    label: 'Publishing (beta)',
    href: '/admin/publishing',
    roles: ['moderator', 'admin'] as const,
    icon: '📤',
    featureFlag: 'publishingWizardEntry' as const,
  },
  {
    label: 'Audit (beta)',
    href: '/admin/publishing/audit',
    roles: ['moderator', 'admin'] as const,
    icon: '📋',
    featureFlag: 'publishingAuditViewer' as const,
  }
] as const;

export function AdminNav() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const { data: appConfig } = useAppConfig();
  const enableChimeraUi = appConfig?.enableChimeraUi ?? false;

  const visibleItems = NAV_ITEMS.filter(item => {
    // Check feature flag if present
    if ('featureFlag' in item) {
      if (item.featureFlag === 'publishingWizardEntry' && !isPublishingWizardEntryEnabled()) {
        return false;
      }
      if (item.featureFlag === 'publishingAuditViewer' && !isPublishingAuditViewerEnabled()) {
        return false;
      }
      if (item.featureFlag === 'adminMedia' && !isAdminMediaEnabled()) {
        return false;
      }
    }

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
