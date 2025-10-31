import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Gem, Users, Zap, Shield, Brain, Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';
import { useWorldsQuery, useStoriesQuery } from '@/lib/queries';
import { trackCatalogCardClick } from '@/lib/analytics';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { initialize, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [showDrifter, setShowDrifter] = useState(false);
  
  // Load featured worlds and stories from live API
  const worldsQ = useWorldsQuery(undefined);
  const storiesQ = useStoriesQuery({ limit: 6 });
  
  const worlds = (worldsQ.data?.ok ? worldsQ.data.data : []).slice(0, 3);
  const stories = (storiesQ.data?.ok ? storiesQ.data.data : []).slice(0, 6);

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
    const desc = makeDescription('Discover interactive stories, choose your character, and begin your adventure on StoneCaster.');
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

  const handleWorldCardClick = (entity: string, idOrSlug: string) => {
    trackCatalogCardClick('worlds', idOrSlug);
  };

  const handleStoryCardClick = (entity: string, idOrSlug: string) => {
    trackCatalogCardClick('stories', idOrSlug);
  };

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Storytelling',
      description: 'Experience dynamic narratives that adapt to your choices and create unique adventures every time you play.'
    },
    {
      icon: Users,
      title: 'Multiplayer Adventures',
      description: 'Join friends in shared worlds where your decisions impact everyone\'s story and create lasting memories together.'
    },
    {
      icon: Zap,
      title: 'Instant Character Creation',
      description: 'Jump into the action with our streamlined character creation that gets you playing in minutes, not hours.'
    },
    {
      icon: Shield,
      title: 'Safe & Inclusive',
      description: 'Play in a welcoming environment with content moderation and community guidelines that ensure everyone has fun.'
    },
    {
      icon: Gem,
      title: 'Rich World Building',
      description: 'Explore meticulously crafted worlds with deep lore, complex characters, and endless possibilities for adventure.'
    },
    {
      icon: Globe,
      title: 'Cross-Platform',
      description: 'Play anywhere, anytime - on your phone, tablet, or computer. Your adventures sync seamlessly across all devices.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
              Your Story Awaits
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Enter a world where AI-powered storytelling meets your imagination. 
              Create characters, explore rich worlds, and shape epic adventures with friends.
            </p>
            
            {!isAuthenticated && (
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose Stone Caster?
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Experience the future of role-playing games with cutting-edge AI technology 
              and innovative gameplay mechanics.
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
        </div>
      </section>

      {/* Featured Worlds */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Featured Worlds
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Discover handcrafted worlds filled with rich lore, complex characters, 
              and endless possibilities for adventure.
            </p>
          </div>
          
          {worldsQ.isLoading ? (
            <CatalogGrid>
              {Array.from({ length: 3 }).map((_, i) => (
                <CatalogSkeleton key={i} />
              ))}
            </CatalogGrid>
          ) : (
            <CatalogGrid>
              {worlds.map((world) => (
                <CatalogCard
                  key={world.id}
                  entity="world"
                  idOrSlug={world.slug || world.id}
                  title={world.name}
                  description={world.description}
                  imageUrl={world.cover_url}
                  href={`/worlds/${world.slug || world.id}`}
                  onCardClick={handleWorldCardClick}
                />
              ))}
            </CatalogGrid>
          )}
          
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate('/worlds')}
            >
              View All Worlds
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Adventures */}
      <section className="py-20 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Popular Adventures
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Jump into these trending adventures and see what the community is playing.
            </p>
          </div>
          
          {storiesQ.isLoading ? (
            <CatalogGrid>
              {Array.from({ length: 6 }).map((_, i) => (
                <CatalogSkeleton key={i} />
              ))}
            </CatalogGrid>
          ) : (
            <CatalogGrid>
              {stories.map((story) => (
                <CatalogCard
                  key={story.id}
                  entity="story"
                  idOrSlug={story.slug || story.id}
                  title={story.title}
                  description={story.short_desc}
                  imageUrl={story.hero_url}
                  href={`/stories/${story.slug || story.id}`}
                  chips={story.world?.name ? [{ label: story.world.name, variant: 'secondary' as const }] : undefined}
                  onCardClick={handleStoryCardClick}
                />
              ))}
            </CatalogGrid>
          )}
          
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate('/stories')}
            >
              Browse All Stories
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Begin Your Adventure?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of players already exploring the worlds of Stone Caster. 
            Your epic story is just one click away.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
              onClick={() => navigate('/character-creation')}
            >
              Create Character
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10 px-8 py-3"
              onClick={() => navigate('/auth/signup')}
            >
              Sign Up Free
            </Button>
          </div>
        </div>
      </section>

      {/* Drifter Bubble */}
      {showDrifter && (
        <DrifterBubble
          message="Welcome to Stone Caster! I'm here to help you get started. Click on any world or adventure to begin your journey!"
          onDismiss={() => setShowDrifter(false)}
        />
      )}
    </div>
  );
}
