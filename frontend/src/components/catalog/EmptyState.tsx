import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  icon,
  action,
  secondaryAction,
  className 
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="mb-4 text-muted-foreground">
          {icon || <Search className="h-12 w-12" />}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          {title}
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button asChild>
              <Link to={action.href}>
                {action.label}
              </Link>
            </Button>
          )}
          
          {secondaryAction && (
            <Button variant="outline" asChild>
              <Link to={secondaryAction.href}>
                {secondaryAction.label}
              </Link>
            </Button>
          )}
          
          {!action && !secondaryAction && (
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
