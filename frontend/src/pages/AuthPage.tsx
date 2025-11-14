import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { RoutePreservationService } from '../services/routePreservation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, Chrome, MessageSquare } from 'lucide-react';
import { makeTitle } from '@/lib/meta';

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
  const { signIn, signUp, signInWithOAuth } = useAuthStore(); // Added signInWithOAuth
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Get return URL from query params or route preservation
  const returnTo = searchParams.get('returnTo') || RoutePreservationService.getIntendedRoute();

  // Handle /auth redirect to /auth/signin
  useEffect(() => {
    if (location.pathname === '/auth') {
      console.log('[REDIRECT] from=/auth to=/auth/signin trigger=manual');
      navigate('/auth/signin', { replace: true });
      return;
    }
    
    // Determine mode from URL path
    const pathMode = location.pathname.includes('/signin') ? 'signin' : 'signup';
    setMode(pathMode);
  }, [location.pathname, navigate]);

  // Update document title based on mode
  useEffect(() => {
    const title = makeTitle([mode === 'signin' ? 'Sign In' : 'Sign Up', 'Stone Caster']);
    document.title = title;
  }, [mode]);

  // Note: AuthRouter handles redirecting authenticated users away from auth pages
  // This effect was causing redirect loops for guests

  // Check if we're in demo mode
  const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://demo.supabase.co';

  // Handle tab change
  const handleTabChange = (value: string) => {
    setMode(value as 'signin' | 'signup');
    setError(''); // Clear errors on tab change
    navigate(`/auth/${value}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      // Clear the intended route and navigate to the return URL
      RoutePreservationService.clearIntendedRoute();
      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      console.error(`[AuthPage] ${mode} error:`, err);
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : undefined;
      setError(typeof message === 'string' ? message : `${mode} failed`);
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

      // Use the new auth service
      await signInWithOAuth(provider);
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
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-white">
              {mode === 'signin' ? 'Welcome Back' : 'Join Stone Caster'}
            </CardTitle>
            <p className="text-slate-300">
              {mode === 'signin' 
                ? 'Sign in to continue your adventure' 
                : 'Create your account to start playing'
              }
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-500/50 text-red-100">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs value={mode} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                <TabsTrigger value="signup" className="text-slate-300 data-[state=active]:text-white">
                  Sign Up
                </TabsTrigger>
                <TabsTrigger value="signin" className="text-slate-300 data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-slate-200">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-200">
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-400"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-slate-200">
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-slate-200">
                      Password
                    </Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-400"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-slate-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {oauthProviders.map((provider) => {
                const Icon = provider.icon;
                return (
                  <Button
                    key={provider.id}
                    variant="outline"
                    onClick={() => handleOAuthSignIn(provider.id as 'google' | 'github' | 'discord')}
                    disabled={oauthLoading === provider.id || isDemoMode}
                    className={`w-full ${provider.color} border-slate-600 text-white hover:text-white`}
                  >
                    {oauthLoading === provider.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 mr-2" />
                    )}
                    {oauthLoading === provider.id ? 'Connecting...' : `Continue with ${provider.name}`}
                  </Button>
                );
              })}
            </div>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-slate-400 hover:text-white"
              >
                Continue as Guest
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
