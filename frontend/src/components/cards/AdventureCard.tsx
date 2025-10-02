import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Adventure, World } from '../../services/mockData';
import { Gem } from 'lucide-react';

interface AdventureCardProps {
  adventure: Adventure;
  world?: World;
  onStart: (adventureId: string) => void;
  onViewDetails: (adventureId: string) => void;
  isInvited: boolean;
}


export const AdventureCard: React.FC<AdventureCardProps> = ({
  adventure,
  world,
  onStart,
  onViewDetails,
  isInvited
}) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
      <CardHeader className="p-0">
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={adventure.cover}
            alt={adventure.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-background/80 text-foreground border-border">
              {world?.title || 'Unknown World'}
            </Badge>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl font-bold text-white mb-1">{adventure.title}</h3>
            <p className="text-sm text-white/90">{adventure.excerpt}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gem className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {adventure.stoneCost} Casting Stones
          </span>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {adventure.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {adventure.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{adventure.tags.length - 3} more
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <p className="line-clamp-2">{adventure.description}</p>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(adventure.id)}
          className="flex-1"
        >
          View Details
        </Button>
        <Button
          size="sm"
          onClick={() => onStart(adventure.id)}
          disabled={!isInvited}
          className="flex-1"
        >
          {isInvited ? 'Start Adventure' : 'Invite Required'}
        </Button>
      </CardFooter>
    </Card>
  );
};
