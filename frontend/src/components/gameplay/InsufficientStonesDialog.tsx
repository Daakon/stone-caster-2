import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, Gem, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InsufficientStonesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  requiredCost: number;
  onGoToWallet?: () => void;
}

export function InsufficientStonesDialog({
  open,
  onOpenChange,
  currentBalance,
  requiredCost,
  onGoToWallet,
}: InsufficientStonesDialogProps) {
  const navigate = useNavigate();
  const shortfall = requiredCost - currentBalance;

  const handleGoToWallet = () => {
    onOpenChange(false);
    if (onGoToWallet) {
      onGoToWallet();
    } else {
      navigate('/wallet');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-full">
              <Gem className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Insufficient Casting Stones</DialogTitle>
              <DialogDescription className="mt-1">
                You need more stones to perform this action
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your balance:</span>
              <span className="font-semibold">{currentBalance} stones</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Action cost:</span>
              <span className="font-semibold">{requiredCost} stones</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">You need:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{shortfall} more stones</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Purchase additional casting stones to continue your adventure. Each action costs stones to maintain game balance.
            </p>
            <p>
              You can also earn stones through gameplay and daily rewards.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGoToWallet}
            className="flex items-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Go to Wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

