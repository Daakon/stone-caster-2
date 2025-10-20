/**
 * Player Scenario Picker
 * Phase 6: Player-Facing Scenario Picker (Sandbox Launch Flow)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Play, Globe, Users, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface Scenario {
  id: string;
  version: string;
  world_ref: string;
  display_name: string;
  synopsis: string;
  tags: string[];
  npcs_preview: string[];
}

interface ScenarioPickerProps {
  className?: string;
}

export function ScenarioPicker({ className }: ScenarioPickerProps) {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [filteredScenarios, setFilteredScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorld, setSelectedWorld] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  // Available filters
  const [worlds, setWorlds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Load scenarios on mount
  useEffect(() => {
    loadScenarios();
  }, []);

  // Apply filters when scenarios or filter values change
  useEffect(() => {
    applyFilters();
  }, [scenarios, searchQuery, selectedWorld, selectedTag]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/player/scenarios?limit=50');
      
      if (!response.ok) {
        throw new Error('Failed to load scenarios');
      }
      
      const data = await response.json();
      setScenarios(data);
      
      // Extract unique worlds and tags for filters
      const uniqueWorlds = [...new Set(data.map((s: Scenario) => s.world_ref))] as string[];
      const uniqueTags = [...new Set(data.flatMap((s: Scenario) => s.tags))] as string[];
      
      setWorlds(uniqueWorlds);
      setTags(uniqueTags);
    } catch (error) {
      console.error('Error loading scenarios:', error);
      toast.error('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...scenarios];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(scenario =>
        scenario.display_name.toLowerCase().includes(query) ||
        scenario.synopsis.toLowerCase().includes(query) ||
        scenario.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // World filter
    if (selectedWorld !== 'all') {
      filtered = filtered.filter(scenario => scenario.world_ref === selectedWorld);
    }

    // Tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(scenario => scenario.tags.includes(selectedTag));
    }

    setFilteredScenarios(filtered);
  };

  const startScenario = async (scenario: Scenario) => {
    try {
      setStarting(scenario.id);
      
      const response = await fetch('/api/player/games/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario_ref: `${scenario.id}@${scenario.version}`,
          ruleset_ref: 'ruleset.core.default@1.0.0',
          locale: 'en-US'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start scenario');
      }

      const result = await response.json();
      toast.success(`Starting ${scenario.display_name}...`);
      
      // Navigate to the game
      navigate(`/game/${result.game_id}`);
    } catch (error) {
      console.error('Error starting scenario:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start scenario');
    } finally {
      setStarting(null);
    }
  };

  const getWorldDisplayName = (worldRef: string) => {
    // Extract world name from reference (e.g., "world.mystika@1.0.0" -> "Mystika")
    const match = worldRef.match(/world\.([^@]+)@/);
    return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : worldRef;
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Choose Your Adventure</h1>
        <p className="text-muted-foreground">
          Select a scenario to begin your journey. Each scenario offers a unique starting point and story.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedWorld} onValueChange={setSelectedWorld}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Worlds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Worlds</SelectItem>
            {worlds.map(world => (
              <SelectItem key={world} value={world}>
                {getWorldDisplayName(world)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag} value={tag}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {filteredScenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scenarios found</h3>
            <p className="text-muted-foreground text-center">
              Try adjusting your filters or check back later for new scenarios.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <Card key={`${scenario.id}@${scenario.version}`} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{scenario.display_name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      {getWorldDisplayName(scenario.world_ref)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {scenario.synopsis}
                </p>
                
                {/* Tags */}
                {scenario.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {scenario.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {scenario.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{scenario.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
                
                {/* NPCs Preview */}
                {scenario.npcs_preview.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Meet: {scenario.npcs_preview.slice(0, 2).join(', ')}</span>
                    {scenario.npcs_preview.length > 2 && (
                      <span>and {scenario.npcs_preview.length - 2} others</span>
                    )}
                  </div>
                )}
                
                <Button
                  onClick={() => startScenario(scenario)}
                  disabled={starting === scenario.id}
                  className="w-full"
                >
                  {starting === scenario.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Adventure
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScenarioPicker;
