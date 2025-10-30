import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, User } from 'lucide-react';
import type { Story, Character } from '@/types/domain';

interface StoryStartSummaryProps {
  story: Story;
  character: Character;
  onBegin: () => void;
  isLoading?: boolean;
}

export default function StoryStartSummary({ story, character, onBegin, isLoading = false }: StoryStartSummaryProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Ready to Begin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Story Summary */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {story.hero_url && (
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={story.hero_url}
                  alt={story.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">{story.title}</h3>
              {story.short_desc && (
                <p className="text-sm text-muted-foreground mt-1">
                  {story.short_desc}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {story.kind}
                </Badge>
                {story.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Character Summary */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Playing as:</h4>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {character.portrait_url ? (
                <img
                  src={character.portrait_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold">
                  {character.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{character.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Created {new Date(character.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Begin Button */}
        <Button
          onClick={onBegin}
          disabled={isLoading}
          className="w-full"
          size="lg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBegin();
            }
          }}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Begin Story
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
