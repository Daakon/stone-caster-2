import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: Error;
  onRetry?: () => void;
}

export function ErrorModal({ isOpen, onClose, error, onRetry }: ErrorModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyError = async () => {
    const errorText = `${error.message}\n\nStack trace:\n${error.stack}`;
    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Error Occurred
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-muted-foreground">
            We encountered an unexpected error. This has been logged and we'll look into it.
          </p>

          <div className="bg-muted p-3 rounded text-sm">
            <div className="font-medium mb-1">Error Message:</div>
            <div className="text-destructive">{error.message}</div>
          </div>

          {process.env.NODE_ENV === 'development' && error.stack && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium mb-2">
                Stack Trace (Development)
              </summary>
              <pre className="whitespace-pre-wrap bg-muted p-2 rounded text-destructive overflow-auto max-h-32">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button variant="outline" onClick={handleCopyError} className="flex-1">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Error
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


