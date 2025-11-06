import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GripVertical, X } from 'lucide-react';
import { EntryPoint } from '@/services/admin.entryPoints';
import { WizardData } from '../EntryWizard';
import { NamedSinglePicker } from '@/admin/components/NamedSinglePicker';
import { NamedMultiPicker } from '@/admin/components/NamedMultiPicker';
import { useWorlds } from '@/hooks/useWorlds';
import { useRulesets } from '@/hooks/useRulesets';

const basicsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  worldId: z.string().min(1, 'World is required'),
  rulesetIds: z.array(z.string()).min(1, 'At least one ruleset is required'),
});

type BasicsFormData = z.infer<typeof basicsSchema>;

interface BasicsStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function BasicsStep({ entry, data, onUpdate, onComplete }: BasicsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { worlds, loading: worldsLoading } = useWorlds();
  const { rulesets, loading: rulesetsLoading } = useRulesets();
  
  const form = useForm<BasicsFormData>({
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      name: data.name || entry.name,
      slug: data.slug || entry.slug,
      worldId: data.worldId || entry.world_text_id,
      rulesetIds: data.rulesetIds || [],
    },
  });
  
  const { handleSubmit, watch, setValue, formState: { errors, isValid } } = form;
  
  const watchedRulesetIds = watch('rulesetIds');
  
  // Load existing rulesets for this entry
  useEffect(() => {
    // TODO: Load existing entry rulesets
    // This would typically come from a separate API call
  }, [entry.id]);
  
  const handleWorldChange = (worldId: string) => {
    setValue('worldId', worldId);
    onUpdate({ worldId });
  };
  
  const handleRulesetsChange = (rulesetIds: string[]) => {
    setValue('rulesetIds', rulesetIds);
    onUpdate({ rulesetIds });
  };
  
  const onSubmit = async (formData: BasicsFormData) => {
    setIsSubmitting(true);
    
    try {
      // TODO: Save entry basics
      // This would typically call an API to update the entry
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onUpdate(formData);
      onComplete(formData);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name and Slug */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>
              Basic information about this entry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter entry name"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                {...form.register('slug')}
                placeholder="entry-slug"
                readOnly
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-generated from name
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* World Selection */}
        <Card>
          <CardHeader>
            <CardTitle>World</CardTitle>
            <CardDescription>
              Select the world for this entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            {worldsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading worlds...</p>
              </div>
            ) : (
              <NamedSinglePicker
                items={worlds?.map(world => ({
                  id: world.id,
                  name: world.name,
                  description: world.description,
                })) || []}
                value={data.worldId}
                onValueChange={handleWorldChange}
                placeholder="Select a world"
              />
            )}
            {errors.worldId && (
              <p className="text-sm text-red-600 mt-1">{errors.worldId.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Rulesets Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Rulesets</CardTitle>
          <CardDescription>
            Select and order the rulesets for this entry. The order matters for prompt assembly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesetsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading rulesets...</p>
            </div>
          ) : (
            <NamedMultiPicker
              items={rulesets?.map(ruleset => ({
                id: ruleset.id,
                name: ruleset.name,
                description: ruleset.description,
              })) || []}
              value={watchedRulesetIds}
              onValueChange={handleRulesetsChange}
              placeholder="Select rulesets"
            />
          )}
          {errors.rulesetIds && (
            <p className="text-sm text-red-600 mt-1">{errors.rulesetIds.message}</p>
          )}
        </CardContent>
      </Card>
      
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Review your selections before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Entry:</span>
              <Badge variant="outline">{form.watch('name') || 'Untitled'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">World:</span>
              <Badge variant="outline">
                {worlds?.find(w => w.id === form.watch('worldId'))?.name || 'Not selected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Rulesets:</span>
              <div className="flex gap-1 flex-wrap">
                {watchedRulesetIds.map((rulesetId, index) => {
                  const ruleset = rulesets?.find(r => r.id === rulesetId);
                  return (
                    <Badge key={rulesetId} variant="secondary">
                      {index + 1}. {ruleset?.name || 'Unknown'}
                    </Badge>
                  );
                })}
              </div>
            </div>
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
