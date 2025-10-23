import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Plus, AlertCircle, FileText } from 'lucide-react';
import { Entry } from '@/services/admin.entries';
import { WizardData } from '../EntryWizard';
import { usePromptSegments } from '@/hooks/usePromptSegments';

interface SegmentsStepProps {
  entry: Entry;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

interface SegmentInfo {
  scope: string;
  refId: string;
  refName: string;
  count: number;
  missing: boolean;
  description: string;
}

export function SegmentsStep({ entry, data, onUpdate, onComplete }: SegmentsStepProps) {
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>('');
  
  const { segments: allSegments, loading: segmentsLoading } = usePromptSegments();
  
  useEffect(() => {
    loadSegmentInfo();
  }, [entry, data, allSegments]);
  
  const loadSegmentInfo = async () => {
    setIsLoading(true);
    
    try {
      const segmentInfo: SegmentInfo[] = [];
      
      // Core segments (global)
      const coreSegments = allSegments?.filter(s => s.scope === 'core' && s.active) || [];
      segmentInfo.push({
        scope: 'core',
        refId: '',
        refName: 'Global',
        count: coreSegments.length,
        missing: coreSegments.length === 0,
        description: 'System-wide prelude, always included',
      });
      
      // Ruleset segments
      if (data.rulesetIds) {
        for (const rulesetId of data.rulesetIds) {
          const rulesetSegments = allSegments?.filter(s => 
            s.scope === 'ruleset' && s.ref_id === rulesetId && s.active
          ) || [];
          
          // Find ruleset name
          const rulesetName = 'Ruleset'; // TODO: Get actual ruleset name
          
          segmentInfo.push({
            scope: 'ruleset',
            refId: rulesetId,
            refName: rulesetName,
            count: rulesetSegments.length,
            missing: rulesetSegments.length === 0,
            description: 'Mechanics or guidance for this ruleset',
          });
        }
      }
      
      // World segments
      if (data.worldId) {
        const worldSegments = allSegments?.filter(s => 
          s.scope === 'world' && s.ref_id === data.worldId && s.active
        ) || [];
        
        segmentInfo.push({
          scope: 'world',
          refId: data.worldId,
          refName: 'World', // TODO: Get actual world name
          count: worldSegments.length,
          missing: worldSegments.length === 0,
          description: 'Lore + invariants for this world',
        });
      }
      
      // Entry segments
      const entrySegments = allSegments?.filter(s => 
        s.scope === 'entry' && s.ref_id === entry.id && s.active
      ) || [];
      
      segmentInfo.push({
        scope: 'entry',
        refId: entry.id,
        refName: entry.name,
        count: entrySegments.length,
        missing: entrySegments.length === 0,
        description: 'Scenario-specific context for this entry',
      });
      
      // Entry start segments
      const entryStartSegments = allSegments?.filter(s => 
        s.scope === 'entry_start' && s.ref_id === entry.id && s.active
      ) || [];
      
      segmentInfo.push({
        scope: 'entry_start',
        refId: entry.id,
        refName: entry.name,
        count: entryStartSegments.length,
        missing: entryStartSegments.length === 0,
        description: 'One-time intro for first turn only',
      });
      
      // NPC segments
      if (data.npcIds) {
        for (const npcId of data.npcIds) {
          const npcSegments = allSegments?.filter(s => 
            s.scope === 'npc' && s.ref_id === npcId && s.active
          ) || [];
          
          // Find NPC name
          const npcName = 'NPC'; // TODO: Get actual NPC name
          
          segmentInfo.push({
            scope: 'npc',
            refId: npcId,
            refName: npcName,
            count: npcSegments.length,
            missing: npcSegments.length === 0,
            description: 'Character profile with tiered reveals',
          });
        }
      }
      
      setSegments(segmentInfo);
    } catch (error) {
      console.error('Error loading segment info:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddSegment = (scope: string) => {
    setSelectedScope(scope);
    setShowAddModal(true);
  };
  
  const handleComplete = () => {
    onComplete({ segments });
  };
  
  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'core': return <FileText className="h-4 w-4" />;
      case 'ruleset': return <FileText className="h-4 w-4" />;
      case 'world': return <FileText className="h-4 w-4" />;
      case 'entry': return <FileText className="h-4 w-4" />;
      case 'entry_start': return <FileText className="h-4 w-4" />;
      case 'npc': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };
  
  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'core': return 'bg-blue-100 text-blue-800';
      case 'ruleset': return 'bg-green-100 text-green-800';
      case 'world': return 'bg-purple-100 text-purple-800';
      case 'entry': return 'bg-orange-100 text-orange-800';
      case 'entry_start': return 'bg-yellow-100 text-yellow-800';
      case 'npc': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading segment information...</p>
      </div>
    );
  }
  
  const missingSegments = segments.filter(s => s.missing);
  const hasErrors = missingSegments.some(s => s.scope === 'core' || s.scope === 'ruleset' || s.scope === 'world' || s.scope === 'entry');
  
  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Checklist</CardTitle>
          <CardDescription>
            Review and manage prompt segments for this entry. Each scope serves a specific purpose in prompt assembly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Total Segments:</span>
                <Badge variant="outline">{segments.reduce((sum, s) => sum + s.count, 0)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Missing:</span>
                <Badge variant={missingSegments.length > 0 ? 'destructive' : 'outline'}>
                  {missingSegments.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <Badge variant={hasErrors ? 'destructive' : 'default'}>
                  {hasErrors ? 'Issues Found' : 'Ready'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Segment List */}
      <div className="space-y-4">
        {segments.map((segment, index) => (
          <Card key={`${segment.scope}-${segment.refId}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getScopeIcon(segment.scope)}
                  <div>
                    <CardTitle className="text-lg">
                      {segment.scope.charAt(0).toUpperCase() + segment.scope.slice(1)}
                    </CardTitle>
                    <CardDescription>
                      {segment.refName} • {segment.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {segment.missing ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  <Badge variant={segment.missing ? 'destructive' : 'default'}>
                    {segment.count} segment{segment.count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getScopeColor(segment.scope)}>
                    {segment.scope}
                  </Badge>
                  {segment.missing && (
                    <Badge variant="destructive">
                      Missing
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSegment(segment.scope)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Segment
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Warnings */}
      {missingSegments.length > 0 && (
        <Alert variant={hasErrors ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {hasErrors ? (
              <>
                <strong>Required segments are missing:</strong> You must add segments for core, ruleset, world, and entry scopes before proceeding.
              </>
            ) : (
              <>
                <strong>Optional segments are missing:</strong> Consider adding entry_start and NPC segments for better gameplay experience.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Actions */}
      <div className="flex justify-end">
        <Button 
          onClick={handleComplete}
          disabled={hasErrors}
          className="min-w-[120px]"
        >
          {hasErrors ? 'Fix Issues First' : 'Continue to Preview'}
        </Button>
      </div>
      
      {/* Add Segment Modal would go here */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Add {selectedScope} Segment</CardTitle>
              <CardDescription>
                Create a new prompt segment for {selectedScope}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Segment form would go here...</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowAddModal(false)}>
                  Add Segment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
