import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchWorld } from '@/lib/prefetch';
import { buildImageUrl } from '@shared/media/url';

/**
 * Normalized catalog card props - live data contract only.
 * No mock-era props (teaser, differentiators, spotlight_quote) allowed.
 */
interface CatalogCardProps {
  entity: 'world' | 'story' | 'npc' | 'ruleset';
  idOrSlug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  coverMedia?: { id: string; provider_key: string } | null;
  href: string;
  chips?: Array<{ label: string; variant?: 'default' | 'secondary' | 'outline' }>;
  onCardClick?: (entity: string, idOrSlug: string) => void;
  className?: string;
}

export const CatalogCard = forwardRef<HTMLDivElement, CatalogCardProps>(
  ({ entity, idOrSlug, title, description, imageUrl, coverMedia, href, chips, onCardClick, className }, ref) => {
    const queryClient = useQueryClient();

    const handleClick = () => {
      onCardClick?.(entity, idOrSlug);
    };

    const handleMouseEnter = () => {
      // Prefetch the detail page data on hover (PR8)
      switch (entity) {
        case 'world':
          prefetchWorld(queryClient, idOrSlug);
          break;
        case 'story':
          // For stories, we can prefetch the list if needed, but detail pages use different hooks
          // This is a placeholder - story detail prefetch would need a separate function
          break;
        // NPC and ruleset prefetch not yet implemented in prefetch.ts
        default:
          break;
      }
    };
    
    const handleTouchStart = () => {
      // Mobile prefetch on touch start
      handleMouseEnter();
    };
    
    const handleFocus = () => {
      // Desktop keyboard navigation prefetch
      handleMouseEnter();
    };

    // Phase 4: Build cover image URL from coverMedia or use imageUrl fallback
    const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL;
    const hasDeliveryUrl = !!deliveryUrl && deliveryUrl.trim() !== '';
    
    // Use 'public' variant as default (always exists in Cloudflare Images)
    // 'card' variant may not exist, so we use 'public' which is guaranteed to work
    const coverImageUrl = coverMedia && hasDeliveryUrl
      ? buildImageUrl(coverMedia.provider_key, 'public')
      : imageUrl || null;

    return (
      <Card 
        ref={ref}
        className={`group hover:shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleTouchStart}
        onFocus={handleFocus}
      >
        <Link 
          to={href} 
          className="block focus:outline-none"
          onClick={handleClick}
          aria-label={`View ${title}`}
        >
          {coverImageUrl ? (
            /* NPCs use 3:4 portrait, Worlds/Stories use 16:9 landscape */
            <div className={`overflow-hidden rounded-t-lg bg-muted ${
              entity === 'npc' ? 'aspect-[3/4]' : 'aspect-video'
            }`}>
              <img
                src={coverImageUrl}
                alt={`${title} cover`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                decoding="async"
                width={entity === 'npc' ? 300 : 400}
                height={entity === 'npc' ? 400 : 300}
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
            <div className={`overflow-hidden rounded-t-lg bg-muted flex items-center justify-center ${
              entity === 'npc' ? 'aspect-[3/4]' : 'aspect-video'
            }`}>
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
            
            {description && (
              <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                {description}
              </p>
            )}
            
            {chips && chips.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {chips.map((chip, index) => (
                  <Badge 
                    key={index} 
                    variant={chip.variant || 'secondary'}
                    className="text-xs"
                  >
                    {chip.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="p-4 pt-0">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              View {entity === 'npc' ? 'NPC' : entity.charAt(0).toUpperCase() + entity.slice(1)}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </CardFooter>
        </Link>
      </Card>
    );
  }
);

CatalogCard.displayName = 'CatalogCard';