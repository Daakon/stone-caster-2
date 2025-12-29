
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, User, Zap } from 'lucide-react';
import type { Character } from '@/types/domain';

interface CharacterSelectorProps {
    characters: Character[];
    premades: any[];
    selectedTab: 'MY_CHARACTERS' | 'PREMADES';
    onSelectCharacter: (char: Character) => void;
    onSelectPremade: (premade: any) => void;
    onCreateNew: () => void;
}

export const CharacterSelector = ({
    characters,
    premades,
    selectedTab,
    onSelectCharacter,
    onSelectPremade,
    onCreateNew
}: CharacterSelectorProps) => {

    if (selectedTab === 'MY_CHARACTERS') {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card
                        className="flex flex-col items-center justify-center p-6 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[250px]"
                        onClick={onCreateNew}
                    >
                        <PlusCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold">Create New</h3>
                        <p className="text-sm text-muted-foreground text-center mt-2">
                            Build a custom character from scratch
                        </p>
                    </Card>

                    {characters.map((char) => (
                        <Card
                            key={char.id}
                            className="cursor-pointer hover:border-primary transition-colors flex flex-col"
                            onClick={() => onSelectCharacter(char)}
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    {char.name}
                                </CardTitle>
                                <CardDescription>{char.description || 'No description'}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                {/* Portrait placeholder or image */}
                                {char.portrait_url ? (
                                    <div className="w-full aspect-square rounded-md overflow-hidden bg-muted mb-4">
                                        <img src={char.portrait_url} alt={char.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-4">
                                        <User className="w-16 h-16 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary">Level 1</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                {characters.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">You don't have any characters in this world yet.</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premades.map((premade) => (
                <Card
                    key={premade.id}
                    className="cursor-pointer hover:border-primary transition-colors relative overflow-hidden"
                    onClick={() => onSelectPremade(premade)}
                >
                    <div className="absolute top-2 right-2 z-10">
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                            <Zap className="w-3 h-3 mr-1" /> Quick Start
                        </Badge>
                    </div>
                    <CardHeader>
                        <CardTitle>{premade.name}</CardTitle>
                        <CardDescription>{premade.tagline}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full aspect-video bg-muted rounded-md mb-4 flex items-center justify-center">
                            {/* Placeholder for premade art */}
                            <span className="text-xs text-muted-foreground">Portrait: {premade.portrait_key}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                            {premade.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
