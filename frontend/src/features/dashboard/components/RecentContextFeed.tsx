/**
 * Recent Context Feed
 * Displays recent lore/context additions to show the RAG system at work
 * 
 * Shows how disparate data points feed into the same intelligence system
 */

import React from 'react';
import { Scroll, Globe, User, BookOpen, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LoreFragment } from '../../create-story/data/mock-library';

interface RecentContextFeedProps {
  recentLore: LoreFragment[];
  maxItems?: number;
}

export function RecentContextFeed({ recentLore, maxItems = 5 }: RecentContextFeedProps) {
  // Sort by created_at (most recent first) and limit
  const sortedLore = [...recentLore]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  const getParentIcon = (parentType: 'world' | 'entity' | 'story') => {
    switch (parentType) {
      case 'world':
        return <Globe className="h-3 w-3" />;
      case 'entity':
        return <User className="h-3 w-3" />;
      case 'story':
        return <BookOpen className="h-3 w-3" />;
    }
  };

  const getParentLabel = (lore: LoreFragment) => {
    const typeLabel = lore.parent_type === 'world' ? 'World' : lore.parent_type === 'entity' ? 'Entity' : 'Story';
    return `[${typeLabel}: ${lore.parent_name}]`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (sortedLore.length === 0) {
    return null; // Don't render if no updates
  }

  return (
    <Card className="bg-muted/30 border-muted">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono">
          <Scroll className="h-4 w-4" />
          Recent Context Updates
        </CardTitle>
        <CardDescription className="text-xs font-mono">
          System Memory Log • This context is retrieved by the AI during gameplay
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedLore.map((lore) => (
            <div
              key={lore.id}
              className="flex items-start gap-3 p-2.5 border border-muted-foreground/20 rounded bg-background/50 hover:bg-background/70 transition-colors font-mono text-xs"
            >
              <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                {getParentIcon(lore.parent_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-foreground/90 font-semibold">{lore.title}</span>
                  <Badge variant="outline" className="text-xs flex-shrink-0 font-mono">
                    {getParentLabel(lore)}
                  </Badge>
                </div>
                <p className="text-muted-foreground/80 line-clamp-2 mb-1.5">
                  {lore.content}
                </p>
                <div className="flex items-center gap-1.5 text-muted-foreground/60">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{formatTime(lore.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
