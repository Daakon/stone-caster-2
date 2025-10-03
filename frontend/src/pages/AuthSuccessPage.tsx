import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { GuestCookieService } from '../services/guestCookie';

export default function AuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { initialize } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        console.log('[AuthSuccessPage] Handling OAuth callback');
        
        // Get the return URL from query params
        const returnTo = searchParams.get('returnTo') || '/';
        
        // Check if this is a backend OAuth callback with user data
        const userParam = searchParams.get('user');
        if (userParam) {
          try {
            const userData = JSON.parse(decodeURIComponent(userParam));
            console.log('[AuthSuccessPage] Backend OAuth callback with user data:', userData);
            
            // The backend has already handled the OAuth callback and account linking
            // We just need to initialize the auth store and redirect
            await initialize();
            
            // Small delay to ensure auth state is updated
            setTimeout(() => {
              setLoading(false);
              // Navigate to the return URL or home
              navigate(returnTo, { replace: true });
            }, 1000);
            
            return;
          } catch (parseError) {
            console.error('[AuthSuccessPage] Error parsing user data:', parseError);
            // Fall through to client-side OAuth handling
          }
        }
        
        // Handle client-side OAuth callback (fallback)
        console.log('[AuthSuccessPage] Handling client-side OAuth callback');
        
        // Set up auth state change listener to detect when session becomes available
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[AuthSuccessPage] Auth state changed:', event, !!session);
          
          if (event === 'SIGNED_IN' && session) {
            console.log('[AuthSuccessPage] User signed in successfully');
            
            // For client-side OAuth, we need to link the guest account
            const guestCookieId = GuestCookieService.getGuestCookieForApi();
            if (guestCookieId) {
              console.log('[AuthSuccessPage] Linking guest account:', guestCookieId);
              try {
                // Call the backend to link the guest account
                const apiBaseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
                const linkResponse = await fetch(`${apiBaseUrl}/api/profile/link-guest`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ cookieGroupId: guestCookieId }),
                });
                
                if (linkResponse.ok) {
                  console.log('[AuthSuccessPage] Guest account linked successfully');
                } else {
                  console.warn('[AuthSuccessPage] Failed to link guest account:', linkResponse.status);
                }
              } catch (linkError) {
                console.warn('[AuthSuccessPage] Error linking guest account:', linkError);
              }
            }
            
            // Re-initialize auth to update the store
            await initialize();
            
            // Small delay to ensure auth state is updated
            setTimeout(() => {
              setLoading(false);
              // Navigate to the return URL or home
              navigate(returnTo, { replace: true });
            }, 1000);
            
            // Unsubscribe from auth state changes
            subscription.unsubscribe();
          } else if (event === 'SIGNED_OUT') {
            console.error('[AuthSuccessPage] User was signed out during OAuth callback');
            setError('Authentication failed. Please try again.');
            setLoading(false);
            subscription.unsubscribe();
          }
        });
        
        // Also try to get the current session in case it's already available
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthSuccessPage] Error getting session:', error);
          throw error;
        }
        
        if (session) {
          console.log('[AuthSuccessPage] Session already available:', !!session);
          
          // For client-side OAuth, we need to link the guest account
          const guestCookieId = GuestCookieService.getGuestCookieForApi();
          if (guestCookieId) {
            console.log('[AuthSuccessPage] Linking guest account:', guestCookieId);
            try {
              // Call the backend to link the guest account
              const apiBaseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
              const linkResponse = await fetch(`${apiBaseUrl}/api/profile/link-guest`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ cookieGroupId: guestCookieId }),
              });
              
              if (linkResponse.ok) {
                console.log('[AuthSuccessPage] Guest account linked successfully');
              } else {
                console.warn('[AuthSuccessPage] Failed to link guest account:', linkResponse.status);
              }
            } catch (linkError) {
              console.warn('[AuthSuccessPage] Error linking guest account:', linkError);
            }
          }
          
          // Re-initialize auth to update the store
          await initialize();
          
          // Small delay to ensure auth state is updated
          setTimeout(() => {
            setLoading(false);
            // Navigate to the return URL or home
            navigate(returnTo, { replace: true });
          }, 1000);
          
          // Unsubscribe from auth state changes
          subscription.unsubscribe();
        } else {
          console.log('[AuthSuccessPage] No session yet, waiting for auth state change...');
          // Set a timeout to prevent infinite waiting
          setTimeout(() => {
            if (loading) {
              console.error('[AuthSuccessPage] Timeout waiting for OAuth callback');
              setError('Authentication timed out. Please try again.');
              setLoading(false);
              subscription.unsubscribe();
            }
          }, 10000); // 10 second timeout
        }
      } catch (err) {
        console.error('[AuthSuccessPage] Auth success handling error:', err);
        setError('Failed to complete authentication. Please try again.');
        setLoading(false);
      }
    };

    handleAuthSuccess();
  }, [searchParams, navigate, initialize, loading]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h1 className="text-xl font-semibold mb-2">Completing Authentication</h1>
            <p className="text-muted-foreground">
              Please wait while we set up your account...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold mb-2">Authentication Error</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/auth')}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Welcome to StoneCaster!</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been successfully created and linked.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Start Your Adventure
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
