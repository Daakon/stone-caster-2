import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';

interface EntityLinkProps {
    id: string;
    name: string;
    type?: string;
    className?: string;
}

export function EntityLink({ id, name, type, className }: EntityLinkProps) {
    const { setSelectedEntity } = useActiveGameStore();

    return (
        <span
            className={cn(
                "font-bold cursor-pointer hover:underline hover:text-primary transition-colors",
                type === 'npc' && "text-amber-500", // Gold for NPCs as per spec
                type === 'enemy' && "text-red-500",
                className
            )}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedEntity(id);
            }}
            title="Inspect"
        >
            {name}
        </span>
    );
}
