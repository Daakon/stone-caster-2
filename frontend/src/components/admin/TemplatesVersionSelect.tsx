/**
 * Templates Version Select Component
 * Dropdown for selecting templates version with "Latest Published" option
 */

import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { api } from '@/lib/api';

interface TemplatesVersionSelectProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  gameId?: string;
}

export function TemplatesVersionSelect({ value, onChange, gameId }: TemplatesVersionSelectProps) {
  // Fetch available template versions
  const { data: versions, isLoading } = useQuery({
    queryKey: ['admin', 'templates', 'versions'],
    queryFn: async () => {
      const res = await api.get('/api/admin/templates/versions');
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.data as number[];
    },
  });

  return (
    <div className="space-y-2">
      <Label>Templates Version</Label>
      <Select
        value={value === null || value === undefined ? 'latest' : String(value)}
        onValueChange={(v) => onChange(v === 'latest' ? null : parseInt(v, 10))}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Latest Published</SelectItem>
          {versions?.map((v) => (
            <SelectItem key={v} value={String(v)}>
              Version {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Pinned versions freeze rendering for this story until changed. Use "Latest Published" to auto-update.
        </AlertDescription>
      </Alert>
    </div>
  );
}

