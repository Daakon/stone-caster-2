/**
 * Admin Shell Component
 * Phase 2: Top-level admin layout with navigation and role management
 */

import { useNavigate } from 'react-router-dom';
import { AdminRoutes } from './AdminRoutes';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { AppRolesProvider, useAppRoles } from './routeGuard';
import { AdminNav } from './components/AdminNav';
import { RoleBadge } from './components/RoleBadge';

function AdminShellContent() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { loading, error } = useAppRoles();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading admin permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Permission Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center">
          {/* Logo and Title */}
          <div className="mr-4 flex items-center space-x-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold">StoneCaster Admin</h1>
              <p className="text-xs text-muted-foreground">Content Management</p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <RoleBadge />
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-screen-2xl">
        <div className="flex">
          {/* Sidebar Navigation */}
          <aside className="w-64 border-r border-border bg-muted/10 p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  Navigation
                </h2>
                <AdminNav />
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <AdminRoutes />
          </main>
        </div>
      </div>
    </div>
  );
}

export function AppAdminShell() {
  return (
    <AppRolesProvider>
      <AdminShellContent />
    </AppRolesProvider>
  );
}
