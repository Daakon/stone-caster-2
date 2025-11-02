import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StoneCost } from './StoneCost';
import { Gem, Send, Loader2 } from 'lucide-react';

interface TurnInputProps {
  onSubmit: (action: string) => void;
  stoneCost: number;
  disabled?: boolean;
  placeholder?: string;
  hasChoices?: boolean;
}

export const TurnInput: React.FC<TurnInputProps> = ({
  onSubmit,
  stoneCost,
  disabled = false,
  placeholder = "Describe your action...",
  hasChoices = false
}) => {
  const [action, setAction] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.trim() && !disabled) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  // Phase 8: Submit on Enter key (Ctrl/Cmd+Enter also works)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
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
          onKeyDown={handleKeyDown}
          placeholder={hasChoices ? "Or describe your own action..." : placeholder}
          disabled={disabled}
          className="min-h-[100px] resize-none"
          aria-label="Turn message input"
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
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {disabled ? 'Processing...' : 'Cast Stone'}
        </Button>
      </div>
    </form>
  );
};




