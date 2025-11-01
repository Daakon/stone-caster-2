/**
 * Phase 5.1: Empty state for TurnsList when no turns exist
 */

import { Card, CardContent } from '../ui/card';
import { MessageSquare } from 'lucide-react';

export function EmptyTurnsState() {
  return (
    <Card role="status" aria-label="No turns">
      <CardContent className="p-8 text-center">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold mb-2">No turns yet</h3>
        <p className="text-sm text-muted-foreground">
          Game turns will appear here once gameplay begins.
        </p>
      </CardContent>
    </Card>
  );
}

