import { GameModal } from '@/components/ui/GameModal';
import { Badge } from '@/components/ui/badge';

interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entity: any;
    isOpen: boolean;
    onClose: () => void;
}

export const EntityInspectorModal = ({ entity, isOpen, onClose }: Props) => {
    if (!entity) return null;
    const props = entity.properties || {};
    // eslint-disable-next-line @typescript-eslint/no-used-vars
    const _raw = entity.raw_data || {};

    // Determine avatar character
    const avatarChar = (props.name?.[0] || props.display_name?.[0] || '?').toUpperCase();

    return (
        <GameModal isOpen={isOpen} onClose={onClose} title={props.display_name || props.name || "Unknown Entity"}>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-serif font-bold text-primary">
                        {/* Avatar Placeholder */}
                        {avatarChar}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-foreground">{props.display_name || props.name}</div>
                        <div className="text-xs text-muted-foreground">{props.race || 'Entity'} &bull; {props.archetype || 'Unknown'}</div>
                        <p className="mt-2 text-sm italic text-muted-foreground/90 border-l-2 border-border pl-2">
                            "{props.description || 'No description available.'}"
                        </p>
                    </div>
                </div>

                {/* Stats Grid (Mock Example) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/30 rounded-lg border flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</div>
                        <div className="text-sm font-medium">{entity.status || 'Active'}</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Type</div>
                        <div className="text-sm font-medium">{entity.type || 'Unknown'}</div>
                    </div>
                </div>

                {/* Tags */}
                {props.tags && props.tags.length > 0 && (
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2 tracking-wider">Tags</div>
                        <div className="flex flex-wrap gap-2">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {props.tags.map((tag: any) => (
                                <Badge key={String(tag)} variant="secondary" className="text-xs px-2 py-0.5">{String(tag)}</Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </GameModal>
    );
};
