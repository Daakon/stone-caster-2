import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import type { PlayerV3, WorldCharacterConfig } from '@shared';

interface SummaryStepProps {
  data: PlayerV3;
  worldConfig: WorldCharacterConfig;
}

const SKILL_LABELS: Record<string, string> = {
  combat: 'Combat',
  stealth: 'Stealth', 
  social: 'Social',
  lore: 'Lore',
  survival: 'Survival',
  medicine: 'Medicine',
  craft: 'Craft'
};

const getSkillTier = (value: number): string => {
  if (value <= 24) return 'Untrained';
  if (value <= 49) return 'Novice';
  if (value <= 74) return 'Adept';
  return 'Expert';
};

const getSkillTierColor = (value: number): string => {
  if (value <= 24) return 'bg-red-100 text-red-800';
  if (value <= 49) return 'bg-yellow-100 text-yellow-800';
  if (value <= 74) return 'bg-blue-100 text-blue-800';
  return 'bg-green-100 text-green-800';
};

export const SummaryStep: React.FC<SummaryStepProps> = ({
  data,
  worldConfig
}) => {
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Character Summary</h2>
        <p className="text-muted-foreground">
          Review your character before creation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Name:</span> {data.name}
            </div>
            <div>
              <span className="font-medium">Role:</span> {data.role}
            </div>
            <div>
              <span className="font-medium">Race:</span> {data.race}
            </div>
            <div>
              <span className="font-medium">Essence:</span>{' '}
              <div className="flex flex-wrap gap-1 mt-1">
                {data.essence.map(essence => (
                  <Badge key={essence} variant="outline">{essence}</Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><span className="font-medium">Age:</span> {data.age}</div>
              <div><span className="font-medium">Build:</span> {data.build}</div>
              <div><span className="font-medium">Eyes:</span> {data.eyes}</div>
            </div>
          </CardContent>
        </Card>

        {/* Traits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Traits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {data.traits.map(traitId => {
                const trait = worldConfig.traitCatalog.find(t => t.id === traitId);
                return (
                  <Badge key={traitId} variant="secondary">
                    {trait?.label || traitId}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.skills).map(([skill, value]) => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="text-sm">{SKILL_LABELS[skill]}</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{value}</span>
                    <Badge className={`text-xs ${getSkillTierColor(value)}`}>
                      {getSkillTier(value)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Starting Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Equipment will be determined based on your character's skills and the adventure you choose.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Background */}
      {(data.backstory || data.motivation) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.backstory && (
              <div>
                <div className="font-medium mb-1">Backstory</div>
                <p className="text-sm text-muted-foreground">{data.backstory}</p>
              </div>
            )}
            {data.motivation && (
              <div>
                <div className="font-medium mb-1">Motivation</div>
                <p className="text-sm text-muted-foreground">{data.motivation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* JSON Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Character Data (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
