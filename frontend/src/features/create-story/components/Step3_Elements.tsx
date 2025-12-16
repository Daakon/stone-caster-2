import React from 'react';
import { EntityBrowser } from './EntityBrowser';

export function Step3_Elements() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Elements</h2>
        <p className="text-muted-foreground">
          Populate your world with characters, items, and locations.
        </p>
      </div>

      <EntityBrowser />
    </div>
  );
}
