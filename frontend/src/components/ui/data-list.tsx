import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface ListItem {
  id: string;
  title: string;
  description?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  }>;
  onClick?: () => void;
  disabled?: boolean;
}

interface DataListProps {
  items: ListItem[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  'aria-label'?: string;
}

export function DataList({
  items,
  loading = false,
  emptyMessage = 'No items available',
  className,
  'aria-label': ariaLabel = 'Data list',
}: DataListProps) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-label="Loading data">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
          </div>
        ))}
        <span className="sr-only">Loading data...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)} role="list" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div key={item.id}>
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-colors',
              item.onClick && !item.disabled && 'cursor-pointer hover:bg-muted/50',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={item.disabled ? undefined : item.onClick}
            role={item.onClick ? 'button' : undefined}
            tabIndex={item.onClick && !item.disabled ? 0 : undefined}
            onKeyDown={(e) => {
              if (item.onClick && !item.disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                item.onClick();
              }
            }}
            aria-label={item.title}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{item.title}</h3>
                {item.badge && (
                  <Badge variant={item.badgeVariant || 'default'}>
                    {item.badge}
                  </Badge>
                )}
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              )}
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {item.description}
                </p>
              )}
            </div>
            
            {item.actions && item.actions.length > 0 && (
              <div className="flex items-center gap-2 ml-4">
                {item.actions.map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    variant={action.variant || 'ghost'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    aria-label={action.label}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {index < items.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}
