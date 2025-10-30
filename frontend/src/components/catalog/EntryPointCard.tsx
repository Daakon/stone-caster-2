/**
 * Entry Point Card Component
 * Displays a single entry point from the unified catalog
 * 
 * Spec: docs/CATALOG_UNIFIED_DTO_SPEC.md
 */

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Clock, Tag } from 'lucide-react';
import type { CatalogEntryPoint } from '@/types/catalog';

interface EntryPointCardProps {
  entryPoint: CatalogEntryPoint;
  onCardClick?: (id: string) => void;
  className?: string;
}

export const EntryPointCard = forwardRef<HTMLDivElement, EntryPointCardProps>(
  ({ entryPoint, onCardClick, className }, ref) => {
    const handleClick = () => {
      onCardClick?.(entryPoint.id);
    };

    // Determine playability status
    const statusChip = entryPoint.is_playable
      ? { label: 'Playable', variant: 'default' as const, icon: Play }
      : { label: 'Coming Soon', variant: 'secondary' as const, icon: Clock };

    return (
      <Card 
        ref={ref}
        className={`group hover:shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}
      >
        <Link 
          to={`/catalog/entry-points/${entryPoint.slug}`}
          className="block focus:outline-none"
          onClick={handleClick}
          aria-label={`View ${entryPoint.title}`}
        >
          <CardContent className="p-4">
            {/* Title */}
            <h3 className="font-semibold text-lg mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {entryPoint.title}
            </h3>
            
            {/* Subtitle/Tagline */}
            {entryPoint.subtitle && (
              <p className="text-sm text-muted-foreground italic mb-2 line-clamp-1">
                {entryPoint.subtitle}
              </p>
            )}
            
            {/* Description */}
            {entryPoint.synopsis && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {entryPoint.synopsis}
              </p>
            )}
            
            {/* Tags (limit to 3) */}
            {entryPoint.tags && entryPoint.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {entryPoint.tags.slice(0, 3).map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline"
                    className="text-xs"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {entryPoint.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{entryPoint.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Status & Metadata */}
            <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
              <Badge 
                variant={statusChip.variant}
                className="text-xs"
              >
                <statusChip.icon className="w-3 h-3 mr-1" />
                {statusChip.label}
              </Badge>
              
              {entryPoint.world_name && (
                <span className="flex items-center">
                  🌍 {entryPoint.world_name}
                </span>
              )}
              
              {entryPoint.type && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {entryPoint.type}
                </Badge>
              )}
              
              {entryPoint.content_rating && entryPoint.content_rating !== 'safe' && (
                <Badge variant="outline" className="text-xs capitalize">
                  {entryPoint.content_rating}
                </Badge>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="p-4 pt-0">
            <Button 
              variant={entryPoint.is_playable ? "default" : "outline"}
              size="sm" 
              className="w-full transition-colors"
              disabled={!entryPoint.is_playable}
            >
              {entryPoint.is_playable ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Adventure
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Coming Soon
                </>
              )}
            </Button>
          </CardFooter>
        </Link>
      </Card>
    );
  }
);

EntryPointCard.displayName = 'EntryPointCard';

