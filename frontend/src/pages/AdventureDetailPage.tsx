import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { StoneCost } from '../components/gameplay/StoneCost';
import { mockDataService } from '../services/mockData';
import { 
  ArrowLeft, 
  Gem, 
  Users, 
  Zap, 
  ExternalLink, 
  Star,
  Clock,
  Shield,
  Eye,
} from 'lucide-react';

export default function AdventureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);
  
  const adventure = id ? mockDataService.getAdventureById(id) : null;
  const world = adventure ? mockDataService.getWorldById(adventure.worldId) : null;
  
  if (!adventure || !world) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Adventure Not Found</h1>
          <Button onClick={() => navigate('/adventures')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Adventures
          </Button>
        </div>
      </div>
    );
  }

  const handleStartAdventure = () => {
    if (!isInvited) {
      // Show invite gate modal or message
      return;
    }
    navigate(`/adventures/${adventure.id}/characters`);
  };

  const handleLearnAboutWorld = () => {
    navigate(`/worlds/${world.id}`);
  };

  const differentiatorIcons = {
    relationships: Users,
    factions: Shield,
    npcAgency: Eye,
    worldRules: Zap
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/adventures')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Adventures
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Section */}
          <Card>
            <CardHeader className="p-0">
              <div className="relative overflow-hidden rounded-t-lg">
                <img
                  src={adventure.cover}
                  alt={adventure.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <Star className="h-3 w-3 mr-1" />
                    {adventure.difficulty}
                  </Badge>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h1 className="text-3xl font-bold text-white mb-2">{adventure.title}</h1>
                  <p className="text-lg text-white/90">{adventure.excerpt}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Gem className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    <StoneCost cost={adventure.stoneCost} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">~2-4 hours</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {adventure.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <p className="text-muted-foreground leading-relaxed">
                {adventure.description}
              </p>
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
                      <div key={diff.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Icon className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-medium mb-1">{diff.title}</h4>
                          <p className="text-sm text-muted-foreground">{diff.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Card */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Ready to Begin?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start your adventure in {world.title}
                  </p>
                </div>

                <Button
                  onClick={handleStartAdventure}
                  disabled={!isInvited}
                  className="w-full"
                  size="lg"
                >
                  {isInvited ? 'Begin Adventure' : 'Invite Required'}
                </Button>

                <Separator />

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleLearnAboutWorld}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Learn About {world.title}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* World Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">World: {world.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {world.tagline}
              </p>
              <div className="flex flex-wrap gap-1">
                {world.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
