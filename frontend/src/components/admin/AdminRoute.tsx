import { type ReactNode } from 'react';
import { useAdminRole } from '@/hooks/useAdminRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminRoute({ children, fallback }: AdminRouteProps) {
  const { isAdmin, isLoading, userRole, error } = useAdminRole();

  // Show loading state
  if (isLoading) {
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

  // Show access denied if not admin
  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              {error === 'Not authenticated' 
                ? 'You must be logged in to access this area.'
                : error === 'Insufficient permissions'
                ? 'You need prompt_admin role to access this area.'
                : 'Access denied. Please contact an administrator.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            {userRole && (
              <p className="text-sm text-muted-foreground">
                Current role: <Badge variant="outline">{userRole}</Badge>
              </p>
            )}
            <Button onClick={() => window.location.href = '/dashboard'} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
