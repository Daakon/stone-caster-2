// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Entities Management Page
 * Dashboard page for managing Chimera entities (NPCs, Items, Locations)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getEntities } from '@/services/chimera-api';
import type { EntityTemplate } from '@shared/types/chimera-authoring';

const ENTITY_KIND_COLORS = {
  npc: 'default',
  item: 'secondary',
  location: 'outline',
} as const;

export default function EntitiesPage() {
  const [activeTab, setActiveTab] = useState<'npc' | 'item' | 'location'>('npc');

  const { data: entities, isLoading, error } = useQuery({
    queryKey: ['chimera-entities'],
    queryFn: () => getEntities(),
    staleTime: 30 * 1000,
  });

  const filteredEntities = entities?.filter((e) => e.kind === activeTab) || [];

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
              {error instanceof Error ? error.message : 'Failed to load entities'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Entities</h1>
        <p className="text-muted-foreground mt-1">
          Manage game entities: NPCs, Items, and Locations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Templates</CardTitle>
          <CardDescription>
            {entities?.length || 0} entit{entities?.length !== 1 ? 'ies' : 'y'} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'npc' | 'item' | 'location')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="npc">NPCs</TabsTrigger>
              <TabsTrigger value="item">Items</TabsTrigger>
              <TabsTrigger value="location">Locations</TabsTrigger>
            </TabsList>
            <TabsContent value="npc" className="mt-4">
              <EntityList entities={filteredEntities} kind="npc" />
            </TabsContent>
            <TabsContent value="item" className="mt-4">
              <EntityList entities={filteredEntities} kind="item" />
            </TabsContent>
            <TabsContent value="location" className="mt-4">
              <EntityList entities={filteredEntities} kind="location" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function EntityList({ entities, kind }: { entities: EntityTemplate[]; kind: 'npc' | 'item' | 'location' }) {
  if (entities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No {kind}s found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Kind</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entities.map((entity) => (
          <TableRow key={entity.id}>
            <TableCell className="font-mono text-sm">{entity.id}</TableCell>
            <TableCell>
              <Badge variant={ENTITY_KIND_COLORS[entity.kind]}>
                {entity.kind}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

