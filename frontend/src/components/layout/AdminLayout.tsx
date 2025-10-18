import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [, setUserRole] = useState<string | null>(null);

  // Verify admin role on mount
  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!isAuthenticated || !user) {
        navigate('/auth/signin');
        return;
      }

      try {
        // Get user role from application database (user_profiles table)
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('auth_user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user role:', error);
          toast.error('Failed to fetch user role');
          navigate('/dashboard');
          return;
        }

        const role = data?.role || 'user';
        console.log('Admin role check:', { 
          role, 
          userId: user.id,
          profileData: data
        });
        setUserRole(role);
        
        if (role !== 'prompt_admin') {
          console.log('Access denied: Role is', role, 'but expected prompt_admin');
          toast.error('Access denied: Admin role required');
          navigate('/dashboard');
          return;
        }

        setHasAdminRole(true);
      } catch (error) {
        console.error('Role verification error:', error);
        toast.error('Failed to verify admin access');
        navigate('/dashboard');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAdminRole();
  }, [isAuthenticated, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Show loading state while verifying
  if (isVerifying) {
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
  if (!hasAdminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need prompt_admin role to access this area.
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
              <a href="/admin/prompts">Prompts</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/awf/core-contracts">Core Contracts</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/awf/worlds">Worlds</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/awf/adventures">Adventures</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/awf/adventure-starts">Adventure Starts</a>
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Analytics
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Users
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Settings
            </Button>
          </nav>

          {/* Right side */}
          <div className="flex flex-1 items-center justify-end space-x-4">
            {/* User info */}
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Admin
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
