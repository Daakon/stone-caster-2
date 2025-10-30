import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import type { Character } from '@/types/domain';

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  onSelect: (character: Character) => void;
  className?: string;
}

export default function CharacterCard({ character, isSelected, onSelect, className }: CharacterCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected 
          ? 'ring-2 ring-primary bg-primary/5' 
          : 'hover:shadow-md'
      } ${className}`}
      onClick={() => onSelect(character)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(character);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          {/* Character Portrait */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {character.portrait_url ? (
                <img
                  src={character.portrait_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold text-lg">
                  {character.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Selection Indicator */}
            {isSelected && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Character Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{character.name}</h3>
            <p className="text-xs text-muted-foreground">
              Created {new Date(character.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
