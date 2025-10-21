import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useAppRoles } from '@/admin/routeGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  LogOut,
  AlertTriangle
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { isCreator, isModerator, isAdmin, loading, error } = useAppRoles();

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    navigate('/auth/signin');
    return null;
  }

  // Show loading state while verifying roles
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            <CardTitle>Verifying Access</CardTitle>
            <CardDescription>
              Checking admin permissions...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show error state if role fetch failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle className="text-destructive">Permission Error</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has any admin access (creator, moderator, or admin)
  const hasAdminAccess = isCreator || isModerator || isAdmin;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Show access denied if no admin access
  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need admin, moderator, or creator role to access this area.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
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
              <p className="text-xs text-muted-foreground">Prompt Management</p>
            </div>
          </div>

          {/* Admin Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium ml-8">
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin">Home</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/entry-points">Entry Points</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/prompt-segments">Prompt Segments</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/npcs">NPCs</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/reviews">Reviews</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/reports">Reports</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/analytics">Analytics</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/roles">Roles</a>
            </Button>
          </nav>

          {/* Right side */}
          <div className="flex flex-1 items-center justify-end space-x-4">
            {/* User info */}
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {isAdmin ? 'Admin' : isModerator ? 'Moderator' : 'Creator'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {user?.email || 'Admin User'}
              </span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Sign out */}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="container mx-auto py-6">
        {children}
      </main>
    </div>
  );
}
