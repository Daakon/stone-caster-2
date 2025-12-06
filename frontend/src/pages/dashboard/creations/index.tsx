/**
 * My Creations Dashboard
 * Lists user's created worlds, entities, stories, lore, and packs
 * 
 * Optimized for lazy loading: Only the active tab fetches data
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { makeTitle } from '@/lib/meta';
import { WorldsTab } from './WorldsTab';
import { EntitiesTab } from './EntitiesTab';
import { StoriesTab } from './StoriesTab';
import { LoreTab } from './LoreTab';
import { PacksTab } from './PacksTab';

const VALID_TABS = ['worlds', 'entities', 'stories', 'lore', 'packs'] as const;
type TabValue = typeof VALID_TABS[number];

export default function MyCreationsDashboard() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  
  // Validate tab from route parameter
  const validTab = (tab && VALID_TABS.includes(tab as TabValue)) ? (tab as TabValue) : null;
  
  // Redirect to default tab if invalid
  if (!validTab) {
    return <Navigate to="/dashboard/creations/worlds" replace />;
  }
  
  const [activeTab, setActiveTab] = useState<TabValue>(validTab);

  // Sync activeTab with route parameter when it changes (e.g., browser back/forward)
  useEffect(() => {
    if (validTab && validTab !== activeTab) {
      setActiveTab(validTab);
    }
  }, [validTab, activeTab]);

  // Set page title
  useEffect(() => {
    document.title = makeTitle(['My Creations', 'Dashboard', 'Stone Caster']);
  }, []);

  // Handle tab changes - navigate to new route when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    if (VALID_TABS.includes(newTab)) {
      navigate(`/dashboard/creations/${newTab}`, { replace: false });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Creations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your created worlds and entities
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="worlds">Worlds</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="lore">Lore</TabsTrigger>
          <TabsTrigger value="packs">Content Packs</TabsTrigger>
        </TabsList>

        {/* Conditional rendering: Only mount the active tab component */}
        {/* This ensures data fetching only happens for the visible tab */}
        {activeTab === 'worlds' && (
          <TabsContent value="worlds" className="space-y-4">
            <WorldsTab />
          </TabsContent>
        )}

        {activeTab === 'entities' && (
          <TabsContent value="entities" className="space-y-4">
            <EntitiesTab />
          </TabsContent>
        )}

        {activeTab === 'stories' && (
          <TabsContent value="stories" className="space-y-4">
            <StoriesTab />
          </TabsContent>
        )}

        {activeTab === 'lore' && (
          <TabsContent value="lore" className="space-y-4">
            <LoreTab />
          </TabsContent>
        )}

        {activeTab === 'packs' && (
          <TabsContent value="packs" className="space-y-4">
            <PacksTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

