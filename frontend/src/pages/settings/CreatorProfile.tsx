/**
 * Creator Profile Settings Page
 * Edit creator profile fields
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileService } from '@/services/profile';
import { chimeraProfileService } from '@/services/chimera.profile';
import { useAuthStore } from '@/store/auth';
import type { ProfileDTO } from '@shared/types/dto';

interface CreatorProfileFormData {
  creatorSlug: string | null;
  publicBio: string | null;
  profileImageUrl: string | null;
  websiteUrl: string | null;
}

export default function CreatorProfileSettings() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreatorProfileFormData>({
    creatorSlug: null,
    publicBio: null,
    profileImageUrl: null,
    websiteUrl: null,
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const result = await ProfileService.getProfile();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch profile');
      }
      return result.data;
    },
    enabled: !!user && user.state === 'authenticated',
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        creatorSlug: profile.creatorSlug || null,
        publicBio: profile.publicBio || null,
        profileImageUrl: profile.profileImageUrl || null,
        websiteUrl: profile.websiteUrl || null,
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: CreatorProfileFormData) => {
      return await chimeraProfileService.updateCreatorProfile({
        creator_slug: data.creatorSlug,
        public_bio: data.publicBio,
        profile_image_url: data.profileImageUrl,
        website_url: data.websiteUrl,
      });
    },
    onSuccess: () => {
      toast.success('Creator profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      console.error('Error updating creator profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update creator profile');
    },
  });

  const handleChange = (field: keyof CreatorProfileFormData, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate creator slug format if provided
    if (formData.creatorSlug && !/^[a-z0-9-]+$/.test(formData.creatorSlug)) {
      toast.error('Creator slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Creator Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your creator profile information
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Creator Information</CardTitle>
            <CardDescription>
              Configure your public creator profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="creator_slug">Creator Slug</Label>
              <Input
                id="creator_slug"
                value={formData.creatorSlug || ''}
                onChange={(e) => handleChange('creatorSlug', e.target.value || null)}
                placeholder="your-creator-slug"
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for your creator profile URL (e.g., /creators/your-creator-slug). 
                Only lowercase letters, numbers, and hyphens allowed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="public_bio">Public Bio</Label>
              <Textarea
                id="public_bio"
                value={formData.publicBio || ''}
                onChange={(e) => handleChange('publicBio', e.target.value || null)}
                placeholder="Tell the world about yourself..."
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.publicBio?.length || 0} / 2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile_image_url">Profile Image URL</Label>
              <Input
                id="profile_image_url"
                type="url"
                value={formData.profileImageUrl || ''}
                onChange={(e) => handleChange('profileImageUrl', e.target.value || null)}
                placeholder="https://example.com/your-image.jpg"
              />
              <p className="text-xs text-muted-foreground">
                URL to your creator profile image
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.websiteUrl || ''}
                onChange={(e) => handleChange('websiteUrl', e.target.value || null)}
                placeholder="https://yourwebsite.com"
              />
              <p className="text-xs text-muted-foreground">
                Your personal or creator website URL
              </p>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

