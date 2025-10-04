import { AlertTriangle, RefreshCw, ArrowRight, X } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { ApiErrorCode } from 'shared';
import { getFriendlyErrorMessage, isResumeError, isAuthError, isRetryableError } from '../../lib/error-messages';

interface ErrorBannerProps {
  error: {
    code: ApiErrorCode;
    message?: string;
    existingGameId?: string;
  };
  onRetry?: () => void;
  onResume?: () => void;
  onSignIn?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ 
  error, 
  onRetry, 
  onResume, 
  onSignIn, 
  onDismiss,
  className = ""
}: ErrorBannerProps) {
  const friendlyMessage = getFriendlyErrorMessage(error.code, error.message);
  const showResume = isResumeError(error.code) && onResume;
  const showSignIn = isAuthError(error.code) && onSignIn;
  const showRetry = isRetryableError(error.code) && onRetry;

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
            </div>
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
