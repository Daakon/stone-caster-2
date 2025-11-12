import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, User } from 'lucide-react';
import type { Character } from '@/types/domain';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: { name: string; portrait_seed?: string }) => Promise<void>;
  isLoading?: boolean;
}

export default function CharacterModal({ isOpen, onClose, onSave, isLoading = false }: CharacterModalProps) {
  const [name, setName] = useState('');
  const [portraitSeed, setPortraitSeed] = useState('');
  const [errors, setErrors] = useState<{ name?: string; portrait_seed?: string }>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setPortraitSeed('');
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: { name?: string; portrait_seed?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Character name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Character name must be at least 2 characters';
    } else if (name.trim().length > 50) {
      newErrors.name = 'Character name must be less than 50 characters';
    }

    if (portraitSeed.trim() && portraitSeed.trim().length > 100) {
      newErrors.portrait_seed = 'Portrait seed must be 100 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        portrait_seed: portraitSeed.trim() || undefined,
      });
      
      // Reset form on success
      setName('');
      setPortraitSeed('');
      setErrors({});
    } catch (error) {

    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Create New Character
          </DialogTitle>
          <DialogDescription>
            Create a new character to play in this story. You can always edit their details later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          <div className="space-y-2">
            <Label htmlFor="character-name">Character Name *</Label>
            <Input
              id="character-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              className={errors.name ? 'border-destructive' : ''}
              disabled={isLoading}
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="portrait-seed">Portrait Seed (Optional)</Label>
            <Textarea
              id="portrait-seed"
              value={portraitSeed}
              onChange={(e) => {
                setPortraitSeed(e.target.value);
                if (errors.portrait_seed) {
                  setErrors(prev => ({ ...prev, portrait_seed: undefined }));
                }
              }}
              placeholder="Describe your character's appearance for AI-generated portrait"
              className="resize-none"
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Describe your character's appearance to generate a unique portrait
            </p>
            {errors.portrait_seed && (
              <p className="text-destructive text-sm">{errors.portrait_seed}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Character'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
