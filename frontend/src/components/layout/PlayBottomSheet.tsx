import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, User, Heart, Users, Scroll, Wallet, HelpCircle } from 'lucide-react';
import { mockDataService } from '@/services/mockData';

interface PlayBottomSheetProps {
  isOpen: boolean;
  activeTab: string;
  onClose: () => void;
}

const tabConfig = {
  character: {
    title: 'Character',
    icon: User,
    content: <CharacterContent />
  },
  relationships: {
    title: 'Relationships',
    icon: Heart,
    content: <RelationshipsContent />
  },
  factions: {
    title: 'Factions',
    icon: Users,
    content: <FactionsContent />
  },
  'world-rules': {
    title: 'World Rules',
    icon: Scroll,
    content: <WorldRulesContent />
  },
  wallet: {
    title: 'Wallet',
    icon: Wallet,
    content: <WalletContent />
  },
  help: {
    title: 'Help',
    icon: HelpCircle,
    content: <HelpContent />
  }
};

function CharacterContent() {
  const characters = mockDataService.getCharacters();
  const character = characters[0]; // Demo character

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src={`/images/avatars/${character.avatar}.jpg`}
              alt={character.name}
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <div className="font-medium">{character.name}</div>
              <div className="text-sm text-muted-foreground">Level 1</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {character.backstory}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Health</span>
              <span>100/100</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Mana</span>
              <span>50/50</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RelationshipsContent() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>NPC Relationships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Guard Captain</span>
              <Badge variant="secondary">Neutral</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tavern Keeper</span>
              <Badge variant="default">Friendly</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Mysterious Stranger</span>
              <Badge variant="destructive">Hostile</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FactionsContent() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Faction Standing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Royal Guard</span>
              <Badge variant="default">+25</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Thieves Guild</span>
              <Badge variant="destructive">-10</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Merchant Guild</span>
              <Badge variant="secondary">+5</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorldRulesContent() {
  const worlds = mockDataService.getWorlds();
  const world = worlds[0]; // Demo world

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Active World Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {world.rules.slice(0, 3).map((rule) => (
              <div key={rule.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{rule.name}</span>
                  <span>{rule.current}/{rule.max}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${(rule.current / rule.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WalletContent() {
  const wallet = mockDataService.getWallet();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stone Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">
              {wallet.balance}
            </div>
            <div className="text-sm text-muted-foreground">Casting Stones</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {wallet.history.slice(0, 3).map((tx) => (
              <div key={tx.id} className="flex justify-between text-sm">
                <span className="truncate">{tx.reason}</span>
                <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HelpContent() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Game Help</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>How to Play:</strong>
              <p className="text-muted-foreground mt-1">
                Describe your actions in the turn input. Each action costs casting stones.
              </p>
            </div>
            <div>
              <strong>World Rules:</strong>
              <p className="text-muted-foreground mt-1">
                Each world has unique mechanics that affect gameplay and story outcomes.
              </p>
            </div>
            <div>
              <strong>Relationships:</strong>
              <p className="text-muted-foreground mt-1">
                Your choices affect how NPCs and factions view your character.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PlayBottomSheet({ isOpen, activeTab, onClose }: PlayBottomSheetProps) {
  const config = tabConfig[activeTab as keyof typeof tabConfig];
  
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {config.title}
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="px-6 py-4 overflow-y-auto">
          {config.content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
