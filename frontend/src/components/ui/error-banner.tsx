import { AlertTriangle, RefreshCw, ArrowRight, X, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { ApiErrorCode } from 'shared';
import { getFriendlyErrorMessage, isResumeError, isAuthError, isRetryableError } from '../../lib/error-messages';
import { useState } from 'react';

interface ErrorBannerProps {
  error: {
    code: ApiErrorCode;
    message?: string;
    existingGameId?: string;
    traceId?: string;
  };
  onRetry?: () => void;
  onResume?: () => void;
  onSignIn?: () => void;
  onDismiss?: () => void;
  onGoToWallet?: () => void;
  onGoToHelp?: () => void;
  className?: string;
}

export function ErrorBanner({ 
  error, 
  onRetry, 
  onResume, 
  onSignIn, 
  onDismiss,
  onGoToWallet,
  onGoToHelp,
  className = ""
}: ErrorBannerProps) {
  const [copied, setCopied] = useState(false);
  const friendlyMessage = getFriendlyErrorMessage(error.code, error.message);
  const showResume = isResumeError(error.code) && onResume;
  const showSignIn = isAuthError(error.code) && onSignIn;
  const showRetry = isRetryableError(error.code) && onRetry;
  const showWallet = error.code === ApiErrorCode.INSUFFICIENT_STONES && onGoToWallet;
  const showHelp = onGoToHelp;

  const handleCopyTraceId = async () => {
    if (error.traceId) {
      try {
        await navigator.clipboard.writeText(error.traceId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy trace ID:', err);
      }
    }
  };

  return (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-800 font-medium">
              {friendlyMessage}
            </p>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              {showResume && (
                <Button
                  size="sm"
                  onClick={onResume}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Resume Game
                </Button>
              )}
              
              {showSignIn && (
                <Button
                  size="sm"
                  onClick={onSignIn}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sign In
                </Button>
              )}
              
              {showWallet && (
                <Button
                  size="sm"
                  onClick={onGoToWallet}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Go to Wallet
                </Button>
              )}
              
              {showRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Try Again
                </Button>
              )}

              {showHelp && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGoToHelp}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Get Help
                </Button>
              )}
            </div>

            {/* Trace ID for QA/Support */}
            {error.traceId && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <span className="font-medium">Trace ID:</span>
                  <code className="bg-red-100 px-2 py-1 rounded font-mono text-xs">
                    {error.traceId}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyTraceId}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                    title="Copy trace ID for support"
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-red-500 mt-1">
                  Include this ID when reporting issues to support
                </p>
              </div>
            )}
          </div>
          
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="text-red-600 hover:text-red-700 hover:bg-red-100 p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
