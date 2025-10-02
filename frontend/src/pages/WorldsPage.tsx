import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { World } from '../services/mockData';
import { mockDataService } from '../services/mockData';
import { WorldCard } from '../components/cards/WorldCard';
import { CardGrid } from '../components/cards/CardGrid';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Search, Filter, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function WorldsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [filteredWorlds, setFilteredWorlds] = useState<World[]>([]);
  const [showDrifter, setShowDrifter] = useState(false);
  
  // Filters from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || 'all');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags') ? searchParams.get('tags')!.split(',') : []
  );

  useEffect(() => {
    const worldsData = mockDataService.getWorlds();
    setWorlds(worldsData);
    setFilteredWorlds(worldsData);

    // Show drifter bubble after a delay
    const timer = setTimeout(() => {
      setShowDrifter(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let filtered = worlds;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(world =>
        world.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        world.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        world.tagline.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(world => world.tags.includes(selectedTag));
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(world =>
        selectedTags.every(tag => world.tags.includes(tag))
      );
    }

    setFilteredWorlds(filtered);
  }, [worlds, searchQuery, selectedTag, selectedTags]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedTag !== 'all') params.set('tag', selectedTag);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedTag, selectedTags, setSearchParams]);

  const handleViewWorld = (worldId: string) => {
    navigate(`/worlds/${worldId}`);
  };

  const handleLearnAboutWorld = (worldId: string) => {
    navigate(`/worlds/${worldId}`);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag('all');
    setSelectedTags([]);
  };

  // Get all unique tags
  const allTags = Array.from(new Set(worlds.flatMap(world => world.tags)));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Worlds</h1>
          <p className="text-muted-foreground">
            Discover and explore different worlds. Each world has its own rules, factions, and unique mechanics.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search worlds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Primary Tag</label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            {filteredWorlds.length} world{filteredWorlds.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Worlds Grid */}
        {filteredWorlds.length > 0 ? (
          <CardGrid columns={3}>
            {filteredWorlds.map(world => (
              <WorldCard
                key={world.id}
                world={world}
                onViewDetails={handleViewWorld}
                onLearnMore={handleLearnAboutWorld}
              />
            ))}
          </CardGrid>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No worlds found matching your criteria.
              </p>
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Drifter Bubble */}
        {showDrifter && (
          <DrifterBubble
            message="Each world holds its own mysteries and rules. Choose wisely, for your path will be shaped by the world you enter."
            position="bottom-right"
            onDismiss={() => setShowDrifter(false)}
          />
        )}
      </div>
    </div>
  );
}
