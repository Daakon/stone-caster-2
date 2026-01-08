import { cn } from '@/lib/utils';
import { ShieldAlert, Dice5 } from 'lucide-react';

interface SystemLineProps {
    text: string;
    type?: 'check' | 'combat' | 'info';
    className?: string;
}

export function SystemLine({ text, type = 'info', className }: SystemLineProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 py-1 px-2 my-2 text-xs font-mono text-muted-foreground bg-secondary/10 border-l-2 border-primary/20 rounded-r",
                className
            )}
        >
            {type === 'check' && <Dice5 className="w-3 h-3 text-primary" />}
            {type === 'combat' && <ShieldAlert className="w-3 h-3 text-destructive" />}

            <span>{text}</span>
        </div>
    );
}
