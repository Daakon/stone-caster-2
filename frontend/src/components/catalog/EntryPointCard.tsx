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
import { Play, Clock, Tag, Image as ImageIcon } from 'lucide-react';
import type { CatalogEntryPoint } from '@/types/catalog';
import { buildImageUrl } from '@shared/media/url';

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

    // Phase 4: Build cover image URL from coverMedia
    const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
    const hasDeliveryUrl = !!deliveryUrl && deliveryUrl.trim() !== '';
    const coverImageUrl = entryPoint.cover_media && hasDeliveryUrl
      ? buildImageUrl(entryPoint.cover_media.provider_key, 'card')
      : null;

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
          {coverImageUrl ? (
            <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
              <img
                src={coverImageUrl}
                alt={`${entryPoint.title} cover`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                decoding="async"
                width={400}
                height={300}
                onError={(e) => {
                  // Fallback to placeholder on error
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.cover-placeholder')) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'cover-placeholder flex h-full w-full items-center justify-center bg-muted';
                    placeholder.innerHTML = '<svg class="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                    parent.appendChild(placeholder);
                  }
                }}
              />
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
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

