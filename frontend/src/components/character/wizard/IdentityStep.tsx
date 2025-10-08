import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Textarea } from '../../ui/textarea';
import type { PlayerV3, WorldCharacterConfig } from '@shared';

interface IdentityStepProps {
  data: Partial<PlayerV3>;
  worldConfig: WorldCharacterConfig;
  onChange: (updates: Partial<PlayerV3>) => void;
  errors: Record<string, string>;
}

export const IdentityStep: React.FC<IdentityStepProps> = ({
  data,
  worldConfig,
  onChange,
  errors
}) => {
  const handleEssenceChange = (essence: string, checked: boolean) => {
    const currentEssence = data.essence || [];
    
    if (checked) {
      // Check for opposing pairs
      const opposingPairs = {
        'Life': 'Death',
        'Death': 'Life',
        'Order': 'Chaos',
        'Chaos': 'Order'
      };
      
      const opposing = opposingPairs[essence as keyof typeof opposingPairs];
      const hasOpposing = currentEssence.includes(opposing);
      
      if (hasOpposing) {
        // Remove opposing essence first
        const filteredEssence = currentEssence.filter(e => e !== opposing);
        onChange({ essence: [...filteredEssence, essence] });
      } else if (currentEssence.length < 2) {
        // Add essence if under limit
        onChange({ essence: [...currentEssence, essence] });
      }
    } else {
      onChange({ essence: currentEssence.filter(e => e !== essence) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Character Identity</h2>
        <p className="text-muted-foreground">
          Define your character's basic identity and appearance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Character Name *</Label>
              <Input
                id="name"
                value={data.name || ''}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Enter character name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                value={data.role || ''}
                onChange={(e) => onChange({ role: e.target.value })}
                placeholder="e.g., Scholar, Warrior, Scout"
                className={errors.role ? 'border-red-500' : ''}
              />
              {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role}</p>}
            </div>

            <div>
              <Label htmlFor="race">Race *</Label>
              <Select value={data.race || ''} onValueChange={(value) => onChange({ race: value })}>
                <SelectTrigger className={errors.race ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select race" />
                </SelectTrigger>
                <SelectContent>
                  {worldConfig.availableRaces.map(race => (
                    <SelectItem key={race} value={race}>{race}</SelectItem>
                  ))}
                  <SelectItem value="custom">Other (specify)</SelectItem>
                </SelectContent>
              </Select>
              {data.race === 'custom' && (
                <Input
                  placeholder="Enter custom race"
                  value={data.race || ''}
                  onChange={(e) => onChange({ race: e.target.value })}
                  className="mt-2"
                />
              )}
              {errors.race && <p className="text-red-500 text-sm mt-1">{errors.race}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Essence Alignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Choose exactly 2 essence alignments *</Label>
              <p className="text-sm text-muted-foreground">
                Select 2 essences. Opposing pairs (Life/Death, Order/Chaos) cannot be selected together.
              </p>
              {errors.essence && <p className="text-red-500 text-sm">{errors.essence}</p>}
              <div className="grid grid-cols-2 gap-3">
                {worldConfig.essenceOptions.map(essence => {
                  const isSelected = data.essence?.includes(essence) || false;
                  const opposingPairs = {
                    'Life': 'Death',
                    'Death': 'Life',
                    'Order': 'Chaos',
                    'Chaos': 'Order'
                  };
                  const opposing = opposingPairs[essence as keyof typeof opposingPairs];
                  const hasOpposing = data.essence?.includes(opposing) || false;
                  const isDisabled = !isSelected && (data.essence?.length ?? 0) >= 2 && !hasOpposing;
                  
                  return (
                    <div key={essence} className={`flex items-center space-x-2 p-2 rounded border ${
                      isSelected ? 'bg-primary/10 border-primary' : 
                      hasOpposing ? 'bg-red-50 border-red-200' : 
                      isDisabled ? 'opacity-50' : 'hover:bg-muted/50'
                    }`}>
                      <Checkbox
                        id={`essence-${essence}`}
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => handleEssenceChange(essence, checked as boolean)}
                      />
                      <Label htmlFor={`essence-${essence}`} className="text-sm cursor-pointer">
                        {essence}
                        {hasOpposing && <span className="text-red-500 text-xs ml-1">(opposing)</span>}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: {data.essence?.length ?? 0}/2
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Physical Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                value={data.age || ''}
                onChange={(e) => onChange({ age: e.target.value })}
                placeholder="e.g., Young, Middle-aged, Elderly"
                className={errors.age ? 'border-red-500' : ''}
              />
              {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
            </div>

            <div>
              <Label htmlFor="build">Build *</Label>
              <Input
                id="build"
                value={data.build || ''}
                onChange={(e) => onChange({ build: e.target.value })}
                placeholder="e.g., Lean, Muscular, Stocky"
                className={errors.build ? 'border-red-500' : ''}
              />
              {errors.build && <p className="text-red-500 text-sm mt-1">{errors.build}</p>}
            </div>

            <div>
              <Label htmlFor="eyes">Eyes *</Label>
              <Input
                id="eyes"
                value={data.eyes || ''}
                onChange={(e) => onChange({ eyes: e.target.value })}
                placeholder="e.g., Piercing blue, Warm brown"
                className={errors.eyes ? 'border-red-500' : ''}
              />
              {errors.eyes && <p className="text-red-500 text-sm mt-1">{errors.eyes}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Background (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="backstory">Backstory</Label>
            <Textarea
              id="backstory"
              value={data.backstory || ''}
              onChange={(e) => onChange({ backstory: e.target.value })}
              placeholder="A brief background story for your character..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="motivation">Motivation</Label>
            <Textarea
              id="motivation"
              value={data.motivation || ''}
              onChange={(e) => onChange({ motivation: e.target.value })}
              placeholder="What drives your character forward?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
