import { Dices, Activity, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SystemMessageProps {
    type: 'success' | 'failure' | 'info';
    label: string;
    details?: string;
}

export function SystemMessage({ type, label, details }: SystemMessageProps) {
    const icons = {
        success: CheckCircle2,
        failure: XCircle,
        info: Activity // Default
    };

    // If label contains "Roll", use Dice icon
    const Icon = label.toLowerCase().includes('roll') || label.toLowerCase().includes('check')
        ? Dices
        : (icons[type] || Activity);

    const variants = {
        success: "border-emerald-500/50 bg-emerald-950/20 text-emerald-200",
        failure: "border-red-500/50 bg-red-950/20 text-red-200",
        info: "border-blue-500/50 bg-blue-950/20 text-blue-200"
    };

    return (
        <div className={cn(
            "flex items-center gap-2 text-xs font-mono py-1 px-3 my-2 rounded-r border-l-2 w-fit select-none backdrop-blur-sm",
            variants[type]
        )}>
            <Icon className="w-3.5 h-3.5 opacity-70" />
            <div className="flex flex-col">
                <span className="font-bold tracking-wide uppercase text-[10px] opacity-80 leading-none mb-0.5">
                    {label}
                </span>
                {details && (
                    <span className="opacity-90 leading-tight">
                        {details}
                    </span>
                )}
            </div>
        </div>
    );
}
