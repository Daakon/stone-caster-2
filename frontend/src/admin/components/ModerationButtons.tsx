/**
 * Moderation Buttons Component
 * Phase 3: Stubbed moderation actions (fully wired in Phase 5)
 */

import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { useAppRoles } from '@/admin/routeGuard';

interface ModerationButtonsProps {
  entryPointId: string;
  entryPointTitle: string;
  onModerationAction?: (action: 'approve' | 'reject' | 'request_changes') => void;
}

export function ModerationButtons({ 
  entryPointId, 
  entryPointTitle, 
  onModerationAction 
}: ModerationButtonsProps) {
  const { isModerator, isAdmin } = useAppRoles();

  // Only show for moderators and admins
  if (!isModerator && !isAdmin) {
    return null;
  }

  const handleApprove = () => {
    // TODO: Implement in Phase 5
    console.log('Approve entry point:', entryPointId);
    onModerationAction?.('approve');
  };

  const handleReject = () => {
    // TODO: Implement in Phase 5
    console.log('Reject entry point:', entryPointId);
    onModerationAction?.('reject');
  };

  const handleRequestChanges = () => {
    // TODO: Implement in Phase 5
    console.log('Request changes for entry point:', entryPointId);
    onModerationAction?.('request_changes');
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleApprove}
        disabled
        className="text-green-600 hover:text-green-700"
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        Approve
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReject}
        disabled
        className="text-red-600 hover:text-red-700"
      >
        <XCircle className="h-4 w-4 mr-1" />
        Reject
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRequestChanges}
        disabled
        className="text-yellow-600 hover:text-yellow-700"
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        Request Changes
      </Button>
      
      <div className="text-xs text-muted-foreground ml-2">
        (Phase 5)
      </div>
    </div>
  );
}
