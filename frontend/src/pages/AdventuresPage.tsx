import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { Adventure, World } from '../services/mockData';
import { mockDataService } from '../services/mockData';
import { AdventureCard } from '../components/cards/AdventureCard';
import { AdventureModal } from '../components/overlays/AdventureModal';
import { CardGrid } from '../components/cards/CardGrid';
import { DrifterBubble } from '../components/guidance/DrifterBubble';
import { Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdventuresPage() {
  const navigate = useNavigate();
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [filteredAdventures, setFilteredAdventures] = useState<Adventure[]>([]);
  const [selectedAdventure] = useState<Adventure | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDrifter, setShowDrifter] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorld, setSelectedWorld] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);

  useEffect(() => {
    const adventuresData = mockDataService.getAdventures();
    const worldsData = mockDataService.getWorlds();
    setAdventures(adventuresData);
    setWorlds(worldsData);
    setFilteredAdventures(adventuresData);

    // Show drifter bubble after a delay
    const timer = setTimeout(() => {
      setShowDrifter(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let filtered = adventures;

    // Search filter
    if (searchQuery) {
      filtered = mockDataService.searchAdventures(searchQuery);
    }

    // World filter
    if (selectedWorld !== 'all') {
      filtered = filtered.filter(adventure => adventure.worldId === selectedWorld);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(adventure => adventure.difficulty === selectedDifficulty);
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(adventure =>
        selectedTags.every(tag => adventure.tags.includes(tag))
      );
    }

    setFilteredAdventures(filtered);
  }, [adventures, searchQuery, selectedWorld, selectedDifficulty, selectedTags]);


  const handleStartAdventure = (adventureId: string) => {
    if (isInvited) {
      navigate(`/adventures/${adventureId}/characters`);
    } else {
      alert('This journey requires an invitation at this stage.');
    }
  };

  const handleViewDetails = (adventureId: string) => {
    navigate(`/adventures/${adventureId}`);
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
    setSelectedDifficulty('all');
    setSelectedTags([]);
  };

  // Get all unique tags
  const allTags = Array.from(new Set(adventures.flatMap(adventure => adventure.tags)));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Adventures</h1>
          <p className="text-muted-foreground">
            Discover and embark on epic journeys across different worlds. Each adventure offers unique challenges and rewards.
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
                placeholder="Search adventures..."
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
                        {world.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Difficulty</label>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
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
            {filteredAdventures.length} adventure{filteredAdventures.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Adventure Grid */}
        {filteredAdventures.length > 0 ? (
          <CardGrid columns={3}>
            {filteredAdventures.map(adventure => (
              <AdventureCard
                key={adventure.id}
                adventure={adventure}
                onStart={handleStartAdventure}
                onViewDetails={handleViewDetails}
                isInvited={isInvited}
              />
            ))}
          </CardGrid>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No adventures found matching your criteria.
              </p>
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Adventure Modal */}
        <AdventureModal
          adventure={selectedAdventure}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onStart={handleStartAdventure}
          onViewDetails={handleViewDetails}
          onLearnAboutWorld={handleLearnAboutWorld}
          isInvited={isInvited}
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
