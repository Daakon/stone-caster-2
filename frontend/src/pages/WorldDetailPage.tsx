import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AdventureCard } from '../components/cards/AdventureCard';
import { CardGrid } from '../components/cards/CardGrid';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { mockDataService } from '../services/mockData';
import { 
  MapPin, 
  Users, 
  Zap, 
  Star,
  ExternalLink
} from 'lucide-react';

export default function WorldDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);
  
  const world = id ? mockDataService.getWorldById(id) : null;
  const adventures = world ? mockDataService.getAdventuresByWorld(world.id) : [];
  
  if (!world) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">World Not Found</h1>
          <Button onClick={() => navigate('/worlds')}>
            Back to Worlds
          </Button>
        </div>
      </div>
    );
  }

  const handleAdventureStart = (adventureId: string) => {
    if (!isInvited) {
      // Show invite gate
      return;
    }
    navigate(`/adventures/${adventureId}`);
  };

  const handleAdventureViewDetails = (adventureId: string) => {
    navigate(`/adventures/${adventureId}`);
  };

  const differentiatorIcons = {
    relationships: Users,
    factions: MapPin,
    npcAgency: Users,
    worldRules: Zap
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Section */}
          <Card>
            <CardHeader className="p-0">
              <div className="relative overflow-hidden rounded-t-lg">
                <img
                  src={world.cover}
                  alt={world.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h1 className="text-3xl font-bold text-white mb-2">{world.title}</h1>
                  <p className="text-lg text-white/90">{world.tagline}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-2 mb-6">
                {world.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <p className="text-muted-foreground leading-relaxed mb-6">
                {world.description}
              </p>

              {/* World Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{adventures.length}</div>
                  <div className="text-sm text-muted-foreground">Adventures</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{world.rules?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">World Rules</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{world.differentiators?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Features</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {adventures.reduce((sum, adv) => sum + adv.stoneCost, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Stones</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* World Rules */}
          {world.rules && world.rules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  World Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorldRuleMeters rules={world.rules} />
              </CardContent>
            </Card>
          )}

          {/* Differentiators */}
          {world.differentiators && world.differentiators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What Makes This World Unique</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {world.differentiators.map((diff) => {
                    const Icon = differentiatorIcons[diff.type as keyof typeof differentiatorIcons] || Zap;
                    return (
                      <div key={diff.id} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                        <Icon className="h-6 w-6 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-semibold mb-2">{diff.title}</h4>
                          <p className="text-sm text-muted-foreground">{diff.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adventures */}
          <Card>
            <CardHeader>
              <CardTitle>Adventures in {world.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {adventures.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No Adventures Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Adventures for this world are coming soon
                  </p>
                </div>
              ) : (
                <CardGrid>
                  {adventures.map((adventure) => (
                    <AdventureCard
                      key={adventure.id}
                      adventure={adventure}
                      world={world}
                      onStart={handleAdventureStart}
                      onViewDetails={handleAdventureViewDetails}
                      isInvited={isInvited}
                    />
                  ))}
                </CardGrid>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate('/adventures')}
                className="w-full"
                variant="outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Browse All Adventures
              </Button>
              
              {adventures.length > 0 && (
                <Button
                  onClick={() => handleAdventureViewDetails(adventures[0].id)}
                  className="w-full"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Start First Adventure
                </Button>
              )}
            </CardContent>
          </Card>

          {/* World Info */}
          <Card>
            <CardHeader>
              <CardTitle>World Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium mb-1">Genre</h4>
                <p className="text-sm text-muted-foreground">{world.tags[0] || 'Fantasy'}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Complexity</h4>
                <p className="text-sm text-muted-foreground">
                  {world.rules && world.rules.length > 3 ? 'High' : 'Medium'}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Unique Features</h4>
                <p className="text-sm text-muted-foreground">
                  {world.differentiators?.length || 0} special mechanics
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
