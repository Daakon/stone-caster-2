import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { EntityCard } from './EntityCard';
import { StatsPanel } from '@/components/game/StatsPanel';

interface InspectorPanelProps {
    // We can pass current game state mechanicals here for the "Self" view
    state?: any;
}

export function InspectorPanel({ state }: InspectorPanelProps) {
    const { selectedEntityId, setSelectedEntity } = useActiveGameStore();

    // Derived state: are we inspecting something?
    const isInspecting = !!selectedEntityId;

    // Handler for closing the drawer (Mobile/Overlay)
    const handleClose = () => setSelectedEntity(null);

    // Determines content based on selection
    const content = isInspecting ? (
        <EntityCard entityId={selectedEntityId!} />
    ) : (
        // Default View: Player Stats (Reusing StatsPanel for now)
        <div className="p-4">
            <h3 className="text-sm font-bold uppercase mb-4 text-muted-foreground">My Character</h3>
            <StatsPanel tier1Data={state?.tier1_mechanical || state?.mechanical_state} />
        </div>
    );

    return (
        <>
            {/* Desktop: Persistent Right Column (if layout allows) or just a wrapper */}
            {/* In Mobile-First Phase 2 styling, Inspector is typically hidden on mobile until invoked. 
                On widescreen, we might dock it right. 
                For now, let's implement the SlideOver behavior for the Interaction Trigger. */}

            <Sheet open={isInspecting} onOpenChange={(open) => !open && handleClose()}>
                <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{isInspecting ? 'Inspector' : 'Character Sheet'}</SheetTitle>
                        <SheetDescription>
                            {isInspecting ? 'Viewing entity details' : 'Your current status'}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6">
                        {content}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop Persistent View (Right Sidebar) */}
            <div className="hidden lg:block w-80 border-l bg-background/50 h-full overflow-y-auto">
                {content}
            </div>
        </>
    );
}
