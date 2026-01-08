/**
 * Play Input Component
 * Free-text input for player actions
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayInputProps {
  onSubmit: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function PlayInput({ onSubmit, disabled = false, placeholder = 'What do you do?' }: PlayInputProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('[Debug] PlayInput handleSubmit called', { input, disabled, isSubmitting });
    if (!input.trim() || disabled || isSubmitting) return;

    const text = input.trim();
    setInput('');
    setIsSubmitting(true);

    try {
      console.log('[Debug] Calling onSubmit prop');
      await onSubmit(text);
      console.log('[Debug] onSubmit prop completed');
    } catch (error) {
      // Error handling is done by parent
      console.error('Error submitting action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but allow Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSubmitting}
            rows={2}
            className="resize-none"
            aria-label="Player action input"
          />
        </div>
        <Button
          type="submit"
          disabled={!input.trim() || disabled || isSubmitting}
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
          aria-label="Submit action"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-1">
        Press Enter to submit, Shift+Enter for new line
      </p>
    </form>
  );
}

