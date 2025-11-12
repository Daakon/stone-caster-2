import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BreadcrumbsProps {
  variant?: 'back' | 'breadcrumb';
  label?: string;
  href?: string;
}

export function Breadcrumbs({ variant = 'back', label, href }: BreadcrumbsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getBreadcrumbLabel = () => {
    if (label) return label;
    
    const pathname = location.pathname;
    
    // Story detail
    if (pathname.match(/^\/stories\/[^\/]+$/)) {
      return 'Back to Stories';
    }
    
    // World detail
    if (pathname.match(/^\/worlds\/[^\/]+$/)) {
      return 'Back to Worlds';
    }
    
    // NPC detail
    if (pathname.match(/^\/npcs\/[^\/]+$/)) {
      return 'Back to NPCs';
    }
    
    // Ruleset detail
    if (pathname.match(/^\/rulesets\/[^\/]+$/)) {
      return 'Back to Rulesets';
    }
    
    // Game
    if (pathname.startsWith('/game/') || pathname.startsWith('/play/')) {
      return 'Back to Stories';
    }
    
    // Character selection
    if (pathname.includes('/characters')) {
      return 'Back to Story';
    }
    
    return 'Back';
  };

  const getBreadcrumbHref = () => {
    if (href) return href;
    
    const pathname = location.pathname;
    
    // Story detail
    if (pathname.match(/^\/stories\/[^\/]+$/)) {
      return '/stories';
    }
    
    // World detail
    if (pathname.match(/^\/worlds\/[^\/]+$/)) {
      return '/worlds';
    }
    
    // NPC detail
    if (pathname.match(/^\/npcs\/[^\/]+$/)) {
      return '/npcs';
    }
    
    // Ruleset detail
    if (pathname.match(/^\/rulesets\/[^\/]+$/)) {
      return '/rulesets';
    }
    
    // Game
    if (pathname.startsWith('/game/') || pathname.startsWith('/play/')) {
      return '/stories';
    }
    
    // Character selection
    if (pathname.includes('/characters')) {
      const storyId = pathname.split('/')[2];
      return `/stories/${storyId}`;
    }
    
    return '/';
  };

  if (variant === 'breadcrumb') {
    // TODO: Implement full breadcrumb trail if needed
    return null;
  }

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(getBreadcrumbHref())}
        className="text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {getBreadcrumbLabel()}
      </Button>
    </div>
  );
}

