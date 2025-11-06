import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Brain, BookOpen, Users, Zap, Globe, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';
import { EarlyAccessBanner } from '@/components/earlyAccess/EarlyAccessBanner';
import { useAccessStatusContext } from '@/providers/AccessStatusProvider';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { initialize, isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [showDrifter, setShowDrifter] = useState(false);
  
  // Removed legacy queries for worlds and stories to reduce API calls

  // Use AccessStatusProvider context instead of duplicate query
  const { accessStatus, hasApprovedAccess } = useAccessStatusContext();
  const requestStatus = accessStatus?.status;
  const needsEarlyAccess = user && (!requestStatus || requestStatus === 'pending' || requestStatus === 'denied');

  const handleOAuthCallback = useCallback(async () => {
    try {
      console.log('[LandingPage] Processing OAuth callback...');
      
      // The AuthService will handle the OAuth callback automatically
      // Just re-initialize to get the updated auth state
      await initialize();
      
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Check if user is now authenticated
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        console.log('[LandingPage] OAuth successful, user authenticated');
        navigate('/');
      } else {
        console.log('[LandingPage] OAuth failed or user not authenticated');
        navigate('/auth/signin');
      }
    } catch (error) {
      console.error('[LandingPage] OAuth callback error:', error);
      navigate('/auth/signin?error=oauth_failed');
    }
  }, [initialize, navigate]);

  useEffect(() => {
    // Debug: Log all URL parameters
    console.log('[LandingPage] Current URL:', window.location.href);
    console.log('[LandingPage] Search params:', Object.fromEntries(searchParams.entries()));
    
    // Check for OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      console.error('[LandingPage] OAuth error detected:', error);
      console.error('[LandingPage] Error code:', searchParams.get('error_code'));
      console.error('[LandingPage] Error description:', searchParams.get('error_description'));
      // Don't return here, let the page load normally
    }
    
    if (code && state) {
      console.log('[LandingPage] OAuth callback detected, handling...');
      handleOAuthCallback();
      return;
    } else {
      console.log('[LandingPage] No OAuth callback detected, loading normal content');
    }

    // Show drifter bubble after a delay
    const timer = setTimeout(() => {
      setShowDrifter(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchParams, navigate, handleOAuthCallback]);

  useEffect(() => {
    const title = makeTitle(['StoneCaster — Cast your stone and begin a story']);
    const desc = makeDescription('Discover handcrafted Worlds, Scenarios, and Adventures on StoneCaster. Choose a story level ruleset, explore unique world mechanics, build relationships with NPCs, and shape consistent, adaptive stories enhanced by AI.');
    const url = absoluteUrl('/');
    const image = absoluteUrl('/og/home');
    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);
    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // TODO: Implement email signup
      console.log('Email signup:', email);
    }
  };

  const features = [
    {
      icon: Sparkles,
      title: 'Choices & Consequences',
      description: 'Every decision you make ripples through a living story. Outcomes reflect world state, logic, and past choices, so each playthrough feels personal and meaningful.'
    },
    {
      icon: BookOpen,
      title: 'Rule Driven Stories',
      description: 'Rules are picked at the story level using a chosen ruleset. These rules guide outcomes, ensure consistency, and define how skills, factions, and progression influence your journey.'
    },
    {
      icon: Users,
      title: 'Dynamic Relationship Systems',
      description: 'Form bonds, rivalries, and trust with NPCs who remember your actions. Social and emotional choices shape how characters respond over time.'
    },
    {
      icon: Brain,
      title: 'AI Powered Storytelling',
      description: 'StoneCaster stories begin with detailed, custom written content created by humans. AI enhances these stories by adapting them to your choices and keeping the world consistent from scene to scene.'
    },
    {
      icon: Zap,
      title: 'Instant Character Creation',
      description: 'Start fast with guided character creation that fits each world\'s lore and tone. Build a background that connects to the story and matters in play.'
    },
    {
      icon: Globe,
      title: 'Play Anywhere',
      description: 'Continue your story across devices with synced progress on desktop, tablet, or mobile.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 pt-4">
        <EarlyAccessBanner />
      </div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
              Your Story Awaits
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Enter handcrafted worlds powered by adaptive AI and deep storytelling systems. Worlds, Scenarios, Adventures, NPCs, and Rulesets are all custom built; rules are chosen at the story level, and each world includes unique mechanics that can interact with those rules.
            </p>
            
            {/* Only show email form for unauthenticated users without access requirement */}
            {!isAuthenticated && !needsEarlyAccess && (
              <div className="max-w-md mx-auto mb-8">
                <form onSubmit={handleEmailSubmit} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter your email for early access"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-300"
                  />
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    Join Waitlist
                  </Button>
                </form>
              </div>
            )}

            {/* Only show buttons if access is approved or user is not authenticated/doesn't need access */}
            {!needsEarlyAccess && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {hasApprovedAccess ? (
                  <Button 
                    size="lg" 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
                    onClick={() => navigate('/stories')}
                  >
                    Explore Stories
                  </Button>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
                      onClick={() => navigate('/worlds')}
                    >
                      Explore Worlds
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10 px-8 py-3"
                      onClick={() => navigate('/auth/signin')}
                    >
                      Sign In
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="why-stonecaster" className="py-20 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose StoneCaster?
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Experience immersive storytelling shaped by handcrafted content, story level rulesets, and adaptive AI. Worlds contribute unique mechanics, enabling advanced relationships, skill systems, progression, and factions across your adventures.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-purple-600/20 rounded-lg">
                        <Icon className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Footnote */}
          <p className="text-center mt-8 text-sm text-slate-400">
            Stories are curated and community reviewed, but AI output may vary. Please report any issues so we can keep improving.
          </p>
        </div>
      </section>


      {/* Drifter Bubble */}
      {showDrifter && (
        <DrifterBubble
          message="Welcome to StoneCaster! I'm here to help you get started. Click on any world or adventure to begin your journey!"
          onDismiss={() => setShowDrifter(false)}
        />
      )}
    </div>
  );
}
