import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, Users, AlertCircle } from 'lucide-react';
import { EntryPoint } from '@/services/admin.entryPoints';
import { WizardData } from '../EntryWizard';
import { useNPCs } from '@/hooks/useNPCs';
import { useNPCPacks } from '@/hooks/useNPCPacks';

const npcsSchema = z.object({
  npcIds: z.array(z.string()),
  packIds: z.array(z.string()),
});

type NPCsFormData = z.infer<typeof npcsSchema>;

interface NPCsStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function NPCsStep({ entry, data, onUpdate, onComplete }: NPCsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedNPCs, setSelectedNPCs] = useState<string[]>(data.npcIds || []);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [filterWorld, setFilterWorld] = useState<string>(data.worldId || '');
  
  const { npcs, loading: npcsLoading } = useNPCs();
  const { npcPacks, loading: packsLoading } = useNPCPacks();
  
  const form = useForm<NPCsFormData>({
    resolver: zodResolver(npcsSchema),
    defaultValues: {
      npcIds: data.npcIds || [],
      packIds: [],
    },
  });
  
  const { handleSubmit, setValue, watch, formState: { isValid } } = form;
  
  // Filter NPCs by world
  const filteredNPCs = npcs?.filter(npc => {
    if (!filterWorld) return true;
    // TODO: Add world filtering logic when NPC-world relationship is established
    return true;
  }) || [];
  
  // Filter NPC Packs by world
  const filteredPacks = npcPacks?.filter(pack => {
    if (!filterWorld) return true;
    // TODO: Add world filtering logic when pack-world relationship is established
    return true;
  }) || [];
  
  const handleNPCToggle = (npcId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedNPCs, npcId]
      : selectedNPCs.filter(id => id !== npcId);
    
    setSelectedNPCs(newSelection);
    setValue('npcIds', newSelection);
    onUpdate({ npcIds: newSelection });
  };
  
  const handlePackToggle = (packId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedPacks, packId]
      : selectedPacks.filter(id => id !== packId);
    
    setSelectedPacks(newSelection);
    setValue('packIds', newSelection);
  };
  
  const onSubmit = async (formData: NPCsFormData) => {
    setIsSubmitting(true);
    
    try {
      // TODO: Save NPC bindings
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onUpdate({ npcIds: formData.npcIds });
      onComplete(formData);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* World Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by World</CardTitle>
          <CardDescription>
            Show NPCs and packs from the selected world
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Label htmlFor="world-filter">World:</Label>
            <Badge variant="outline">
              {filterWorld ? 'Filtered' : 'All Worlds'}
            </Badge>
            {filterWorld && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilterWorld('')}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Individual NPCs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual NPCs
          </CardTitle>
          <CardDescription>
            Select specific NPCs to include in this entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          {npcsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading NPCs...</p>
            </div>
          ) : filteredNPCs.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No NPCs found. Create some NPCs first or adjust your filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNPCs.map((npc) => (
                    <TableRow key={npc.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedNPCs.includes(npc.id)}
                          onCheckedChange={(checked) => 
                            handleNPCToggle(npc.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{npc.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {npc.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={npc.status === 'active' ? 'default' : 'secondary'}>
                          {npc.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* NPC Packs */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Packs</CardTitle>
          <CardDescription>
            Select NPC packs to include all NPCs in the pack
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading packs...</p>
            </div>
          ) : filteredPacks.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No NPC packs found. Create some packs first or adjust your filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPacks.map((pack) => (
                    <TableRow key={pack.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPacks.includes(pack.id)}
                          onCheckedChange={(checked) => 
                            handlePackToggle(pack.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{pack.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {pack.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pack.status === 'active' ? 'default' : 'secondary'}>
                          {pack.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Selection Summary</CardTitle>
          <CardDescription>
            Review your NPC selections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Individual NPCs:</span>
              <Badge variant="outline">{selectedNPCs.length} selected</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">NPC Packs:</span>
              <Badge variant="outline">{selectedPacks.length} selected</Badge>
            </div>
            {selectedNPCs.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Selected NPCs:</p>
                <div className="flex gap-1 flex-wrap">
                  {selectedNPCs.map(npcId => {
                    const npc = npcs?.find(n => n.id === npcId);
                    return (
                      <Badge key={npcId} variant="secondary">
                        {npc?.name || 'Unknown'}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={!isValid || isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </form>
  );
}
