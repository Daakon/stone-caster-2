import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { mockDataService } from '../services/mockData';
import { 
  User, 
  Calendar, 
  Settings, 
  Crown,
  Gem,
  MapPin,
  Edit,
  Save,
  X
} from 'lucide-react';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Adventure Seeker',
    email: 'player@example.com',
    bio: 'Passionate about interactive storytelling and fantasy adventures.',
    location: 'San Francisco, CA'
  });
  
  const currentTier = mockDataService.getCurrentTier();
  const limits = mockDataService.getLimitsByTier(currentTier);
  const wallet = mockDataService.getWallet();
  const characters = mockDataService.getCharacters();
  const adventures = mockDataService.getAdventures();
  
  const handleSave = () => {
    // Save profile changes
    setIsEditing(false);
    console.log('Profile saved:', formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data
  };

  const stats = {
    totalAdventures: adventures.length,
    completedAdventures: Math.floor(adventures.length * 0.7),
    totalCharacters: characters.length,
    stonesSpent: 150,
    joinDate: '2024-01-15'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings and view your adventure statistics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="/api/placeholder/80/80" />
                    <AvatarFallback>
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="name">Display Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-semibold">{formData.name}</h3>
                        <p className="text-muted-foreground">{formData.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={currentTier === 'premium' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                            <Crown className="h-3 w-3 mr-1" />
                            {currentTier === 'premium' ? 'Premium' : 'Free'}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Joined {new Date(stats.joinDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    {isEditing ? (
                      <textarea
                        id="bio"
                        className="w-full p-2 border rounded-md resize-none"
                        rows={3}
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{formData.bio}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    {isEditing ? (
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {formData.location}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Adventure Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.totalAdventures}</div>
                    <div className="text-sm text-muted-foreground">Total Adventures</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.completedAdventures}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.totalCharacters}</div>
                    <div className="text-sm text-muted-foreground">Characters</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.stonesSpent}</div>
                    <div className="text-sm text-muted-foreground">Stones Spent</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Characters */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Characters</CardTitle>
              </CardHeader>
              <CardContent>
                {characters.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No Characters Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first character to start adventuring
                    </p>
                    <Button>Create Character</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {characters.slice(0, 3).map((character: any) => (
                      <div key={character.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-medium">{character.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {character.class || 'Adventurer'} • Created {new Date(character.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </div>
                    ))}
                    {characters.length > 3 && (
                      <Button variant="outline" className="w-full">
                        View All Characters
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge className={currentTier === 'premium' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                    {currentTier === 'premium' ? 'Premium' : 'Free'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Characters</span>
                  <span className="text-sm font-medium">{characters.length}/{limits.maxCharacters}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Adventures</span>
                  <span className="text-sm font-medium">0/{limits.maxGames}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stones</span>
                  <div className="flex items-center gap-1">
                    <Gem className="h-3 w-3 text-primary" />
                    <span className="text-sm font-medium">{wallet.balance}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Gem className="h-4 w-4 mr-2" />
                  Buy Stones
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
