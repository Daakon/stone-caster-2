import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { mockDataService } from '../services/mockData';
import type { World, Adventure } from '../services/mockData';
import { WorldCard } from '../components/cards/WorldCard';
import { AdventureCard } from '../components/cards/AdventureCard';
import { CardGrid } from '../components/cards/CardGrid';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Gem, Users, Zap, Shield, Brain, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [email, setEmail] = useState('');
  const [showDrifter, setShowDrifter] = useState(false);
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);

  useEffect(() => {
    // Load featured content
    const worldsData = mockDataService.getWorlds().slice(0, 3);
    const adventuresData = mockDataService.getAdventures().slice(0, 6);
    setWorlds(worldsData);
    setAdventures(adventuresData);

    // Show drifter bubble after a delay
    const timer = setTimeout(() => {
      setShowDrifter(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleViewWorld = (worldId: string) => {
    navigate(`/worlds/${worldId}`);
  };

  const handleLearnAboutWorld = (worldId: string) => {
    navigate(`/worlds/${worldId}`);
  };

  const handleStartAdventure = (adventureId: string) => {
    if (isInvited) {
      navigate(`/adventures/${adventureId}/characters`);
    } else {
      // Show invite gate message
      alert('This journey requires an invitation at this stage.');
    }
  };

  const handleViewAdventureDetails = (adventureId: string) => {
    navigate(`/adventures/${adventureId}`);
  };

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      alert('Thank you for your interest! We\'ll notify you when invitations are available.');
      setEmail('');
    }
  };

  const differentiators = [
    {
      icon: Users,
      title: 'Dynamic Relationships',
      description: 'NPCs remember your choices and adapt their behavior based on your actions'
    },
    {
      icon: Shield,
      title: 'Warring Factions',
      description: 'Your actions shift the balance of power between competing groups'
    },
    {
      icon: Brain,
      title: 'NPC Agency',
      description: 'Characters pursue their own goals, whether you\'re involved or not'
    },
    {
      icon: Zap,
      title: 'World-Specific Rules',
      description: 'Each world introduces unique mechanics and laws of play'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Gem className="h-4 w-4" />
              Cast stones to shape living worlds
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              StoneCaster
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              An AI-driven RPG where your choices matter, relationships evolve, and every world has its own rules. 
              Cast stones to influence the narrative and watch as your actions ripple through living, breathing worlds.
            </p>
          </div>

          {/* Invite-Only Banner */}
          <Card className="max-w-2xl mx-auto mb-12 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Currently Invite-Only Access</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                StoneCaster is in early access. Join our community to get notified when invitations become available.
              </p>
              <form onSubmit={handleSubmitEmail} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!email}>
                  Notify Me
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/adventures')}>
              Explore Adventures
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/worlds')}>
              Discover Worlds
            </Button>
          </div>
        </div>
      </section>

      {/* Differentiators Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What Makes StoneCaster Different</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Experience RPG storytelling that adapts to your choices and creates truly dynamic narratives.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {differentiators.map((diff, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <diff.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{diff.title}</h3>
                  <p className="text-sm text-muted-foreground">{diff.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Worlds */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Explore Living Worlds</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Each world has its own rules, factions, and unique mechanics that shape your adventure.
            </p>
          </div>
          <CardGrid columns={3}>
            {worlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                onViewDetails={handleViewWorld}
                onLearnMore={handleLearnAboutWorld}
              />
            ))}
          </CardGrid>
        </div>
      </section>

      {/* Featured Adventures */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured Adventures</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Begin your journey in these carefully crafted adventures across different worlds.
            </p>
          </div>
          <CardGrid columns={3}>
            {adventures.map((adventure) => (
              <AdventureCard
                key={adventure.id}
                adventure={adventure}
                onStart={handleStartAdventure}
                onViewDetails={handleViewAdventureDetails}
                isInvited={isInvited}
              />
            ))}
          </CardGrid>
        </div>
      </section>

      {/* Drifter Bubble */}
      {showDrifter && (
        <DrifterBubble
          message="This gateway is open only to invited travelers — for now. But the worlds beyond are waiting to be explored by those brave enough to cast their first stone."
          position="bottom-right"
          onDismiss={() => setShowDrifter(false)}
        />
      )}
    </div>
  );
}
