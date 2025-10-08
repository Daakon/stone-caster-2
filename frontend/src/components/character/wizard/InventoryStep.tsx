import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Badge } from '../../ui/badge';
import { Check } from 'lucide-react';
import type { PlayerV3, WorldCharacterConfig } from '@shared';
import { getEligibleKits } from '@shared/config/character-creation.config';

interface InventoryStepProps {
  data: Partial<PlayerV3>;
  worldConfig: WorldCharacterConfig;
  onChange: (updates: Partial<PlayerV3>) => void;
  errors: Record<string, string>;
}

export const InventoryStep: React.FC<InventoryStepProps> = ({
  data,
  worldConfig,
  onChange,
  errors
}) => {
  const skills = data.skills || {};
  const eligibleKits = getEligibleKits(skills, worldConfig);
  const selectedKit = data.inventory?.[0] || '';

  const handleKitSelection = (kitId: string) => {
    const kit = worldConfig.eligibleKits.find(k => k.id === kitId);
    if (kit) {
      onChange({ inventory: [kitId] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Starting Equipment</h2>
        <p className="text-muted-foreground">
          Choose a starting kit based on your skills
        </p>
      </div>

      {errors.inventory && (
        <div className="text-red-500 text-center">
          {errors.inventory}
        </div>
      )}

      {eligibleKits.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No kits are available with your current skill levels.
              <br />
              Consider adjusting your skills to unlock equipment options.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <RadioGroup
            value={selectedKit}
            onValueChange={handleKitSelection}
            className="space-y-4"
          >
            {eligibleKits.map(kit => (
              <Card key={kit.id} className={`cursor-pointer transition-all ${
                selectedKit === kit.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value={kit.id} id={kit.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Label htmlFor={kit.id} className="text-lg font-medium cursor-pointer">
                          {kit.label}
                        </Label>
                        {selectedKit === kit.id && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Equipment included:</p>
                          <div className="flex flex-wrap gap-1">
                            {kit.items.map((item, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Requirements:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(kit.requirements).map(([skill, threshold]) => (
                              <Badge 
                                key={skill} 
                                variant={(skills[skill as keyof typeof skills] || 0) >= threshold ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {skill}: {threshold}+
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </div>
      )}

      {selectedKit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Kit</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const kit = worldConfig.eligibleKits.find(k => k.id === selectedKit);
              if (!kit) return null;
              
              return (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">{kit.label}</h4>
                    <div className="flex flex-wrap gap-1">
                      {kit.items.map((item, index) => (
                        <Badge key={index} variant="outline" className="text-sm">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
