import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Sparkles } from 'lucide-react';

interface Choice {
  id: string;
  label: string;
  description?: string;
}

interface ChoiceButtonsProps {
  choices: Choice[];
  onChoiceSelect: (choice: Choice) => void;
  disabled?: boolean;
  className?: string;
}

export const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({
  choices,
  onChoiceSelect,
  disabled = false,
  className
}) => {
  if (choices.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Choose Your Action
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              variant="outline"
              className="h-auto p-4 text-left justify-start"
              onClick={() => onChoiceSelect(choice)}
              disabled={disabled}
            >
              <div className="flex flex-col items-start gap-2 w-full">
                <div className="flex items-center gap-2 w-full">
                  <Badge variant="secondary" className="text-xs">
                    Choice
                  </Badge>
                  <span className="font-medium flex-1">{choice.label}</span>
                </div>
                {choice.description && (
                  <p className="text-sm text-muted-foreground text-left">
                    {choice.description}
                  </p>
                )}
              </div>
            </Button>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Or describe your own action below
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
