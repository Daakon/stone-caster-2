import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { type EntryPoint } from '@/services/admin.entryPoints';
import { type WizardData } from '../EntryWizard';

interface SegmentsStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function SegmentsStep({ entry, data, onUpdate, onComplete }: SegmentsStepProps) {
  const [segments, setSegments] = useState<Array<{
    scope: string;
    refId: string;
    count: number;
    missing: boolean;
  }>>(data.segments || []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // TODO: Load segments for this entry
    // This would typically call an API to get the required segments
    // For now, we'll use empty array or data from wizard
    if (data.segments) {
      setSegments(data.segments);
    }
  }, [data.segments, entry.id]);

  const handleComplete = () => {
    onUpdate({ segments });
    onComplete({ segments });
  };

  const totalSegments = segments.length;
  const missingSegments = segments.filter(s => s.missing).length;
  const completedSegments = totalSegments - missingSegments;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Checklist
          </CardTitle>
          <CardDescription>
            Review required content segments for this entry point
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading segments...</p>
            </div>
          ) : segments.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No segments defined for this entry point. Segments will be determined based on the selected world and rulesets.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Progress</p>
                  <p className="text-xs text-muted-foreground">
                    {completedSegments} of {totalSegments} segments completed
                  </p>
                </div>
                <Badge variant={missingSegments === 0 ? 'default' : 'secondary'}>
                  {missingSegments === 0 ? 'Complete' : `${missingSegments} missing`}
                </Badge>
              </div>

              <div className="space-y-2">
                {segments.map((segment, index) => (
                  <div
                    key={`${segment.scope}-${segment.refId}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {segment.missing ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium">{segment.scope}</p>
                        <p className="text-sm text-muted-foreground">
                          {segment.refId} • {segment.count} required
                        </p>
                      </div>
                    </div>
                    <Badge variant={segment.missing ? 'secondary' : 'default'}>
                      {segment.missing ? 'Missing' : 'Complete'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleComplete}>
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}

