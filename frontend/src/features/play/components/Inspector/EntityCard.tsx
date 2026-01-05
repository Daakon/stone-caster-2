import { Badge } from "@/components/ui/badge";
import { User, Shield, Sword } from "lucide-react";

interface EntityCardProps {
    entityId: string;
    // In a real app, we'd fetch details by ID. 
    // For MVP, we might mock or look up from game state if available.
    // Assuming passed props or internal lookup.
    // Let's assume we receive minimal data for now until we have full Entity Store.
    name?: string;
    description?: string;
    metrics?: {
        hp?: number;
        maxHp?: number;
    }
}

export function EntityCard({ entityId, name = "Unknown Entity", description = "No details available.", metrics }: EntityCardProps) {
    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border-2 border-primary">
                    <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold tracking-tight">{name}</h2>
                    <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">NPC</Badge>
                        <Badge variant="outline" className="text-xs">Neutral</Badge>
                    </div>
                </div>
            </div>

            <p className="text-sm text-muted-foreground italic leading-relaxed">
                {description}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-secondary/30 p-2 rounded flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Defense</span>
                        <span className="text-sm font-mono">12 AC</span>
                    </div>
                </div>
                <div className="bg-secondary/30 p-2 rounded flex items-center gap-2">
                    <Sword className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Attack</span>
                        <span className="text-sm font-mono">+4 Hit</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
