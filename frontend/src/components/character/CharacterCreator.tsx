import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import type { Character, World } from '../../services/mockData';
import { mockDataService } from '../../services/mockData';
import { createCharacter } from '../../lib/api';
import { WorldFieldRenderer } from './WorldFieldRenderer';

interface CharacterCreatorProps {
  worldId: string;
  onCharacterCreated: (character: Character) => void;
  onCancel: () => void;
}

interface CharacterFormData {
  [key: string]: any;
}

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  worldId,
  onCharacterCreated,
  onCancel
}) => {
  const [world, setWorld] = useState<World | null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CharacterFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const worldData = mockDataService.getWorldById(worldId);
    setWorld(worldData || null);

    // Load schema for this world
    import(`../../mock/schemas/${worldId}.json`)
      .then((schemaData) => {
        if (schemaData.default && schemaData.default.fields) {
          setSchema(schemaData.default);
        } else {
          setSchema(null);
        }
      })
      .catch((error) => {
        setSchema(null);
      });
  }, [worldId]);

  if (!world) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive mb-4">World not found</p>
          <Button onClick={onCancel}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive mb-4">Character creation schema not available for this world</p>
          <Button onClick={onCancel}>Go Back</Button>
        </div>
      </div>
    );
  }

  const allFields = schema.fields || [];
  const totalSteps = allFields.length;
  const currentField = allFields[currentStep];

  const validateField = (field: any, value: any): string | null => {
    if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`;
    }

    if (field.validation) {
      if (field.validation.minLength && value && value.length < field.validation.minLength) {
        return `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && value && value.length > field.validation.maxLength) {
        return `${field.label} must be no more than ${field.validation.maxLength} characters`;
      }
    }

    if (field.minSelections && Array.isArray(value) && value.length < field.minSelections) {
      return `Please select at least ${field.minSelections} options`;
    }

    if (field.maxSelections && Array.isArray(value) && value.length > field.maxSelections) {
      return `Please select no more than ${field.maxSelections} options`;
    }

    return null;
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleNext = () => {
    const error = validateField(currentField, formData[currentField.id]);
    if (error) {
      setErrors(prev => ({ ...prev, [currentField.id]: error }));
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    allFields.forEach((field: any) => {
      const error = validateField(field, formData[field.id]);
      if (error) {
        newErrors[field.id] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create character data for API using the new generic model
      const characterData = {
        name: formData.name,
        worldSlug: worldId,
        // Add all form data as world-specific data
        worldData: {} as Record<string, any>
      };

      // Add all form data to world-specific data
      Object.keys(formData).forEach((key: string) => {
        if (key !== 'name') {
          characterData.worldData[key] = formData[key];
        }
      });

      // Call the real API to create the character
      const result = await createCharacter(characterData);
      
      if (!result.ok) {
        setErrors({ submit: result.error.message || 'Failed to create character' });
        return;
      }

      // Convert API response to Character format for compatibility
      const newCharacter: Character = {
        id: result.data.id,
        worldId: worldId,
        name: result.data.name,
        avatar: formData.avatar || 'default',
        backstory: formData.backstory || '',
        worldSpecificData: characterData.worldData,
        createdAt: result.data.createdAt || new Date().toISOString()
      };

      onCharacterCreated(newCharacter);
    } catch (error) {
      setErrors({ submit: 'Failed to create character. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            Create Character for {world.title}
          </CardTitle>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">{currentField.label}</h3>
              {currentField.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {currentField.description}
                </p>
              )}
            </div>

            <WorldFieldRenderer
              field={currentField}
              value={formData[currentField.id]}
              onChange={(value) => handleFieldChange(currentField.id, value)}
              error={errors[currentField.id]}
            />
          </div>

          {/* Submit error display */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={currentStep === 0 ? onCancel : handlePrevious}
              disabled={isSubmitting}
            >
              {currentStep === 0 ? 'Cancel' : 'Previous'}
            </Button>
            <Button onClick={handleNext} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : (currentStep === totalSteps - 1 ? 'Create Character' : 'Next')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
