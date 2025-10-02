import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { World } from '../../services/mockData';
import { ExternalLink, Users, Zap } from 'lucide-react';

interface WorldCardProps {
  world: World;
  onViewDetails: (worldId: string) => void;
  onLearnMore: (worldId: string) => void;
}

export const WorldCard: React.FC<WorldCardProps> = ({
  world,
  onViewDetails,
  onLearnMore
}) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
      <CardHeader className="p-0">
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={world.cover}
            alt={world.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl font-bold text-white mb-1">{world.title}</h3>
            <p className="text-sm text-white/90">{world.tagline}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {world.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {world.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {world.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{world.tags.length - 3} more
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{world.differentiators.length} unique features</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{world.rules.length} world rules</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLearnMore(world.id)}
          className="flex-1"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Learn More
        </Button>
        <Button
          size="sm"
          onClick={() => onViewDetails(world.id)}
          className="flex-1"
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};
