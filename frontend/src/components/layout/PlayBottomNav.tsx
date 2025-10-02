import { BookOpen, User, Heart, Users, Scroll, Wallet, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlayBottomNavProps {
  activeTab: string;
  onTabSelect: (tab: string) => void;
}

const tabs = [
  { id: 'story', label: 'Story', icon: BookOpen },
  { id: 'character', label: 'Character', icon: User },
  { id: 'relationships', label: 'Relationships', icon: Heart },
  { id: 'factions', label: 'Factions', icon: Users },
  { id: 'world-rules', label: 'World Rules', icon: Scroll },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

export function PlayBottomNav({ activeTab, onTabSelect }: PlayBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 px-1 min-w-0 flex-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => onTabSelect(tab.id)}
              aria-label={tab.label}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs truncate">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
