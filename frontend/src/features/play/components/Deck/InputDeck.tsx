import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils'; // Assuming utils exists

interface InputDeckProps {
    onCommit: (text: string) => void;
}

export function InputDeck({ onCommit }: InputDeckProps) {
    const { draftText, setDraft, inputMode, lockInput } = useActiveGameStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isLocked = inputMode === 'locked';

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommit();
        }
    };

    const handleCommit = () => {
        if (!draftText.trim() || isLocked) return;

        lockInput();
        onCommit(draftText);
    };

    useEffect(() => {
        if (inputMode === 'idle') {
            textareaRef.current?.focus();
        }
    }, [inputMode]);

    return (
        <div className="w-full max-w-2xl mx-auto p-4 flex gap-2 items-end">
            <div className="relative flex-1">
                <Textarea
                    ref={textareaRef}
                    value={draftText}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isLocked ? "Consulting the Oracle..." : "What do you want to do?"}
                    disabled={isLocked}
                    className={cn(
                        "min-h-[60px] max-h-[120px] resize-none pr-12 py-3 bg-muted/30 border-primary/20 focus:border-primary",
                        isLocked && "opacity-50 cursor-wait"
                    )}
                />
                <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
                    {/* Optional character count or indicators */}
                </div>
            </div>

            <Button
                onClick={handleCommit}
                disabled={!draftText.trim() || isLocked}
                className={cn(
                    "h-[60px] w-[60px] rounded-lg transition-all",
                    isLocked ? "bg-muted" : "bg-primary hover:bg-primary/90"
                )}
            >
                {isLocked ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                    <Send className="h-6 w-6" />
                )}
            </Button>
        </div>
    );
}
