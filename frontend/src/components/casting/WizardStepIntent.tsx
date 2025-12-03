/**
 * WizardStepIntent Component
 * Phase 3-C: Guided Wizard Flow
 * Step 0: Intent selection - Genre cards for filtering worlds
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Rocket, Skull, Shield, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntentGenre } from '@/stores/useCastingStore';

interface WizardStepIntentProps {
  selectedIntent: IntentGenre | null;
  onSelectIntent: (intent: IntentGenre) => void;
}

const GENRES: Array<{
  id: IntentGenre;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'high-fantasy',
    name: 'High Fantasy',
    description: 'Magic, dragons, and epic quests',
    icon: Sparkles,
  },
  {
    id: 'sci-fi',
    name: 'Sci-Fi',
    description: 'Technology, space, and the future',
    icon: Rocket,
  },
  {
    id: 'horror',
    name: 'Horror',
    description: 'Darkness, fear, and the unknown',
    icon: Skull,
  },
  {
    id: 'survival',
    name: 'Survival',
    description: 'Resource management and endurance',
    icon: Shield,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Choose from all available worlds',
    icon: Wrench,
  },
];

export function WizardStepIntent({ selectedIntent, onSelectIntent }: WizardStepIntentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 0: Choose Your Intent</CardTitle>
        <CardDescription>
          Select a genre to filter worlds, or choose Custom to see all options
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GENRES.map((genre) => {
            const Icon = genre.icon;
            const isSelected = selectedIntent === genre.id;
            return (
              <Card
                key={genre.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 border-primary'
                    : 'hover:border-primary/50'
                )}
                onClick={() => onSelectIntent(genre.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectIntent(genre.id);
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <CardTitle className="text-lg">{genre.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{genre.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

