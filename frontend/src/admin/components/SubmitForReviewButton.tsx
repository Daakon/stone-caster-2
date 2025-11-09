/**
 * Submit for Review Button Component
 * Phase 3: Handles submission of entry points for moderation review
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { entryPointsService } from '@/services/admin.entryPoints';

interface SubmitForReviewButtonProps {
  entryPointId: string;
  entryPointTitle: string;
  onSubmitted?: () => void;
}

export function SubmitForReviewButton({ 
  entryPointId, 
  entryPointTitle, 
  onSubmitted 
}: SubmitForReviewButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await entryPointsService.submitForReview(entryPointId, note || undefined);
      toast.success('Entry point submitted for review');
      setIsDialogOpen(false);
      setNote('');
      onSubmitted?.();
    } catch (error) {
      toast.error('Failed to submit for review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          Submit for Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
          <DialogDescription>
            Submit "{entryPointTitle}" for moderation review. This will change the lifecycle to "Pending Review" and create a review request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Optional Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes for the moderators (optional)"
              rows={3}
            />
          </div>

          <div className="p-3 bg-muted rounded-md">
            <h4 className="font-medium text-sm mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Entry point lifecycle changes to "Pending Review"</li>
              <li>• A review request is created for moderators</li>
              <li>• You'll be notified when the review is complete</li>
              <li>• You can make changes while it's under review</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsDialogOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit for Review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



