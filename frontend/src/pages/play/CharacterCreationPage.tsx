/**
 * Character Creation Page
 * Phase 4: Player Character Setup
 * 
 * Dynamic form for creating player characters based on world and ruleset schema
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraPlayService } from '@/services/chimera.play';

export default function CharacterCreationPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch character schema
  const { data: schema, isLoading, error } = useQuery({
    queryKey: ['character-schema', storyId],
    queryFn: () => chimeraPlayService.getCharacterSchema(storyId!),
    enabled: !!storyId,
  });

  // Initialize form data based on schema
  useEffect(() => {
    if (schema?.ui_schema_merged) {
      const initialData: Record<string, unknown> = {};
      // Extract default values from schema if available
      Object.keys(schema.ui_schema_merged).forEach((key) => {
        const fieldSchema = schema.ui_schema_merged[key] as any;
        if (fieldSchema?.default !== undefined) {
          initialData[key] = fieldSchema.default;
        }
      });
      setFormData(initialData);
    }
  }, [schema]);

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storyId) return;

    setIsSubmitting(true);
    try {
      const result = await chimeraPlayService.finalizeCharacter(storyId, {
        character_data: formData,
      });
      
      toast.success('Character created successfully!');
      // Navigate to the game state
      navigate(`/play/${result.game_state_id}`);
    } catch (error) {
      console.error('Error finalizing character:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to create character. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render form field based on schema type
  const renderField = (fieldName: string, fieldSchema: any) => {
    const fieldType = fieldSchema?.type || 'string';
    const label = fieldSchema?.title || fieldName;
    const description = fieldSchema?.description;
    const value = formData[fieldName] as string | undefined;

    switch (fieldType) {
      case 'string':
        if (fieldSchema?.enum) {
          // Render as select dropdown
          return (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={fieldName}>{label}</Label>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
              <Select
                value={value || ''}
                onValueChange={(val) => handleFieldChange(fieldName, val)}
              >
                <SelectTrigger id={fieldName}>
                  <SelectValue placeholder={`Select ${label}`} />
                </SelectTrigger>
                <SelectContent>
                  {fieldSchema.enum.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        // Render as text input
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Input
              id={fieldName}
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldSchema?.placeholder || `Enter ${label}`}
            />
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Input
              id={fieldName}
              type="number"
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, Number(e.target.value))}
              min={fieldSchema?.minimum}
              max={fieldSchema?.maximum}
              placeholder={fieldSchema?.placeholder || `Enter ${label}`}
            />
          </div>
        );

      default:
        // Fallback: render as text input
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Input
              id={fieldName}
              value={String(value || '')}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldSchema?.placeholder || `Enter ${label}`}
            />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load character creation form</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const schemaFields = schema?.ui_schema_merged || {};
  const hasFields = Object.keys(schemaFields).length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Your Character</h1>
            <p className="text-muted-foreground mt-2">
              {schema?.world_name ? `World: ${schema.world_name}` : 'Set up your character for this story'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Character Details</CardTitle>
              <CardDescription>
                Fill out the form below to create your character
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasFields ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No character creation fields are required for this story.</p>
                  <p className="text-sm mt-2">You can proceed with default values.</p>
                </div>
              ) : (
                Object.entries(schemaFields).map(([fieldName, fieldSchema]) =>
                  renderField(fieldName, fieldSchema)
                )
              )}

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Character & Start Game'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

