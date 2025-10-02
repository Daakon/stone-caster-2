import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { StoneCost } from '../components/gameplay/StoneCost';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { TurnInput } from '../components/gameplay/TurnInput';
import { HistoryFeed } from '../components/gameplay/HistoryFeed';
import { mockDataService } from '../services/mockData';
import type { Adventure, World, Character } from '../services/mockData';
import { Gem, ArrowLeft, Settings, Save } from 'lucide-react';

interface GameState {
  worldRules: Record<string, number>;
  history: Array<{
    id: string;
    timestamp: string;
    type: 'player' | 'npc' | 'system';
    content: string;
    character?: string;
  }>;
  currentTurn: number;
}

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    worldRules: {},
    history: [],
    currentTurn: 0
  });
  const [wallet, setWallet] = useState(mockDataService.getWallet());
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);

  useEffect(() => {
    if (!isInvited) {
      navigate('/');
      return;
    }

    // Load game data
    if (gameId) {
      const gameData = mockDataService.getGameState(gameId);
      setGameState(gameData);

      // For demo purposes, we'll use the first adventure and character
      const adventures = mockDataService.getAdventures();
      const characters = mockDataService.getCharacters();
      
      if (adventures.length > 0 && characters.length > 0) {
        const selectedAdventure = adventures[0];
        const selectedCharacter = characters[0];
        
        setAdventure(selectedAdventure);
        setCharacter(selectedCharacter);
        
        const worldData = mockDataService.getWorldById(selectedAdventure.worldId);
        setWorld(worldData || null);

        // Initialize world rules if not set
        if (worldData && Object.keys(gameData.worldRules).length === 0) {
          const initialRules: Record<string, number> = {};
          worldData.rules.forEach(rule => {
            initialRules[rule.id] = rule.current;
          });
          setGameState(prev => ({
            ...prev,
            worldRules: initialRules
          }));
          mockDataService.updateGameState(gameId, { worldRules: initialRules });
        }
      }
    }
  }, [gameId, navigate, isInvited]);

  const handleTurnSubmit = (action: string) => {
    if (!adventure || !character) return;

    const stoneCost = 1; // Base cost for a turn
    if (wallet.balance < stoneCost) {
      alert('Not enough casting stones!');
      return;
    }

    // Spend stones
    const success = mockDataService.spendStones(stoneCost, `Turn ${gameState.currentTurn + 1}: ${action}`);
    if (!success) {
      alert('Failed to spend stones!');
      return;
    }

    // Update wallet
    setWallet(mockDataService.getWallet());

    // Add to history
    const newHistoryEntry = {
      id: `history-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'player' as const,
      content: action,
      character: character.name
    };

    const updatedHistory = [newHistoryEntry, ...gameState.history];
    setGameState(prev => ({
      ...prev,
      history: updatedHistory,
      currentTurn: prev.currentTurn + 1
    }));

    // Update game state in mock service
    mockDataService.updateGameState(gameId!, {
      history: updatedHistory,
      currentTurn: gameState.currentTurn + 1
    });

    // Simulate NPC response after a delay
    setTimeout(() => {
      const npcResponses = [
        "The world around you shifts in response to your action.",
        "You sense that your choice has consequences beyond what you can see.",
        "The environment reacts to your decision in unexpected ways.",
        "You feel the weight of your action ripple through the world.",
        "Something in the world has changed because of what you did."
      ];
      
      const randomResponse = npcResponses[Math.floor(Math.random() * npcResponses.length)];
      
      const npcEntry = {
        id: `history-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'npc' as const,
        content: randomResponse
      };

      const finalHistory = [npcEntry, ...updatedHistory];
      setGameState(prev => ({
        ...prev,
        history: finalHistory
      }));

      mockDataService.updateGameState(gameId!, {
        history: finalHistory
      });
    }, 2000);
  };

  const handleSaveGame = () => {
    // In a real implementation, this would save to the backend
    alert('Game saved!');
  };

  if (!isInvited) {
    return null; // Will redirect
  }

  if (!adventure || !world || !character) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Game Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/adventures')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Adventures
              </Button>
              <div>
                <h1 className="text-xl font-bold">{adventure.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Playing as {character.name} in {world.title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-primary" />
                <span className="font-medium">{wallet.balance}</span>
                <span className="text-sm text-muted-foreground">stones</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveGame}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Adventure Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <img
                    src={adventure.cover}
                    alt={adventure.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <div>{adventure.title}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {adventure.excerpt}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{adventure.difficulty}</Badge>
                  <StoneCost cost={adventure.stoneCost} />
                  <span className="text-sm text-muted-foreground">
                    Turn {gameState.currentTurn}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Turn Input */}
            <Card>
              <CardHeader>
                <CardTitle>Your Turn</CardTitle>
              </CardHeader>
              <CardContent>
                <TurnInput
                  onSubmit={handleTurnSubmit}
                  stoneCost={1}
                  disabled={wallet.balance < 1}
                  placeholder="Describe your action..."
                />
              </CardContent>
            </Card>

            {/* Game History */}
            <HistoryFeed
              history={gameState.history}
              className="h-96"
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* World Rules */}
            {world.rules.length > 0 && (
              <WorldRuleMeters
                rules={world.rules.map(rule => ({
                  ...rule,
                  current: gameState.worldRules[rule.id] || rule.current
                }))}
              />
            )}

            {/* Character Info */}
            <Card>
              <CardHeader>
                <CardTitle>Character</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={`/images/avatars/${character.avatar}.jpg`}
                      alt={character.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div>
                      <div className="font-medium">{character.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {world.title}
                      </div>
                    </div>
                  </div>
                  {character.backstory && (
                    <p className="text-sm text-muted-foreground">
                      {character.backstory}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* World Info */}
            <Card>
              <CardHeader>
                <CardTitle>World</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium">{world.title}</h4>
                    <p className="text-sm text-muted-foreground">{world.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {world.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
