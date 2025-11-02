/**
 * Preview Prompt Panel
 * Assembled prompt view with copy/download
 */

import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface PreviewPromptPanelProps {
  prompt: string;
  promptHash?: string;
}

export function PreviewPromptPanel({ prompt, promptHash }: PreviewPromptPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy prompt');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${promptHash?.substring(0, 8) || 'preview'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Prompt downloaded');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Assembled Prompt</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy prompt"
          >
            <Copy className="h-4 w-4 mr-2" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            aria-label="Download prompt"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
      <div className="border rounded-md p-4 max-h-[600px] overflow-y-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
          {prompt}
        </pre>
      </div>
      {promptHash && (
        <div className="text-xs text-muted-foreground font-mono">
          Hash: {promptHash}
        </div>
      )}
    </div>
  );
}

