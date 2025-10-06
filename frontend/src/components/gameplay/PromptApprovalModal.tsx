import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

interface PromptApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (approved: boolean) => void;
  prompt: string;
  promptId: string;
  metadata: {
    worldId: string;
    characterId?: string;
    turnIndex: number;
    tokenCount: number;
  };
  isLoading?: boolean;
}

export function PromptApprovalModal({
  isOpen,
  onClose,
  onApprove,
  prompt,
  promptId,
  metadata,
  isLoading = false,
}: PromptApprovalModalProps) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const handleApprove = () => {
    onApprove(true);
  };

  const handleReject = () => {
    onApprove(false);
  };

  const truncatedPrompt = prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            AI Prompt Approval Required
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Prompt Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">ID: {promptId}</Badge>
                <Badge variant="outline">World: {metadata.worldId}</Badge>
                <Badge variant="outline">Turn: {metadata.turnIndex}</Badge>
                <Badge variant="outline">Tokens: ~{metadata.tokenCount}</Badge>
                {metadata.characterId && (
                  <Badge variant="outline">Character: {metadata.characterId}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Prompt Content */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Generated Prompt</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  className="h-8"
                >
                  {showFullPrompt ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Show Full
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={showFullPrompt ? prompt : truncatedPrompt}
                readOnly
                className="min-h-[200px] font-mono text-sm resize-none"
                placeholder="No prompt content available..."
              />
              {!showFullPrompt && prompt.length > 500 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing first 500 characters. Click "Show Full" to see the complete prompt.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Review Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Please review the generated AI prompt above. This prompt will be sent to the AI service
                to generate the initial game content.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check that the prompt includes appropriate context for your character and world</li>
                <li>Verify that the prompt follows the expected format and structure</li>
                <li>Ensure the prompt contains the necessary instructions for the AI</li>
                <li>Look for any obvious errors or missing information</li>
              </ul>
              <p className="font-medium text-foreground">
                Only approve if you're satisfied with the prompt format and content.
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isLoading}
            className="mr-2"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isLoading}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
