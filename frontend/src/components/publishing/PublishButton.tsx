/**
 * Publish Button Component
 * Phase 2: Request publish button with real error handling
 * Only visible when FF_PUBLISH_GATES_OWNER is enabled
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { isPublishGatesOwnerEnabled, isPublishingNotificationsEnabled } from '@/lib/feature-flags';
import { apiFetch } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { ApiErrorCode } from '@shared';
import { getPublishingMessage } from '@/lib/publishing-messages';

interface PublishButtonProps {
  type: 'world' | 'story' | 'npc';
  id: string;
  worldId?: string;
  worldName?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function PublishButton({
  type,
  id,
  worldId,
  worldName,
  disabled: externalDisabled,
  disabledReason,
}: PublishButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Don't render if feature flag is disabled
  if (!isPublishGatesOwnerEnabled()) {
    return null;
  }

  const handleRequestPublish = async () => {
    try {
      setLoading(true);
      const response = await apiFetch<{
        id: string;
        type: string;
        review_state: string;
        visibility: string;
        message: string;
      }>(`/api/publish/${type}/${id}/request`, {
        method: 'POST',
      });

      if (response.ok && response.data) {
        // Phase 5: Use centralized messaging when flag is enabled
        const message = isPublishingNotificationsEnabled()
          ? getPublishingMessage('PUBLISH_REQUEST_SUBMITTED')
          : response.data.message || 'Publish request submitted';
        toast.success(message);
      } else {
        // Handle specific error codes
        const errorCode = response.error?.code;
        const errorMessage = response.error?.message || 'Failed to submit publish request';
        const errorDetails = response.error?.details as Record<string, unknown> | undefined;

        // Phase 5: Use centralized messaging when flag is enabled
        if (isPublishingNotificationsEnabled()) {
          if (errorCode === ApiErrorCode.WORLD_NOT_PUBLIC) {
            const message = getPublishingMessage(ApiErrorCode.WORLD_NOT_PUBLIC);
            toast.info(message, {
              description: worldName
                ? `To publish this ${type}, first publish its world "${worldName}".`
                : `To publish this ${type}, first publish its world.`,
              action: worldId
                ? {
                    label: 'Go to World',
                    onClick: () => navigate(`/admin/worlds/${worldId}`),
                  }
                : undefined,
            });
          } else if (errorCode === ApiErrorCode.QUOTA_EXCEEDED) {
            const message = getPublishingMessage(ApiErrorCode.QUOTA_EXCEEDED);
            const quotaType = errorDetails?.quota_type as string;
            const current = errorDetails?.current as number;
            const max = errorDetails?.max as number;

            let description = message;
            if (quotaType === 'content_count') {
              description = `You currently have ${current} ${type}${current !== 1 ? 's' : ''} and the limit is ${max}.`;
            } else if (quotaType === 'daily_requests') {
              description = `You've submitted ${current} publish requests today. The daily limit is ${max}.`;
            }

            toast.warning(message, {
              description,
              action: {
                label: 'View Docs',
                onClick: () => window.open('/docs/publishing/README.md#quotas', '_blank'),
              },
            });
          } else {
            toast.error(getPublishingMessage(errorCode || 'DEFAULT_ERROR'));
          }
        } else {
          // Legacy behavior when flag is off
          if (errorCode === ApiErrorCode.WORLD_NOT_PUBLIC) {
            const message = worldName
              ? `Publishing requires world "${worldName}" to be public.`
              : 'Publishing requires the world to be public.';
            
            toast.info(message, {
              description: worldName
                ? `To publish this ${type}, first publish its world "${worldName}".`
                : `To publish this ${type}, first publish its world.`,
              action: worldId
                ? {
                    label: 'Go to World',
                    onClick: () => navigate(`/admin/worlds/${worldId}`),
                  }
                : undefined,
            });
          } else if (errorCode === ApiErrorCode.QUOTA_EXCEEDED) {
            const quotaType = errorDetails?.quota_type as string;
            const current = errorDetails?.current as number;
            const max = errorDetails?.max as number;

            let description = errorMessage;
            if (quotaType === 'content_count') {
              description = `You currently have ${current} ${type}${current !== 1 ? 's' : ''} and the limit is ${max}.`;
            } else if (quotaType === 'daily_requests') {
              description = `You've submitted ${current} publish requests today. The daily limit is ${max}.`;
            }

            toast.warning('Quota exceeded', {
              description,
              action: {
                label: 'View Docs',
                onClick: () => window.open('/docs/publishing/README.md#quotas', '_blank'),
              },
            });
          } else {
            toast.error(errorMessage);
          }
        }
      }
    } catch (error) {
      console.error('[publishing] Request publish error:', error);
      toast.error('Failed to submit publish request');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = externalDisabled || loading;

  return (
    <Button
      onClick={handleRequestPublish}
      disabled={isDisabled}
      variant="outline"
      className="gap-2"
    >
      <Send className="h-4 w-4" />
      Request Publish
      {disabledReason && (
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

