import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  AlertCircle, 
  RefreshCw, 
  Wallet, 
  Clock, 
  Wifi, 
  HelpCircle
} from 'lucide-react';
import { ApiErrorCode } from 'shared';

interface TurnErrorHandlerProps {
  error: string;
  errorCode?: string;
  onRetry?: () => void;
  onGoToWallet?: () => void;
  onGoToHelp?: () => void;
  isRetrying?: boolean;
}

export function TurnErrorHandler({
  error,
  errorCode,
  onRetry,
  onGoToWallet,
  onGoToHelp,
  isRetrying = false
}: TurnErrorHandlerProps) {
  const getErrorDetails = (code?: string) => {
    switch (code) {
      case ApiErrorCode.INSUFFICIENT_STONES:
        return {
          icon: Wallet,
          title: 'Insufficient Casting Stones',
          description: 'You don\'t have enough stones to perform this action.',
          action: 'Add stones to your wallet',
          actionButton: onGoToWallet ? 'Go to Wallet' : undefined,
          actionIcon: Wallet
        };
      
      case ApiErrorCode.UPSTREAM_TIMEOUT:
        return {
          icon: Clock,
          title: 'Action Timeout',
          description: 'The action took too long to process. This might be due to high server load.',
          action: 'Try again in a moment',
          actionButton: onRetry ? 'Retry' : undefined,
          actionIcon: RefreshCw
        };
      
      case ApiErrorCode.VALIDATION_FAILED:
        return {
          icon: AlertCircle,
          title: 'Invalid Action',
          description: 'The action you tried to perform is not valid in this context.',
          action: 'Try a different action',
          actionButton: onRetry ? 'Try Again' : undefined,
          actionIcon: RefreshCw
        };
      
      case 'network_error':
        return {
          icon: Wifi,
          title: 'Connection Error',
          description: 'Unable to connect to the server. Please check your internet connection.',
          action: 'Retry when connection is restored',
          actionButton: onRetry ? 'Retry' : undefined,
          actionIcon: RefreshCw
        };
      
      case ApiErrorCode.IDEMPOTENCY_REQUIRED:
        return {
          icon: AlertCircle,
          title: 'Duplicate Action',
          description: 'This action was already submitted. Please wait for it to complete.',
          action: 'Wait for the current action to finish',
          actionButton: undefined
        };
      
      default:
        return {
          icon: AlertCircle,
          title: 'Action Failed',
          description: error || 'An unexpected error occurred while processing your action.',
          action: 'Please try again',
          actionButton: onRetry ? 'Retry' : undefined,
          actionIcon: RefreshCw
        };
    }
  };

  const errorDetails = getErrorDetails(errorCode);
  const Icon = errorDetails.icon;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Icon className="h-5 w-5" />
          {errorDetails.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorDetails.description}
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          {errorDetails.action}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {errorDetails.actionButton && onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-2"
            >
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                errorDetails.actionIcon && <errorDetails.actionIcon className="h-4 w-4" />
              )}
              {errorDetails.actionButton}
            </Button>
          )}

          {onGoToWallet && errorCode === ApiErrorCode.INSUFFICIENT_STONES && (
            <Button
              onClick={onGoToWallet}
              className="flex items-center gap-2"
            >
              <Wallet className="h-4 w-4" />
              Go to Wallet
            </Button>
          )}

          {onGoToHelp && (
            <Button
              variant="ghost"
              onClick={onGoToHelp}
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Get Help
            </Button>
          )}
        </div>

        {/* Additional help for specific errors */}
        {errorCode === ApiErrorCode.INSUFFICIENT_STONES && (
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <strong>Need more stones?</strong> You can purchase additional casting stones 
            or earn them through gameplay. Each action costs a small amount of stones 
            to maintain game balance.
          </div>
        )}

        {errorCode === ApiErrorCode.UPSTREAM_TIMEOUT && (
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <strong>Server busy?</strong> During peak times, actions may take longer to process. 
            Your stones are safe and the action will complete once the server is available.
          </div>
        )}

        {errorCode === 'validation_failed' && (
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <strong>Action not allowed?</strong> Some actions may not be valid in your current 
            situation. Try describing your action differently or choose a different approach.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
