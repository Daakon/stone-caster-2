import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import type { PlayerV3, WorldCharacterConfig } from '@shared';

interface TraitsStepProps {
  data: Partial<PlayerV3>;
  worldConfig: WorldCharacterConfig;
  onChange: (updates: Partial<PlayerV3>) => void;
  errors: Record<string, string>;
}

export const TraitsStep: React.FC<TraitsStepProps> = ({
  data,
  worldConfig,
  onChange,
  errors
}) => {
  const handleTraitChange = (traitId: string, checked: boolean) => {
    const currentTraits = data.traits || [];
    if (checked) {
      onChange({ traits: [...currentTraits, traitId] });
    } else {
      onChange({ traits: currentTraits.filter(t => t !== traitId) });
    }
  };

  // Group traits by category
  const traitsByCategory = worldConfig.traitCatalog.reduce((acc, trait) => {
    if (!acc[trait.category]) {
      acc[trait.category] = [];
    }
    acc[trait.category].push(trait);
    return acc;
  }, {} as Record<string, typeof worldConfig.traitCatalog>);

  const selectedTraits = data.traits || [];
  const selectedCount = selectedTraits.length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Character Traits</h2>
        <p className="text-muted-foreground">
          Choose 2-4 traits that define your character's personality and approach
        </p>
        <div className="mt-2">
          <Badge variant={selectedCount >= 2 && selectedCount <= 4 ? 'default' : 'destructive'}>
            {selectedCount} traits selected
          </Badge>
        </div>
      </div>

      {errors.traits && (
        <div className="text-red-500 text-center">
          {errors.traits}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(traitsByCategory).map(([category, traits]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg capitalize">{category} Traits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {traits.map(trait => (
                  <div key={trait.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={`trait-${trait.id}`}
                      checked={selectedTraits.includes(trait.id)}
                      onCheckedChange={(checked) => handleTraitChange(trait.id, checked as boolean)}
                      disabled={!selectedTraits.includes(trait.id) && selectedCount >= 4}
                    />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`trait-${trait.id}`} className="font-medium cursor-pointer">
                        {trait.label}
                      </Label>
                      {trait.description && (
                        <p className="text-sm text-muted-foreground">
                          {trait.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTraits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Traits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedTraits.map(traitId => {
                const trait = worldConfig.traitCatalog.find(t => t.id === traitId);
                return (
                  <Badge key={traitId} variant="secondary" className="text-sm">
                    {trait?.label || traitId}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

