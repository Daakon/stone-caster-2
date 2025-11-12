import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  FileText,
  Users,
  Globe,
  ScrollText,
  Tag,
  CheckCircle
} from 'lucide-react';
import { type EntryPoint } from '@/services/admin.entryPoints';
import { type WizardData } from '../EntryWizard';
import { useWorlds } from '@/hooks/useWorlds';
import { useRulesets } from '@/hooks/useRulesets';
import { useNPCs } from '@/hooks/useNPCs';

interface PreviewStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function PreviewStep({ entry, data, onComplete }: PreviewStepProps) {
  const { worlds } = useWorlds();
  const { rulesets } = useRulesets();
  const { npcs } = useNPCs();
  
  // Get display names for IDs
  const selectedWorld = worlds?.find((w: { id: string }) => w.id === (data.worldId || entry.world_id));
  const selectedRulesets = rulesets?.filter(r => data.rulesetIds?.includes(r.id)) || [];
  const selectedNPCs = npcs?.filter(n => data.npcIds?.includes(n.id)) || [];
  
  const storyName = data.name || entry.name || entry.title || 'Untitled Story';
  const storyType = data.type || entry.type || 'adventure';
  const storySubtitle = data.subtitle || entry.subtitle || '';
  const storySynopsis = data.synopsis || entry.synopsis || entry.description || '';
  const storyTags = data.tags || entry.tags || [];
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Story Preview
          </CardTitle>
          <CardDescription>
            Review all configured settings for this story
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Story Name</Label>
              <p className="text-lg font-medium mt-1">{storyName}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">Type</Label>
                <div className="mt-1">
                  <Badge variant="outline" className="capitalize">{storyType}</Badge>
                </div>
              </div>
              
              {storySubtitle && (
                <div>
                  <Label className="text-sm font-semibold">Subtitle</Label>
                  <p className="text-sm text-muted-foreground mt-1">{storySubtitle}</p>
                </div>
              )}
            </div>
            
            {storySynopsis && (
              <div>
                <Label className="text-sm font-semibold">Synopsis</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{storySynopsis}</p>
              </div>
            )}
            
            {storyTags.length > 0 && (
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {storyTags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="border-t pt-4 space-y-4">
            {/* World */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                World
              </Label>
              {selectedWorld ? (
                <div className="mt-2">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {selectedWorld.name}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">No world selected</p>
              )}
            </div>
            
            {/* Rulesets */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Rulesets
              </Label>
              {selectedRulesets.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRulesets.map((ruleset) => (
                    <Badge key={ruleset.id} variant="outline">
                      {ruleset.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">No rulesets selected</p>
              )}
            </div>
            
            {/* NPCs */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                NPCs
              </Label>
              {selectedNPCs.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedNPCs.map((npc) => (
                    <Badge key={npc.id} variant="outline">
                      {npc.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">No NPCs selected</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end">
        <Button
          onClick={() => onComplete({})}
          className="min-w-[120px]"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
