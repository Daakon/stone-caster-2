/**
 * Prompt Preview Result Component
 * Displays TurnPacket JSON, linearized text, and warnings
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface PromptPreviewResultProps {
  data: {
    tp: any;
    linearized: string;
  };
  warnings: Array<{
    type: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
  errors: Array<{
    type: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
}

export function PromptPreviewResult({ data, warnings, errors }: PromptPreviewResultProps) {
  return (
    <div className="space-y-4">
      {(warnings.length > 0 || errors.length > 0) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              {errors.map((e, i) => (
                <div key={i} className="text-sm text-red-600 dark:text-red-400">
                  ❌ {e.message}
                </div>
              ))}
              {warnings.map((w, i) => (
                <div key={i} className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ {w.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="json" className="space-y-4">
        <TabsList>
          <TabsTrigger value="json">TurnPacket JSON</TabsTrigger>
          <TabsTrigger value="text">Linearized Text</TabsTrigger>
        </TabsList>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>TurnPacketV3</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <CollapsibleSection title="Core" defaultOpen>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(data.tp.core, null, 2)}
                  </pre>
                </CollapsibleSection>
                <CollapsibleSection title="Ruleset">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(data.tp.ruleset, null, 2)}
                  </pre>
                </CollapsibleSection>
                <CollapsibleSection title="World">
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                    {JSON.stringify(data.tp.world, null, 2)}
                  </pre>
                </CollapsibleSection>
                {data.tp.scenario && (
                  <CollapsibleSection title="Scenario">
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(data.tp.scenario, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
                {data.tp.npcs && data.tp.npcs.length > 0 && (
                  <CollapsibleSection title="NPCs">
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(data.tp.npcs, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          <Card>
            <CardHeader>
              <CardTitle>Linearized Prompt Text</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded overflow-auto whitespace-pre-wrap">
                {data.linearized}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

