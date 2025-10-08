import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Minus, Plus } from 'lucide-react';
import type { PlayerV3, SkillKey, CharacterCreationConfig } from '@shared';
import { 
  SKILL_CONSTANTS, 
  getRemainingSkillPoints, 
  getSkillCost, 
  getSkillLevel 
} from '@shared/config/character-creation.config';

interface SkillsStepProps {
  data: Partial<PlayerV3>;
  config: CharacterCreationConfig;
  onChange: (updates: Partial<PlayerV3>) => void;
  errors: Record<string, string>;
}

const SKILL_LABELS: Record<SkillKey, string> = {
  combat: 'Combat',
  stealth: 'Stealth', 
  social: 'Social',
  lore: 'Lore',
  survival: 'Survival',
  medicine: 'Medicine',
  craft: 'Craft'
};

const SKILL_DESCRIPTIONS: Record<SkillKey, string> = {
  combat: 'Physical combat, weapons, and tactical fighting',
  stealth: 'Sneaking, hiding, and moving unseen',
  social: 'Persuasion, negotiation, and social interaction',
  lore: 'Knowledge, history, and academic learning',
  survival: 'Wilderness skills, tracking, and endurance',
  medicine: 'Healing, first aid, and medical knowledge',
  craft: 'Creating, repairing, and working with tools'
};

export const SkillsStep: React.FC<SkillsStepProps> = ({
  data,
  config,
  onChange,
  errors
}) => {
  const skills = data.skills || {};
  const remainingPoints = getRemainingSkillPoints(skills, config.skillBudget);

  const updateSkill = (skill: SkillKey, delta: number) => {
    const currentValue = skills[skill] || SKILL_CONSTANTS.BASELINE;
    const newValue = Math.max(
      SKILL_CONSTANTS.MIN,
      Math.min(SKILL_CONSTANTS.MAX, currentValue + delta)
    );
    
    // Check if the change is affordable
    const cost = getSkillCost(currentValue, newValue);
    if (cost > 0 && cost > remainingPoints) {
      return; // Can't afford this increase
    }
    
    onChange({
      skills: {
        ...skills,
        [skill]: newValue
      }
    });
  };

  const getSkillTierColor = (value: number): string => {
    if (value < 30) return 'bg-red-100 text-red-800';
    if (value < 50) return 'bg-orange-100 text-orange-800';
    if (value < 60) return 'bg-yellow-100 text-yellow-800';
    if (value < 70) return 'bg-blue-100 text-blue-800';
    if (value < 80) return 'bg-indigo-100 text-indigo-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Skill Allocation</h2>
        <p className="text-muted-foreground">
          50 = Average. Allocate your 20 points with scaling costs.
        </p>
        <div className="mt-4">
          <Badge 
            variant={remainingPoints > 0 ? 'default' : 'secondary'} 
            className={`text-lg px-4 py-2 ${
              remainingPoints > 0 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {remainingPoints > 0 ? `${remainingPoints} points to allocate` : 'All points allocated'}
          </Badge>
        </div>
      </div>

      {errors.skills && (
        <div className="text-red-500 text-center">
          {errors.skills}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(SKILL_LABELS) as SkillKey[]).map(skill => {
          const value = skills[skill] || SKILL_CONSTANTS.BASELINE;
          const increaseCost = getSkillCost(value, value + 1);
          const canIncrease = value < SKILL_CONSTANTS.MAX && remainingPoints >= increaseCost;
          const canDecrease = value > SKILL_CONSTANTS.MIN;
          
          return (
            <Card key={skill} className="h-fit">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-medium">
                      {SKILL_LABELS[skill]}
                    </Label>
                    <Badge className={getSkillTierColor(value)}>
                      {getSkillLevel(value)}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {SKILL_DESCRIPTIONS[skill]}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSkill(skill, -1)}
                        disabled={!canDecrease}
                        aria-label={`Decrease ${SKILL_LABELS[skill]}`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <div className="w-12 text-center">
                        <span className="text-xl font-bold">{value}</span>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSkill(skill, 1)}
                        disabled={!canIncrease}
                        aria-label={`Increase ${SKILL_LABELS[skill]}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {increaseCost > 0 && `+${increaseCost}pt`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual skill bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-200"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Skill Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(SKILL_LABELS) as SkillKey[]).map(skill => {
              const value = skills[skill] || SKILL_CONSTANTS.BASELINE;
              return (
                <div key={skill} className="text-center">
                  <div className="text-sm text-muted-foreground">{SKILL_LABELS[skill]}</div>
                  <div className="text-lg font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{getSkillLevel(value)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
