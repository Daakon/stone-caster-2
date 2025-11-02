import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeBlockProps {
  content: string;
  language?: string;
  maxDisplayChars?: number;
  className?: string;
  'aria-label'?: string;
}

export function CodeBlock({ 
  content, 
  language = 'text',
  maxDisplayChars = 50000,
  className = '',
  'aria-label': ariaLabel,
}: CodeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > maxDisplayChars;
  const displayContent = shouldTruncate && !expanded 
    ? content.substring(0, maxDisplayChars) + '...[TRUNCATED]'
    : content;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-7 text-xs"
          aria-label={ariaLabel || 'Copy to clipboard'}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-xs"
            aria-label={expanded ? 'Collapse' : 'Expand full content'}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand ({content.length.toLocaleString()} chars)
              </>
            )}
          </Button>
        )}
      </div>
      <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
        <pre className="text-xs overflow-x-auto">
          <code className={`language-${language}`}>{displayContent}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}

