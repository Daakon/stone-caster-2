import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Adventure } from '../../services/mockData';
import { Gem, ExternalLink, Users, Zap } from 'lucide-react';
import { mockDataService } from '../../services/mockData';

interface AdventureModalProps {
  adventure: Adventure | null;
  isOpen: boolean;
  onClose: () => void;
  onStart: (adventureId: string) => void;
  onViewDetails: (adventureId: string) => void;
  onLearnAboutWorld: (worldId: string) => void;
  isInvited: boolean;
}

const difficultyColors = {
  easy: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  hard: 'bg-red-100 text-red-800 border-red-200'
};

const difficultyIcons = {
  easy: '⭐',
  medium: '⭐⭐',
  hard: '⭐⭐⭐'
};

export const AdventureModal: React.FC<AdventureModalProps> = ({
  adventure,
  isOpen,
  onClose,
  onStart,
  onViewDetails,
  onLearnAboutWorld,
  isInvited
}) => {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && firstButtonRef.current) {
      // Focus the first button when modal opens
      firstButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!adventure) return null;

  const world = mockDataService.getWorldById(adventure.worldId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="relative">
            <img
              src={adventure.cover}
              alt={adventure.title}
              className="w-full h-64 object-cover rounded-lg mb-4"
            />
            <div className="absolute top-4 right-4">
              <Badge className={difficultyColors[adventure.difficulty]}>
                {difficultyIcons[adventure.difficulty]} {adventure.difficulty}
              </Badge>
            </div>
          </div>
          <DialogTitle className="text-2xl">{adventure.title}</DialogTitle>
          <DialogDescription className="text-lg">
            {adventure.excerpt}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stone Cost */}
          <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
            <Gem className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-primary">
              {adventure.stoneCost} Casting Stones
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Adventure Description</h3>
            <p className="text-muted-foreground">{adventure.description}</p>
          </div>

          {/* Scenarios */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Possible Scenarios</h3>
            <ul className="space-y-2">
              {adventure.scenarios.map((scenario, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary font-bold">{index + 1}.</span>
                  <span className="text-muted-foreground">{scenario}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {adventure.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* World Information */}
          {world && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">World: {world.title}</h3>
              <p className="text-muted-foreground mb-4">{world.tagline}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Key Features
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {world.differentiators.map((diff) => (
                      <li key={diff.id}>• {diff.title}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    World Rules
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {world.rules.map((rule) => (
                      <li key={rule.id}>• {rule.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            ref={firstButtonRef}
            variant="outline"
            onClick={() => onLearnAboutWorld(adventure.worldId)}
            aria-label={`Learn about ${world?.title || 'this world'}`}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Learn About World
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onViewDetails(adventure.id);
              onClose();
            }}
            aria-label={`View details for ${adventure.title}`}
          >
            View Details
          </Button>
          <Button
            onClick={() => {
              onStart(adventure.id);
              onClose();
            }}
            disabled={!isInvited}
            aria-label={isInvited ? `Start ${adventure.title} adventure` : 'Invite required to start adventure'}
          >
            {isInvited ? 'Start Adventure' : 'Invite Required'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
