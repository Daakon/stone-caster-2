import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StoneCost } from './StoneCost';
import { Gem, Send } from 'lucide-react';

interface TurnInputProps {
  onSubmit: (action: string) => void;
  stoneCost: number;
  disabled?: boolean;
  placeholder?: string;
}

export const TurnInput: React.FC<TurnInputProps> = ({
  onSubmit,
  stoneCost,
  disabled = false,
  placeholder = "Describe your action..."
}) => {
  const [action, setAction] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.trim() && !disabled) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="action" className="text-sm font-medium">
          Your Action
        </label>
        <Textarea
          id="action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[100px] resize-none"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Cost: <StoneCost cost={stoneCost} size="sm" showIcon={false} />
          </span>
        </div>
        
        <Button
          type="submit"
          disabled={!action.trim() || disabled}
          className="flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          Cast Stone
        </Button>
      </div>
    </form>
  );
};
