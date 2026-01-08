import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EntityCard } from './EntityCard';

interface InspectorPanelProps {
    state?: any;
}

export function InspectorPanel({ state }: InspectorPanelProps) {
    const { selectedEntityId, setSelectedEntity } = useActiveGameStore();

    const isInspecting = !!selectedEntityId;
    const handleClose = () => setSelectedEntity(null);

    // If not inspecting, render nothing (Sidebar handles Vitals)
    if (!isInspecting) return null;

    return (
        <Sheet open={isInspecting} onOpenChange={(open) => !open && handleClose()}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Inspector</SheetTitle>
                    <SheetDescription>Viewing entity details</SheetDescription>
                </SheetHeader>

                <div className="mt-6">
                    <EntityCard entityId={selectedEntityId!} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
