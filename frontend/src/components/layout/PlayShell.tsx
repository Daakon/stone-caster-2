import { type ReactNode, useState } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { PlayBottomNav } from './PlayBottomNav';
import { PlayBottomSheet } from './PlayBottomSheet';

interface PlayShellProps {
  children: ReactNode;
}

export function PlayShell({ children }: PlayShellProps) {
  const [activeTab, setActiveTab] = useState<string>('story');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const handleTabSelect = (tab: string) => {
    if (tab === 'story') {
      setActiveTab('story');
      setIsBottomSheetOpen(false);
    } else {
      setActiveTab(tab);
      setIsBottomSheetOpen(true);
    }
  };

  const handleCloseBottomSheet = () => {
    setIsBottomSheetOpen(false);
    setActiveTab('story');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <GlobalHeader variant="compact" />
      <main id="main-content" className="flex-1 pb-16">
        {children}
      </main>
      <PlayBottomNav 
        activeTab={activeTab}
        onTabSelect={handleTabSelect}
      />
      <PlayBottomSheet
        isOpen={isBottomSheetOpen}
        activeTab={activeTab}
        onClose={handleCloseBottomSheet}
      />
    </div>
  );
}
