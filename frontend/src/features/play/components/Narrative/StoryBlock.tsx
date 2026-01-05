import { cn } from '@/lib/utils';

interface StoryBlockProps {
    text: string;
    role: 'narrator' | 'player';
    className?: string;
    timestamp?: Date;
}

export function StoryBlock({ text, role, className, timestamp }: StoryBlockProps) {
    const isPlayer = role === 'player';

    return (
        <div
            className={cn(
                "py-4 prose dark:prose-invert max-w-none animate-in fade-in duration-500",
                isPlayer && "text-right italic text-muted-foreground",
                className
            )}
        >
            {/* Optional: Render timestamp if needed, or keeping it clean */}
            <p className={cn(
                "leading-relaxed text-lg",
                !isPlayer && "font-serif text-foreground/90"
            )}>
                {text}
            </p>
        </div>
    );
}
