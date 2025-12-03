/**
 * Message Log Component
 * Displays the conversation history between player and game
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

export interface Message {
  id: string;
  type: 'player' | 'narrative';
  content: string;
  timestamp: Date;
}

interface MessageLogProps {
  messages: Message[];
  className?: string;
}

export function MessageLog({ messages, className }: MessageLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex-1 overflow-y-auto space-y-4 p-4',
        'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
        className
      )}
      role="log"
      aria-live="polite"
      aria-label="Game conversation log"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Your adventure begins here...</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.type === 'player' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.type === 'narrative' && (
              <div className="flex-shrink-0 mt-1">
                <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-4 py-2 max-w-[85%] sm:max-w-[75%]',
                message.type === 'player'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.type === 'player' && (
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-semibold">You</span>
                </div>
              )}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {message.content}
              </p>
              <time
                className="text-xs opacity-70 mt-1 block"
                dateTime={message.timestamp.toISOString()}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            {message.type === 'player' && (
              <div className="flex-shrink-0 mt-1">
                <User className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

