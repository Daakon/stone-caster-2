import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, Chrome, MessageSquare } from 'lucide-react';
import { GuestCookieService } from '../services/guestCookie';

interface AuthPageProps {
  mode?: 'signin' | 'signup';
}

export default function AuthPage({ mode: initialMode }: AuthPageProps = {}) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode || 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { signIn, signUp } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Get return URL from query params
  const returnTo = searchParams.get('returnTo') || '/';

  // Determine mode from URL path
  useEffect(() => {
    const pathMode = location.pathname.includes('/signin') ? 'signin' : 'signup';
    setMode(pathMode);
  }, [location.pathname]);

  // Check if user is already authenticated
  useEffect(() => {
    const { user } = useAuthStore.getState();
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [navigate, returnTo]);

  // Check if we're in demo mode
  const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://demo.supabase.co';

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newMode = value as 'signin' | 'signup';
    setMode(newMode);
    navigate(`/auth/${newMode}${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    console.log(`[AuthPage] Starting ${mode} with email: ${email}`);
    
    // Client-side validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);

    try {
      if (isDemoMode) {
        console.log('[AuthPage] Demo mode detected for email/password auth');
        setError('Email/password authentication is not available in demo mode. Please continue as guest or configure Supabase.');
        setLoading(false);
        return;
      }

      if (mode === 'signin') {
        console.log('[AuthPage] Attempting sign in');
        await signIn(email, password);
        console.log('[AuthPage] Sign in successful');
      } else {
        console.log('[AuthPage] Attempting sign up');
        await signUp(email, password);
        console.log('[AuthPage] Sign up successful');
      }
      
      console.log(`[AuthPage] Redirecting to: ${returnTo}`);
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      console.error(`[AuthPage] ${mode} error:`, err);
      // narrow unknown to Error-like object
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : undefined;
      setError(typeof message === 'string' ? message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'discord') => {
    console.log(`[AuthPage] Starting OAuth flow for provider: ${provider}`);
    setOauthLoading(provider);
    setError('');

    try {
      if (isDemoMode) {
        console.log('[AuthPage] Demo mode detected, showing demo message');
        setError('OAuth authentication is not available in demo mode. Please use email/password authentication or continue as guest.');
        setOauthLoading(null);
        return;
      }

      // Get or create guest cookie for account linking
      const guestCookieId = GuestCookieService.getOrCreateGuestCookie();
      console.log(`[AuthPage] Guest cookie ID: ${guestCookieId}`);

      // Get the API base URL - use localhost for development, api.stonecaster.ai for production
      const apiBaseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
      const oauthUrl = `${apiBaseUrl}/api/auth/oauth/${provider}/start?guestCookieId=${guestCookieId}`;
      
      console.log(`[AuthPage] Calling backend OAuth endpoint: ${oauthUrl}`);

      // Call the backend OAuth start endpoint
      const response = await fetch(oauthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for guest ID
      });
      
      console.log(`[AuthPage] OAuth response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AuthPage] OAuth request failed:`, errorText);
        throw new Error(`Failed to start OAuth flow: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log(`[AuthPage] Response content type: ${contentType}`);

      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error(`[AuthPage] Non-JSON response received:`, responseText.substring(0, 200));
        throw new Error('Server returned non-JSON response. Please check your API configuration.');
      }

      const data = await response.json();
      console.log(`[AuthPage] OAuth response data:`, data);
      
      if (data.ok && data.data?.url) {
        console.log(`[AuthPage] Redirecting to OAuth provider: ${data.data.url}`);
        // Redirect to OAuth provider
        window.location.href = data.data.url;
      } else {
        console.error(`[AuthPage] OAuth response error:`, data.error);
        throw new Error(data.error?.message || 'Failed to start OAuth flow');
      }
    } catch (err: unknown) {
      console.error(`[AuthPage] OAuth error:`, err);
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : undefined;
      setError(typeof message === 'string' ? message : 'OAuth authentication failed');
      setOauthLoading(null);
    }
  };

  const oauthProviders = [
    { id: 'google', name: 'Google', icon: Chrome, color: 'bg-red-500 hover:bg-red-600' },
    { id: 'github', name: 'GitHub', icon: Github, color: 'bg-gray-800 hover:bg-gray-900' },
    { id: 'discord', name: 'Discord', icon: MessageSquare, color: 'bg-indigo-500 hover:bg-indigo-600' },
  ] as const;

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🎲 Stonecaster</CardTitle>
          {isDemoMode && (
            <Alert className="mt-4">
              <AlertDescription>
                <strong>Demo Mode:</strong> Authentication is not configured. Use "Continue as Guest" to explore the app.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="signin">Sign In</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signup" className="mt-6">
              <div className="space-y-6">
                {/* OAuth Providers */}
                <div className="space-y-3">
                  <div className="text-center text-sm text-muted-foreground">
                    Sign up with
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {oauthProviders.map((provider) => {
                      const Icon = provider.icon;
                      const isLoading = oauthLoading === provider.id;
                      return (
                        <Button
                          key={provider.id}
                          variant="outline"
                          className={`w-full justify-start ${provider.color} text-white border-0`}
                          onClick={() => handleOAuthSignIn(provider.id as 'google' | 'github' | 'discord')}
                          disabled={loading || oauthLoading !== null}
                          aria-busy={isLoading}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                          {isLoading ? 'Connecting...' : `Continue with ${provider.name}`}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign up form">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      aria-required="true"
                      aria-invalid={!!error}
                      autoComplete="email"
                      placeholder="Enter your email"
                      disabled={loading || oauthLoading !== null}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      aria-required="true"
                      aria-invalid={!!error}
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="Enter your password"
                      disabled={loading || oauthLoading !== null}
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || oauthLoading !== null}
                    aria-busy={loading}
                  >
                    {loading ? 'Loading...' : 'Sign Up'}
                  </Button>
                </form>

                {/* Guest mode option */}
                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(returnTo, { replace: true })}
                    className="text-sm text-muted-foreground"
                    disabled={loading || oauthLoading !== null}
                  >
                    Continue as Guest
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signin" className="mt-6">
              <div className="space-y-6">
                {/* OAuth Providers */}
                <div className="space-y-3">
                  <div className="text-center text-sm text-muted-foreground">
                    Sign in with
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {oauthProviders.map((provider) => {
                      const Icon = provider.icon;
                      const isLoading = oauthLoading === provider.id;
                      return (
                        <Button
                          key={provider.id}
                          variant="outline"
                          className={`w-full justify-start ${provider.color} text-white border-0`}
                          onClick={() => handleOAuthSignIn(provider.id as 'google' | 'github' | 'discord')}
                          disabled={loading || oauthLoading !== null}
                          aria-busy={isLoading}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                          {isLoading ? 'Connecting...' : `Continue with ${provider.name}`}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in form">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      aria-required="true"
                      aria-invalid={!!error}
                      autoComplete="email"
                      placeholder="Enter your email"
                      disabled={loading || oauthLoading !== null}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      aria-required="true"
                      aria-invalid={!!error}
                      autoComplete="current-password"
                      minLength={6}
                      placeholder="Enter your password"
                      disabled={loading || oauthLoading !== null}
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || oauthLoading !== null}
                    aria-busy={loading}
                  >
                    {loading ? 'Loading...' : 'Sign In'}
                  </Button>
                </form>

                {/* Guest mode option */}
                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(returnTo, { replace: true })}
                    className="text-sm text-muted-foreground"
                    disabled={loading || oauthLoading !== null}
                  >
                    Continue as Guest
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
