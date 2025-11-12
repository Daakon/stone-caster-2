import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { EntryWizard } from '@/admin/components/EntryWizard/EntryWizard';
import { useEntry } from '@/hooks/useEntry';
import { useNavigate } from 'react-router-dom';
import { entryPointsService } from '@/services/admin.entryPoints';
import { toast } from 'sonner';

const STEPS = [
  { id: 'basics', title: 'Basics', description: 'Name, World, Rulesets' },
  { id: 'npcs', title: 'NPCs', description: 'Character bindings' },
  { id: 'segments', title: 'Segments', description: 'Content checklist' },
  { id: 'preview', title: 'Preview', description: 'Live preview & test' },
];

export default function EntryWizardPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const isNew = id === 'new';
  const { entry, loading: entryLoading, error: entryError } = useEntry(isNew ? '' : id!);
  
  // Handle creating a new entry when id is 'new'
  useEffect(() => {
    if (isNew && !isCreating) {
      const createMinimalEntry = async () => {
        try {
          setIsCreating(true);
          // Get available worlds to use the first one as default
          const worlds = await entryPointsService.getWorlds();
          if (!worlds || worlds.length === 0) {
            toast.error('No worlds available. Please create a world first.');
            navigate('/admin/entry-points');
            return;
          }
          
          // Create a minimal entry point with required fields
          const newEntry = await entryPointsService.createEntryPoint({
            name: `story-${Date.now()}`,
            type: 'adventure', // Valid type: 'adventure' | 'scenario' | 'sandbox' | 'quest'
            world_id: worlds[0].id, // Use first available world as default
            rulesetIds: [],
            title: 'New Story',
            description: 'Created via wizard - configure in wizard',
            tags: [],
            visibility: 'private',
            content_rating: 'everyone',
          });
          toast.success('Story created, opening wizard...');
          // Navigate to wizard with the new entry's ID
          navigate(`/admin/entry-points/wizard/${newEntry.id}`, { replace: true });
        } catch (error: any) {
          console.error('Failed to create story:', error);
          toast.error(error?.message || 'Failed to create story. Please create it manually first.');
          navigate('/admin/entry-points');
        } finally {
          setIsCreating(false);
        }
      };
      
      createMinimalEntry();
    }
  }, [isNew, isCreating, navigate]);
  
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const stepIndex = parseInt(stepParam);
      if (stepIndex >= 0 && stepIndex < STEPS.length) {
        setCurrentStep(stepIndex);
      }
    }
  }, [searchParams]);
  
  useEffect(() => {
    setIsLoading(entryLoading);
  }, [entryLoading]);
  
  const updateStep = (newStep: number) => {
    if (isDirty && newStep < currentStep) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to go back?'
      );
      if (!confirmed) return;
    }
    
    setCurrentStep(newStep);
    setSearchParams({ step: newStep.toString() });
  };
  
  const handleStepComplete = async (stepData: any) => {
    setIsDirty(false);
    // Refetch entry data to ensure we have the latest saved values
    // This is handled by React Query's automatic refetch on window focus
    // But we can also manually invalidate the query if needed
    if (currentStep < STEPS.length - 1) {
      updateStep(currentStep + 1);
    }
  };
  
  const handleDirtyChange = (dirty: boolean) => {
    setIsDirty(dirty);
  };
  
  // Show loading state while creating new entry
  if (isNew && isCreating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Creating new story...</p>
        </div>
      </div>
    );
  }
  
  if (entryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading entry...</p>
        </div>
      </div>
    );
  }
  
  if (entryError || (!isNew && !entry)) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {entryError || 'Entry not found'}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => navigate('/admin/entry-points')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Entry Points
        </Button>
      </div>
    );
  }
  
  // Determine if this is a new entry (just created) or existing
  const isNewEntry = entry && (
    entry.name?.startsWith('story-') || 
    entry.title === 'New Story' ||
    entry.description === 'Created via wizard - configure in wizard'
  );
  const mode = isNewEntry ? 'New' : 'Edit';

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/entry-points')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Entry Setup Wizard</h1>
              <Badge variant={isNewEntry ? 'default' : 'secondary'} className="text-sm">
                {mode} Mode
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Configure {entry.name || 'your entry'} for optimal gameplay
            </p>
          </div>
        </div>
        
        {/* Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(((currentStep + 1) / STEPS.length) * 100)}% complete
            </span>
          </div>
          <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-2" />
        </div>
      </div>
      
      {/* Step Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {STEPS.map((step, index) => (
          <Card 
            key={step.id}
            className={`cursor-pointer transition-colors ${
              index === currentStep 
                ? 'border-primary bg-primary/5' 
                : index < currentStep 
                ? 'border-green-200 bg-green-50' 
                : 'border-gray-200'
            }`}
            onClick={() => updateStep(index)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {index < currentStep ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className={`h-4 w-4 rounded-full border-2 ${
                    index === currentStep ? 'border-primary bg-primary' : 'border-gray-300'
                  }`} />
                )}
                <CardTitle className="text-sm">{step.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs">
                {step.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Dirty State Warning */}
      {isDirty && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Save your work before navigating away.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Wizard Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep].title}</CardTitle>
          <CardDescription>{STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryWizard
            entry={entry}
            currentStep={currentStep}
            onStepComplete={handleStepComplete}
            onDirtyChange={handleDirtyChange}
          />
        </CardContent>
      </Card>
      
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => updateStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => updateStep(currentStep + 1)}
              disabled={isDirty}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate(`/admin/entry-points/${entry.id}`)}
            >
              Finish Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
