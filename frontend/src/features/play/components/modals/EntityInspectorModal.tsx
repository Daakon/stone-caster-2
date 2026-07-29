import { GameModal } from '@/components/ui/GameModal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Heart, Zap, Skull, Flag, Moon, HeartCrack, Activity } from 'lucide-react';
import { resolveEntityDisplay, resolveEntityDescription, resolveEntityVitals } from '../../utils/entity-utils';

interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entity: any;
    isOpen: boolean;
    onClose: () => void;
}

const CONDITION_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
    Wounded: { icon: HeartCrack, className: 'text-red-500 border-red-500/50' },
    Critical: { icon: Activity, className: 'text-red-600 border-red-600/50' },
    Surrendered: { icon: Flag, className: 'text-amber-500 border-amber-500/50' },
    Defeated: { icon: Skull, className: 'text-muted-foreground border-border' },
    Unconscious: { icon: Moon, className: 'text-blue-500 border-blue-500/50' },
};

function VitalBar({ label, icon: Icon, value, max, barClass }: {
    label: string;
    icon: React.ElementType;
    value: number;
    max: number;
    barClass: string;
}) {
    const pct = Math.min(100, Math.max(0, (value / (max || 100)) * 100));
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                </div>
                <span>{Math.round(value)} / {max}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500", barClass)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export const EntityInspectorModal = ({ entity, isOpen, onClose }: Props) => {
    if (!entity) return null;

    const { name, role } = resolveEntityDisplay(entity);
    const description = resolveEntityDescription(entity);
    const vitals = resolveEntityVitals(entity);
    const props = entity.properties || {};

    const avatarChar = (name?.[0] || '?').toUpperCase();

    // Conditions worth surfacing (defaults are noise)
    const conditions: string[] = [];
    if (vitals.combatCondition && vitals.combatCondition !== 'Healthy') conditions.push(vitals.combatCondition);
    if (vitals.physicalCondition && vitals.physicalCondition !== 'Rested') conditions.push(vitals.physicalCondition);

    // Relationships live at entity level on a 0-20 scale (5 = neutral)
    const relationships: Array<[string, number]> = Object.entries(entity.relationships || {})
        .filter(([, v]) => typeof v === 'number') as Array<[string, number]>;

    const isDown = vitals.combatCondition === 'Defeated' || vitals.combatCondition === 'Unconscious';

    return (
        <GameModal isOpen={isOpen} onClose={onClose} title={name}>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-serif font-bold text-primary flex-shrink-0",
                        isDown && "opacity-50 grayscale"
                    )}>
                        {avatarChar}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{role}</div>
                        {conditions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {conditions.map(condition => {
                                    const style = CONDITION_STYLES[condition];
                                    const Icon = style?.icon;
                                    return (
                                        <Badge key={condition} variant="outline" className={cn("text-xs gap-1", style?.className)}>
                                            {Icon && <Icon className="w-3 h-3" />}
                                            {condition}
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}
                        {description && (
                            <p className="mt-2 text-sm italic text-muted-foreground/90 border-l-2 border-border pl-2">
                                "{description}"
                            </p>
                        )}
                    </div>
                </div>

                {/* Vitals */}
                {(vitals.hp !== null || vitals.stamina !== null) && (
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                        {vitals.hp !== null && (
                            <VitalBar label="Health" icon={Heart} value={vitals.hp} max={vitals.maxHp} barClass="bg-red-500" />
                        )}
                        {vitals.stamina !== null && (
                            <VitalBar label="Stamina" icon={Zap} value={vitals.stamina} max={100} barClass="bg-yellow-500" />
                        )}
                    </div>
                )}

                {/* Relationships (0-20 scale, 5 = neutral) */}
                {relationships.length > 0 && (
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2 tracking-wider">Disposition</div>
                        <div className="space-y-2">
                            {relationships.map(([axis, value]) => (
                                <div key={axis} className="flex items-center gap-2">
                                    <span className="text-xs capitalize w-24 truncate text-muted-foreground">{axis.replace(/_/g, ' ')}</span>
                                    <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all", value >= 5 ? "bg-emerald-500" : "bg-red-500")}
                                            style={{ width: `${Math.min(100, Math.max(0, (value / 20) * 100))}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{value}/20</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Status / Type row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/30 rounded-lg border flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</div>
                        <div className="text-sm font-medium capitalize">{vitals.combatCondition || entity.status || 'Active'}</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border flex flex-col items-center justify-center">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Type</div>
                        <div className="text-sm font-medium capitalize">{entity.type || 'Character'}</div>
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
