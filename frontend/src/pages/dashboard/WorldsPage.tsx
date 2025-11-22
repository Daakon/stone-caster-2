// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Worlds Management Page
 * Dashboard page for viewing Chimera worlds
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getWorlds } from '@/services/chimera-api';
import type { WorldDefinition } from '@shared/types/chimera-authoring';

export default function WorldsPage() {
  const { data: worlds, isLoading, error } = useQuery({
    queryKey: ['chimera-worlds'],
    queryFn: () => getWorlds(),
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load worlds'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Worlds</h1>
        <p className="text-muted-foreground mt-1">
          Browse available game worlds
        </p>
      </div>

      {worlds && worlds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worlds.map((world) => (
            <Card key={world.id} className="overflow-hidden">
              {world.images && world.images.length > 0 && world.images[0]?.path ? (
                <div className="aspect-video bg-muted relative">
                  <img
                    src={world.images[0].path}
                    alt={world.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No image</span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="line-clamp-1">{world.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {world.description || 'No description'}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No worlds found.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

