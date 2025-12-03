// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Action Input Component
 * Textarea + Send button for player input
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface ActionInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function ActionInput({ onSend, disabled = false }: ActionInputProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = input.trim();
    if (!trimmed || isProcessing || disabled) return;

    setIsProcessing(true);
    try {
      await onSend(trimmed);
      setInput(''); // Clear input on success
    } catch (error) {
      console.error('Error sending action:', error);
      // Error handling is done by parent component
    } finally {
      setIsProcessing(false);
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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What do you want to do?"
        disabled={isProcessing || disabled}
        className="min-h-[60px] resize-none"
        rows={2}
      />
      <Button
        type="submit"
        disabled={!input.trim() || isProcessing || disabled}
        className="self-end"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Casting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Cast
          </>
        )}
      </Button>
    </form>
  );
}

