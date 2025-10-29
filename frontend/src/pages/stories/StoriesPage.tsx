import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { Story, World } from '../types/domain';
import { useStoriesQuery, useWorldsQuery } from '../lib/queries';
import { guardStoryKind } from '../lib/story-kind';
import { AdventureCard } from '../components/cards/AdventureCard';
import { AdventureModal } from '../components/overlays/AdventureModal';
import { CardGrid } from '../components/cards/CardGrid';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Search, Filter, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function StoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filters from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedWorld, setSelectedWorld] = useState(searchParams.get('world') || 'all');
  const [selectedKind, setSelectedKind] = useState(searchParams.get('kind') || 'all');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags') ? searchParams.get('tags')!.split(',') : []
  );
  
  // Use React Query hooks
  const { data: storiesData, isLoading: storiesLoading } = useStoriesQuery({
    q: searchQuery || undefined,
    world: selectedWorld !== 'all' ? selectedWorld : undefined,
    kind: selectedKind !== 'all' ? guardStoryKind(selectedKind) : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });
  
  const { data: worldsData, isLoading: worldsLoading } = useWorldsQuery();
  
  const stories = storiesData?.data || [];
  const worlds = worldsData?.data || [];
  
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDrifter, setShowDrifter] = useState(false);

  useEffect(() => {
    // Show drifter bubble after a delay
    const timer = setTimeout(() => {
      setShowDrifter(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Stories are already filtered by the API query parameters
  const filteredStories = stories;

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedWorld !== 'all') params.set('world', selectedWorld);
    if (selectedKind !== 'all') params.set('kind', selectedKind);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedWorld, selectedKind, selectedTags, setSearchParams]);


  const handleStartStory = (storyId: string) => {
    navigate(`/stories/${storyId}/characters`);
  };

  const handleViewDetails = (storyId: string) => {
    navigate(`/stories/${storyId}`);
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
    setSelectedWorld('all');
    setSelectedKind('all');
    setSelectedTags([]);
  };

  // Get all unique tags
  const allTags = Array.from(new Set(stories.flatMap(story => story.tags)));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Stories</h1>
          <p className="text-muted-foreground">
            Discover and embark on epic journeys across different worlds. Each story offers unique challenges and rewards.
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
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">World</label>
                <Select value={selectedWorld} onValueChange={setSelectedWorld}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Worlds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Worlds</SelectItem>
                    {worlds.map(world => (
                      <SelectItem key={world.id} value={world.id}>
                        {world.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Kind</label>
                <Select value={selectedKind} onValueChange={setSelectedKind}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Kinds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Kinds</SelectItem>
                    <SelectItem value="adventure">Adventure</SelectItem>
                    <SelectItem value="scenario">Scenario</SelectItem>
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
            {filteredStories.length} story{filteredStories.length !== 1 ? 'ies' : ''} found
          </p>
        </div>

        {/* Stories Grid */}
        {filteredStories.length > 0 ? (
          <CardGrid columns={3}>
            {filteredStories.map(story => {
              const world = worlds.find(w => w.id === story.world_id);
              return (
                <AdventureCard
                  key={story.id}
                  adventure={story}
                  world={world}
                  onStart={handleStartStory}
                  onViewDetails={handleViewDetails}
                  isInvited={true}
                />
              );
            })}
          </CardGrid>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No stories found matching your criteria.
              </p>
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Story Modal */}
        <AdventureModal
          adventure={selectedStory}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onStart={handleStartStory}
          onViewDetails={handleViewDetails}
          onLearnAboutWorld={handleLearnAboutWorld}
          isInvited={true}
        />

        {/* Drifter Bubble */}
        {showDrifter && (
          <DrifterBubble
            message="Only chosen travelers may cast stones here during this stage. But the adventures await those with the proper invitation."
            position="bottom-right"
            onDismiss={() => setShowDrifter(false)}
          />
        )}
      </div>
    </div>
  );
}
