import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

interface RulesetInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    ruleset: RulesetDefinition | null;
}

export function RulesetInfoModal({ isOpen, onClose, ruleset }: RulesetInfoModalProps) {
    if (!ruleset) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-stone-950 border-stone-800">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl font-bold font-display text-stone-100">
                            {ruleset.name}
                        </DialogTitle>
                        {ruleset.ui_category === 'foundation' && (
                            <Badge variant="outline" className="border-cyan-800 text-cyan-400 bg-cyan-950/30">
                                Foundation
                            </Badge>
                        )}
                        {ruleset.ui_category === 'expansion' && (
                            <Badge variant="outline" className="border-purple-800 text-purple-400 bg-purple-950/30">
                                Expansion
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6 pt-2">
                        {/* Description */}
                        <div className="space-y-2">
                            <p className="text-stone-300 leading-relaxed">
                                {ruleset.description_long || ruleset.description_short || "No description available."}
                            </p>
                        </div>

                        {/* Dependencies */}
                        {ruleset.dependencies && ruleset.dependencies.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Requires</h4>
                                <div className="flex flex-wrap gap-2">
                                    {ruleset.dependencies.map((dep) => (
                                        <Badge key={dep} variant="secondary" className="bg-stone-900 border-stone-800 text-stone-400">
                                            {dep}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tags */}
                        {ruleset.provides_tags && ruleset.provides_tags.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Mechanics</h4>
                                <div className="flex flex-wrap gap-2">
                                    {ruleset.provides_tags.map((tag) => (
                                        <Badge key={tag} className="bg-stone-800 text-stone-300 hover:bg-stone-700">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ID/Technical Info */}
                        <div className="pt-4 border-t border-stone-800">
                            <h4 className="text-xs font-mono text-stone-600 mb-1">RULESET ID</h4>
                            <code className="text-xs font-mono text-stone-500 bg-stone-900/50 px-2 py-1 rounded">
                                {ruleset.id}
                            </code>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
