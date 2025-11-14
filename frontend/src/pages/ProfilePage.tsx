import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ErrorBanner } from '../components/ui/error-banner';
import { GatedRoute } from '../components/auth/GatedRoute';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
// import { useToast } from '../hooks/use-toast';
import { ProfileService } from '../services/profile';
import { useAuthStore } from '../store/auth';
import { usePlayerAccount } from '../hooks/usePlayerAccount';
import { makeTitle } from '../lib/meta';
import { 
  User, 
  Settings, 
  Edit,
  Save,
  X,
  Shield,
  LogOut,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import type { ProfileDTO } from '@shared/types/dto';
import { UpdateProfileRequestSchema } from '@shared/types/dto';
import { ApiErrorCode } from '@shared/types/api';
import { ZodError } from 'zod';

interface ProfileFormData {
  displayName: string;
  avatarUrl: string;
  preferences: {
    showTips: boolean;
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
}

function ProfilePageContent() {
  const queryClient = useQueryClient();
  // const { toast } = useToast();
  const { user } = useAuthStore();
  const { profile: playerProfile, loading: profileLoading, refreshProfile } = usePlayerAccount(); // Use new usePlayerAccount hook
  
  // Set document title
  useEffect(() => {
    document.title = makeTitle(['Profile', 'Stone Caster']);
  }, []);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    avatarUrl: '',
    preferences: {
      showTips: true,
      theme: 'auto',
      notifications: {
        email: true,
        push: false,
      },
    },
  });
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  // const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  // Load profile data
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!user || user.state === 'guest') {
        throw new Error('User not authenticated');
      }
      // Use PlayerAccountService to fetch profile
      return playerProfile;
    },
    enabled: !!user && user.state !== 'guest' && !profileLoading, // Enable when user is available and not loading player profile
    initialData: playerProfile, // Use playerProfile from hook as initial data
  });

  // Fetch CSRF token
  const { data: fetchedCsrfToken } = useQuery({
    queryKey: ['csrf-token'],
    queryFn: ProfileService.generateCSRFToken,
    enabled: user?.state === 'authenticated',
    staleTime: 5 * 60 * 1000, // CSRF tokens are valid for 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (fetchedCsrfToken?.ok && fetchedCsrfToken.data) {
      setCsrfToken(fetchedCsrfToken.data.csrfToken);
    }
  }, [fetchedCsrfToken]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: ({ updateData, csrfToken }: { updateData: Partial<ProfileDTO>; csrfToken: string | null }) => 
      ProfileService.updateProfile(updateData, csrfToken || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['csrf-token'] }); // Invalidate CSRF token after use
      void refreshProfile();
      setIsEditing(false);
      setValidationErrors({});
      // toast({
      //   title: 'Profile updated',
      //   description: 'Your profile has been successfully updated.',
      // });
    },
    onError: (error: any) => {
      console.error('Profile update failed:', error);
      if (error.code === ApiErrorCode.VALIDATION_FAILED && error.details) {
        setValidationErrors(error.details);
      } else {
        // toast({
        //   title: 'Update failed',
        //   description: error.message || 'Failed to update profile.',
        //   variant: 'destructive',
        // });
      }
    },
  });

  // Revoke sessions mutation
  const revokeSessionsMutation = useMutation({
    mutationFn: (csrfToken: string) => ProfileService.revokeOtherSessions(csrfToken),
    onSuccess: () => {
      // toast({
      //   title: 'Sessions revoked',
      //   description: `${data.revokedCount} other sessions have been revoked.`,
      // });
    },
    onError: (error: any) => {
      console.error('Session revocation failed:', error);
      // toast({
      //   title: 'Revocation failed',
      //   description: error.message || 'Failed to revoke sessions.',
      //   variant: 'destructive',
      // });
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || '',
        preferences: profile.preferences as ProfileFormData['preferences'],
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setValidationErrors((prev) => ({ ...prev, [id]: '' })); // Clear error on change
  };

  const handlePreferenceChange = (key: keyof ProfileFormData['preferences'], value: any) => {
    setFormData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      },
    }));
  };

  const handleNestedPreferenceChange = (
    parentKey: keyof ProfileFormData['preferences'],
    childKey: string,
    value: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [parentKey]: {
          ...(prev.preferences[parentKey] as Record<string, any>),
          [childKey]: value,
        },
      },
    }));
  };

  const validateForm = () => {
    try {
      UpdateProfileRequestSchema.parse({
        displayName: formData.displayName,
        avatarUrl: formData.avatarUrl,
        preferences: formData.preferences,
      });
      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path.length > 0) {
            const pathKey = String(err.path[0]);
            newErrors[pathKey] = err.message;
          }
        });
        setValidationErrors(newErrors);
      }
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    if (user?.state !== 'authenticated') {
      // This case should ideally be prevented by GatedRoute, but as a fallback
      // toast({
      //   title: 'Authentication Required',
      //   description: 'Please sign in to update your profile.',
      //   variant: 'destructive',
      // });
      return;
    }
    updateProfileMutation.mutate({ updateData: formData, csrfToken });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setValidationErrors({});
    if (profile) {
      setFormData({
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || '',
        preferences: profile.preferences as ProfileFormData['preferences'],
      });
    }
  };

  const handleRevokeSessions = () => {
    if (user?.state === 'authenticated' && csrfToken) {
      revokeSessionsMutation.mutate(csrfToken);
    }
  };

  if (isLoadingProfile || profileLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex justify-center items-center h-screen">
        <ErrorBanner 
          error={{ 
            code: ApiErrorCode.INTERNAL_ERROR, 
            message: profileError.message || 'Failed to load profile.' 
          }} 
        />
      </div>
    );
  }

  if (!profile && user?.state === 'authenticated') {
    return (
      <div className="flex justify-center items-center h-screen">
        <ErrorBanner 
          error={{ 
            code: ApiErrorCode.NOT_FOUND, 
            message: 'Profile not found. This should not happen for authenticated users.' 
          }} 
        />
      </div>
    );
  }

  const isAuth = user?.state === 'authenticated';

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" /> Profile
          </CardTitle>
          {isAuth && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={updateProfileMutation.isPending} className="flex items-center gap-1">
                    <Save className="h-4 w-4" /> {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="flex items-center gap-1">
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} className="flex items-center gap-1">
                  <Edit className="h-4 w-4" /> Edit Profile
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {!isAuth && (
            <Alert variant="default" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You are currently a guest. <a href="/auth" className="underline">Sign in or sign up</a> to save your progress and manage your profile.
              </AlertDescription>
            </Alert>
          )}

          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-2 border-primary">
                <AvatarImage src={showAvatarPreview ? formData.avatarUrl : profile?.avatarUrl} alt={profile?.displayName || 'User Avatar'} />
                <AvatarFallback className="text-4xl sm:text-5xl font-semibold">
                  {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="absolute bottom-0 right-0 rounded-full w-8 h-8"
                  onClick={() => setShowAvatarPreview(prev => !prev)}
                  aria-label={showAvatarPreview ? "Hide avatar preview" : "Show avatar preview"}
                >
                  {showAvatarPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-3xl font-bold">{profile?.displayName || 'Guest User'}</h2>
              {isAuth && <p className="text-muted-foreground">{profile?.email}</p>}
              <Badge variant="secondary" className="mt-2">
                {isAuth ? 'Authenticated' : 'Guest'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Profile Details Form */}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="displayName" className="sm:text-right">Display Name</Label>
              <div className="col-span-3">
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={validationErrors.displayName ? 'border-destructive' : ''}
                  aria-invalid={!!validationErrors.displayName}
                  aria-describedby="displayName-error"
                />
                {validationErrors.displayName && (
                  <p id="displayName-error" className="text-destructive text-sm mt-1">
                    {validationErrors.displayName}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="avatarUrl" className="sm:text-right">Avatar URL</Label>
              <div className="col-span-3">
                <Input
                  id="avatarUrl"
                  value={formData.avatarUrl}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={validationErrors.avatarUrl ? 'border-destructive' : ''}
                  aria-invalid={!!validationErrors.avatarUrl}
                  aria-describedby="avatarUrl-error"
                />
                {validationErrors.avatarUrl && (
                  <p id="avatarUrl-error" className="text-destructive text-sm mt-1">
                    {validationErrors.avatarUrl}
                  </p>
                )}
              </div>
            </div>
            {isAuth && (
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="email" className="sm:text-right">Email</Label>
                <Input id="email" value={profile?.email || ''} disabled className="col-span-3" />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="memberSince" className="sm:text-right">Member Since</Label>
              <Input 
                id="memberSince" 
                value={profile?.lastSeenAt ? new Date(profile.lastSeenAt).toLocaleDateString() : 'N/A'} 
                disabled 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="lastSeen" className="sm:text-right">Last Seen</Label>
              <Input 
                id="lastSeen" 
                value={profile?.lastSeenAt ? new Date(profile.lastSeenAt).toLocaleString() : 'N/A'} 
                disabled 
                className="col-span-3" 
              />
            </div>
          </div>

          <Separator />

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" /> Preferences
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="theme" className="sm:text-right">Theme</Label>
                <Select
                  value={formData.preferences.theme}
                  onValueChange={(value: 'light' | 'dark' | 'auto') => handlePreferenceChange('theme', value)}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label htmlFor="showTips" className="sm:text-right">Show Tips</Label>
                <input
                  type="checkbox"
                  id="showTips"
                  checked={formData.preferences.showTips}
                  onChange={(e) => handlePreferenceChange('showTips', e.target.checked)}
                  disabled={!isEditing}
                  className="col-span-3 h-5 w-5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label className="sm:text-right">Email Notifications</Label>
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={formData.preferences.notifications.email}
                  onChange={(e) => handleNestedPreferenceChange('notifications', 'email', e.target.checked)}
                  disabled={!isEditing}
                  className="col-span-3 h-5 w-5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                <Label className="sm:text-right">Push Notifications</Label>
                <input
                  type="checkbox"
                  id="pushNotifications"
                  checked={formData.preferences.notifications.push}
                  onChange={(e) => handleNestedPreferenceChange('notifications', 'push', e.target.checked)}
                  disabled={!isEditing}
                  className="col-span-3 h-5 w-5"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Session Management */}
          {isAuth && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" /> Session Management
              </h3>
              <p className="text-muted-foreground">
                You are currently logged in. You can revoke other active sessions to enhance security.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleRevokeSessions} 
                disabled={revokeSessionsMutation.isPending || !csrfToken}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" /> 
                {revokeSessionsMutation.isPending ? 'Revoking...' : 'Revoke Other Sessions'}
              </Button>
              {revokeSessionsMutation.isSuccess && (
                <Alert variant="default">
                  <AlertDescription>
                    Successfully revoked other sessions.
                  </AlertDescription>
                </Alert>
              )}
              {revokeSessionsMutation.isError && (
                <ErrorBanner 
                  error={{ 
                    code: ApiErrorCode.INTERNAL_ERROR, 
                    message: revokeSessionsMutation.error?.message || 'Failed to revoke sessions.' 
                  }} 
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <GatedRoute>
      <ProfilePageContent />
    </GatedRoute>
  );
}
