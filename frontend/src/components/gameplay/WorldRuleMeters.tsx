import React from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { WorldRule } from '../../services/mockData';
import { cn } from '../../lib/utils';

interface WorldRuleMetersProps {
  rules: WorldRule[];
  className?: string;
}

export const WorldRuleMeters: React.FC<WorldRuleMetersProps> = ({
  rules,
  className
}) => {

  const getProgressValue = (current: number, min: number, max: number) => {
    return ((current - min) / (max - min)) * 100;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-lg">World Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{rule.name}</span>
              <span className="text-sm text-muted-foreground">
                {rule.current}/{rule.max}
              </span>
            </div>
            <Progress
              value={getProgressValue(rule.current, rule.min, rule.max)}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {rule.description}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
