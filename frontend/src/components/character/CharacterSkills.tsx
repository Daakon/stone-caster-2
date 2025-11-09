import React from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getSkillLevel } from '@shared/config/character-creation.config';

interface CharacterSkillsProps {
  skills: Record<string, number>;
  showAll?: boolean;
  maxSkills?: number;
}

export const CharacterSkills: React.FC<CharacterSkillsProps> = ({ 
  skills, 
  showAll = false, 
  maxSkills = 3 
}) => {
  const skillEntries = Object.entries(skills);
  const displaySkills = showAll ? skillEntries : skillEntries.slice(0, maxSkills);
  
  return (
    <div className="space-y-2">
      {displaySkills.map(([skill, value]) => (
        <div key={skill} className="flex items-center justify-between">
          <span className="text-sm font-medium capitalize">
            {skill.replace('_', ' ')}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${value}%` }}
              />
            </div>
            <Badge variant="secondary" className="text-xs">
              {getSkillLevel(value)}
            </Badge>
          </div>
        </div>
      ))}
      {!showAll && skillEntries.length > maxSkills && (
        <div className="text-xs text-muted-foreground text-center">
          +{skillEntries.length - maxSkills} more skills
        </div>
      )}
    </div>
  );
};

export const CharacterSkillsCard: React.FC<CharacterSkillsProps> = ({ 
  skills, 
  showAll = false 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Skills</CardTitle>
      </CardHeader>
      <CardContent>
        <CharacterSkills skills={skills} showAll={showAll} />
      </CardContent>
    </Card>
  );
};



