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
    
    // Adventure detail
    if (pathname.match(/^\/adventures\/[^\/]+$/)) {
      return 'Back to Adventures';
    }
    
    // World detail
    if (pathname.match(/^\/worlds\/[^\/]+$/)) {
      return 'Back to Worlds';
    }
    
    // Game
    if (pathname.startsWith('/game/')) {
      return 'Back to My Games';
    }
    
    // Character selection
    if (pathname.includes('/characters')) {
      return 'Back to Adventure';
    }
    
    return 'Back';
  };

  const getBreadcrumbHref = () => {
    if (href) return href;
    
    const pathname = location.pathname;
    
    // Adventure detail
    if (pathname.match(/^\/adventures\/[^\/]+$/)) {
      return '/adventures';
    }
    
    // World detail
    if (pathname.match(/^\/worlds\/[^\/]+$/)) {
      return '/worlds';
    }
    
    // Game
    if (pathname.startsWith('/game/')) {
      return '/adventures'; // TODO: Update to actual my games route
    }
    
    // Character selection
    if (pathname.includes('/characters')) {
      const adventureId = pathname.split('/')[2];
      return `/adventures/${adventureId}`;
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


