import { Badge } from '@/components/ui/badge';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { Sparkles } from 'lucide-react';

interface SuggestionRailProps {
    onCommit?: (text: string) => void;
}

export function SuggestionRail({ onCommit }: SuggestionRailProps) {
    const { suggested_actions, setDraft, inputMode } = useActiveGameStore();

    // Default suggestions if empty (Fallback)
    const displaySuggestions = (suggested_actions && suggested_actions.length > 0)
        ? suggested_actions
        : ["Look around", "Check inventory", "Wait", "Status"];

    // Chips are inert while a turn is processing, not just when hard-locked
    const isBusy = inputMode === 'locked' || inputMode === 'thinking';

    const handleSuggestionClick = (text: string) => {
        if (isBusy) return;
        setDraft(text);
    };

    const handleDoubleClick = (text: string) => {
        if (isBusy) return;
        setDraft(text);
        onCommit?.(text);
    };

    // Note: Always render, even if empty (defaults). 
    // Unless specifically hidden? Spec says "Fallback: If empty, show default verbs".

    return (
        <div className="w-full overflow-x-auto py-2 px-4 border-b bg-background/50 backdrop-blur-sm">
            <div className="flex gap-2 max-w-2xl mx-auto">
                <Sparkles className="w-4 h-4 text-primary my-auto shrink-0 animate-pulse" />
                {displaySuggestions.map((text, i) => (
                    <Badge
                        key={i}
                        data-testid="suggestion-chip"
                        variant="outline"
                        className={
                            isBusy
                                ? "opacity-50 cursor-wait whitespace-nowrap py-1 px-3 select-none"
                                : "cursor-pointer hover:bg-secondary transition-colors whitespace-nowrap py-1 px-3 select-none"
                        }
                        onClick={() => handleSuggestionClick(text)}
                        onDoubleClick={() => handleDoubleClick(text)}
                    >
                        {text}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
