/**
 * Early Access Banner Component
 * Shows banner on home page when user needs early access
 */

import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Mail, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/react-query';
import { publicAccessRequestsService } from '@/services/accessRequests';

export function EarlyAccessBanner() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Use React Query to get access request status (shared with LandingPage)
  const { data: accessStatus } = useQuery({
    queryKey: ['access-request-status'],
    queryFn: () => publicAccessRequestsService.getStatus(),
    enabled: !!user,
    refetchInterval: false, // Only fetch once, no polling
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // accessStatus is AccessRequestStatusResponse: { ok: true, data: AccessRequest | null }
  const request = accessStatus?.ok ? accessStatus.data : null;
  const status = request?.status;
  const hasRequest = !!request;

  // Don't show banner if no user or query hasn't loaded yet
  if (!user) {
    return null;
  }

  // Wait for query to finish loading
  if (!accessStatus) {
    return null; // Or show a loading state
  }

  // Show approved message
  if (status === 'approved') {
    return (
      <Alert className="mb-6 border-green-500/50 bg-green-50 dark:bg-yellow-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="flex items-center gap-2">
          Early Access Granted
          <Badge variant="default" className="ml-2 bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        </AlertTitle>
        <AlertDescription className="mt-2">
          Your Early Access request has been approved! You can now start playing and exploring interactive stories.
        </AlertDescription>
      </Alert>
    );
  }

  // Show banner if user has pending request or needs to request
  if (!hasRequest || status === 'pending' || status === 'denied') {
    return (
      <Alert className="mb-6 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="flex items-center gap-2">
          Early Access Required
          {status === 'pending' && (
            <Badge variant="secondary" className="ml-2">
              <Clock className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          )}
          {status === 'denied' && (
            <Badge variant="destructive" className="ml-2">
              <XCircle className="mr-1 h-3 w-3" />
              Denied
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2">
          {status === 'pending' ? (
            <>
              Your request for Early Access is pending approval. We'll notify you by email when
              approved.
            </>
          ) : status === 'denied' ? (
            <>
              Your request for Early Access was denied. Please contact support if you believe this
              is an error.
            </>
          ) : (
            <>
              StoneCaster is currently in Early Access. Request access to start playing and
              exploring interactive stories.
            </>
          )}
          {!hasRequest && (
            <Button
              variant="default"
              size="sm"
              className="ml-4"
              onClick={() => navigate('/request-access')}
            >
              <Mail className="mr-2 h-4 w-4" />
              Request Access
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

