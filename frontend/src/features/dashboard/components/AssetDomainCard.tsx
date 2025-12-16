/**
 * Asset Domain Card
 * Displays a list of Worlds or Entities with inline "Add Context" actions
 * 
 * Architecture: Lore is contextual memory, not a peer domain
 */

import React from 'react';
import { Scroll, Plus, Edit, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Note: Using title attribute for tooltips (native browser tooltips)
// In production, consider adding a Tooltip component from shadcn/ui
import { cn } from '@/lib/utils';
import type { UserWorld, UserEntity } from '../../create-story/data/mock-library';

interface AssetDomainCardProps {
  title: string;
  description: string;
  items: (UserWorld | UserEntity)[];
  type: 'world' | 'entity';
  onAddContext?: (itemId: string, itemName: string, type: 'world' | 'entity') => void;
  onEdit?: (itemId: string) => void;
}

export function AssetDomainCard({
  title,
  description,
  items,
  type,
  onAddContext,
  onEdit,
}: AssetDomainCardProps) {
  const handleAddContext = (item: UserWorld | UserEntity) => {
    const itemId = type === 'world' 
      ? (item as UserWorld).world_id 
      : (item as UserEntity).entity_id;
    const itemName = type === 'world' 
      ? (item as UserWorld).title 
      : (item as UserEntity).name;
    
    if (onAddContext) {
      onAddContext(itemId, itemName, type);
    } else {
      // Default behavior: log intent
      console.log(`[AssetDomainCard] Add context to ${type}:`, {
        id: itemId,
        name: itemName,
        type,
      });
    }
  };

  const handleEdit = (item: UserWorld | UserEntity) => {
    if (onEdit) {
      const itemId = type === 'world' 
        ? (item as UserWorld).world_id 
        : (item as UserEntity).entity_id;
      onEdit(itemId);
    }
  };

  const formatDate = (dateString: string) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No {type === 'world' ? 'worlds' : 'entities'} yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const itemName = type === 'world' 
                ? (item as UserWorld).title 
                : (item as UserEntity).name;
              const itemId = type === 'world' 
                ? (item as UserWorld).world_id 
                : (item as UserEntity).entity_id;
              const updatedAt = type === 'world'
                ? (item as UserWorld).updated_at
                : (item as UserEntity).updated_at;

              return (
                <div
                  key={itemId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{itemName}</h4>
                      {item.lore_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                          title={`${item.lore_count} ${item.lore_count === 1 ? 'context fragment' : 'context fragments'} - ${type === 'world' ? 'Lore about this world' : 'Memories and bio about this entity'}`}
                        >
                          <Scroll className="h-3 w-3" />
                          {item.lore_count}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Updated {formatDate(updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {/* Add Context Button (Secondary) */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddContext(item)}
                      className="h-8 w-8 p-0"
                      aria-label={`Add context to ${itemName}`}
                      title={`Add ${type === 'world' ? 'world lore' : 'memory/bio'} - Helps the AI understand this ${type === 'world' ? 'world' : 'entity'} better`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {/* Edit Button (Primary) */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="h-8 px-2 text-xs"
                      aria-label={`Edit ${itemName}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
