/**
 * Top List Component
 * Displays a ranked list of items
 */

interface TopListItem {
  [key: string]: string | number;
}

interface TopListProps {
  items: TopListItem[];
  labelKey: string;
  valueKey: string;
}

export function TopList({ items, labelKey, valueKey }: TopListProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No data available</div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground w-6">
              #{index + 1}
            </span>
            <span className="text-sm font-medium">{String(item[labelKey])}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

