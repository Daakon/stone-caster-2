/**
 * Early Access Error Handler
 * Handles EARLY_ACCESS_REQUIRED errors globally and redirects to home
 */

import { toast } from 'sonner';
import { publicAccessRequestsService } from '@/services/accessRequests';
import type { AccessRequestStatus } from '@shared/types/accessRequests';

let isHandlingEarlyAccess = false;

/**
 * Check if user has a pending request
 */
export async function checkAccessRequestStatus(): Promise<{
  hasRequest: boolean;
  status: AccessRequestStatus | null;
}> {
  try {
    const result = await publicAccessRequestsService.getStatus();
    if (result.ok && result.data?.request) {
      return {
        hasRequest: true,
        status: result.data.request.status,
      };
    }
    return { hasRequest: false, status: null };
  } catch (error) {
    console.error('[earlyAccessHandler] Error checking request status:', error);
    return { hasRequest: false, status: null };
  }
}

/**
 * Handle EARLY_ACCESS_REQUIRED error
 * Redirects to home and shows appropriate message
 */
export async function handleEarlyAccessRequired(
  navigate: (path: string) => void,
  currentPath?: string
): Promise<void> {
  // Prevent multiple simultaneous redirects
  if (isHandlingEarlyAccess) {
    return;
  }
  isHandlingEarlyAccess = true;

  try {
    // Check if user has a pending request
    const { hasRequest, status } = await checkAccessRequestStatus();

    // Redirect to home (only if not already there)
    if (currentPath !== '/') {
      navigate('/');
    }

    // Show appropriate message
    if (hasRequest && status === 'pending') {
      toast.info('Early Access Required', {
        description: 'Your request is pending approval. We\'ll notify you when approved.',
        duration: 5000,
      });
    } else if (hasRequest && status === 'denied') {
      toast.error('Early Access Required', {
        description: 'Your request was denied. Please contact support if you believe this is an error.',
        duration: 5000,
      });
    } else {
      toast.warning('Early Access Required', {
        description: 'StoneCaster is currently in Early Access. Request access to continue.',
        duration: 5000,
        action: {
          label: 'Request Access',
          onClick: () => navigate('/request-access'),
        },
      });
    }
  } catch (error) {
    console.error('[earlyAccessHandler] Error handling early access:', error);
    toast.error('An error occurred', {
      description: 'Failed to check access status. Please try again.',
    });
  } finally {
    // Reset flag after a delay to allow for navigation
    setTimeout(() => {
      isHandlingEarlyAccess = false;
    }, 1000);
  }
}

