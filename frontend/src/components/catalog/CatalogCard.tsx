import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { usePrefetch } from '@/lib/usePrefetch';

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
  href: string;
  chips?: Array<{ label: string; variant?: 'default' | 'secondary' | 'outline' }>;
  onCardClick?: (entity: string, idOrSlug: string) => void;
  className?: string;
}

export const CatalogCard = forwardRef<HTMLDivElement, CatalogCardProps>(
  ({ entity, idOrSlug, title, description, imageUrl, href, chips, onCardClick, className }, ref) => {
    const { prefetchWorld, prefetchNPC, prefetchRuleset, prefetchStory } = usePrefetch();

    const handleClick = () => {
      onCardClick?.(entity, idOrSlug);
    };

    const handleMouseEnter = () => {
      // Prefetch the detail page data on hover
      switch (entity) {
        case 'world':
          prefetchWorld(idOrSlug);
          break;
        case 'npc':
          prefetchNPC(idOrSlug);
          break;
        case 'ruleset':
          prefetchRuleset(idOrSlug);
          break;
        case 'story':
          prefetchStory(idOrSlug);
          break;
      }
    };

    return (
      <Card 
        ref={ref}
        className={`group hover:shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}
        onMouseEnter={handleMouseEnter}
      >
        <Link 
          to={href} 
          className="block focus:outline-none"
          onClick={handleClick}
          aria-label={`View ${title}`}
        >
          {imageUrl && (
            <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                decoding="async"
                width={400}
                height={300}
              />
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