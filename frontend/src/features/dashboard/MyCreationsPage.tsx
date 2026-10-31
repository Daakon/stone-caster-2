/**
 * My Creations Page
 * Landing page for creators - entry point to Story Creation Wizard and Asset Management
 */

import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Globe, Users } from "lucide-react";
import { useStoryDraftStore } from "@/features/casting-circle/stores/useStoryDraftStore";
import { makeTitle } from "@/lib/meta";
import { useEntitlements } from "@/features/entitlements/hooks";
import { EntitlementPanel } from "@/features/entitlements/components/EntitlementPanel";

// Services & Hooks
import {
  useMyStories,
  useMyWorlds,
  useMyEntities,
  useDeleteEntity,
  useDeleteStory,
} from "@/services/chimera-api";

// Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResourceGrid } from "@/components/common/ResourceGrid";
import { SectionHeader } from "@/components/common/SectionHeader";

// Cards
import { StoryCard } from "./components/cards/StoryCard";
import { WorldCard } from "./components/cards/WorldCard";
import { EntityCard } from "./components/cards/EntityCard";

// Modals
import { WorldEditorModal } from "./components/editors/WorldEditorModal";
import { EntityEditorModal } from "./components/editors/EntityEditorModal";

export function MyCreationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
  const account = useEntitlements();
  const entitlement =
    !account.isError && account.data?.state === "ready" ? account.data : null;
  const canCreate =
    !!entitlement &&
    entitlement.usage.owned_stories < entitlement.limits.max_owned_stories;

  // Derive active tab from URL or default to 'stories'
  const activeTab = searchParams.get("tab") || "stories";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  // Local state for modals
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [entityEditorOpen, setEntityEditorOpen] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Update page title
  React.useEffect(() => {
    document.title = makeTitle(["My Creations"]);
  }, []);

  // Data Fetching - Conditionally enabled
  // Stories are default, so we might fetch them always or just when active.
  // Good UX usually prefetches or fetches on demand. Let's do on demand + keep previous data (React Query handles caching).
  const { data: stories, isLoading: loadingStories } = useMyStories();
  // Optionally disable stories if not activeTab === 'stories', but stories are heavily used.
  // User req: "Ensure that useMyWorlds is *only* called when tab === 'worlds'"
  const { data: worlds, isLoading: loadingWorlds } = useMyWorlds({
    enabled: activeTab === "worlds",
  });
  const { data: entities, isLoading: loadingEntities } = useMyEntities({
    enabled: activeTab === "entities",
  });

  const deleteEntityMutation = useDeleteEntity();
  const deleteStoryMutation = useDeleteStory();
  // const deleteWorldMutation = useDeleteWorld(); // Need to verify if this exists, likely does if pattern holds. I'll stick to Entity deletion first as requested.

  // Handlers
  const handleNewStory = async () => {
    if (!canCreate) return;
    try {
      // Create the server-side draft before entering the ID-based wizard route.
      const draftId = await initializeDraft();
      navigate(`/stories/${draftId}/compose/world`);
    } catch (error) {
      console.error("Failed to start new story:", error);
    }
  };

  const handleCreateWorld = () => {
    setSelectedWorldId(null);
    setWorldEditorOpen(true);
  };

  const handleEditWorld = (id: string) => {
    setSelectedWorldId(id);
    setWorldEditorOpen(true);
  };

  const handleCreateEntity = () => {
    setSelectedEntityId(null);
    setEntityEditorOpen(true);
  };

  const handleEditEntity = (id: string) => {
    setSelectedEntityId(id);
    setEntityEditorOpen(true);
  };

  const handleDeleteEntity = async (id: string, name: string) => {
    if (
      confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      )
    ) {
      try {
        await deleteEntityMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete entity:", error);
        alert("Failed to delete entity");
      }
    }
  };

  const handleDeleteStory = async (id: string, name: string) => {
    if (
      confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      )
    ) {
      try {
        await deleteStoryMutation.mutateAsync(id);
        await account.refetch();
      } catch (error) {
        console.error("Failed to delete story:", error);
        alert("Failed to delete story");
      }
    }
  };

  return (
    <div className="sc-creations container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1>My Creations</h1>
          <p className="sc-hint">
            Manage your stories, worlds, and content library
          </p>
        </div>

        {/* Main Content Tabs */}
        <div className="sc-creations-layout">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="min-w-0 w-full"
          >
            <TabsList className="sc-creations-tabs">
              <TabsTrigger value="stories" className="sc-creations-tab">
                <BookOpen className="w-4 h-4 mr-2" />
                Stories
              </TabsTrigger>
              <TabsTrigger value="worlds" className="sc-creations-tab">
                <Globe className="w-4 h-4 mr-2" />
                Worlds
              </TabsTrigger>
              <TabsTrigger value="entities" className="sc-creations-tab">
                <Users className="w-4 h-4 mr-2" />
                Entities
              </TabsTrigger>
            </TabsList>

            {/* Stories Tab */}
            <TabsContent value="stories" className="space-y-6">
              <div className="sc-creations-heading">
                <h2>My Stories</h2>
                <Button disabled={!canCreate} onClick={handleNewStory}>
                  Compose Story
                </Button>
              </div>
              {!canCreate && (
                <p className="sc-hint">
                  Story creation requires configured account limits and an
                  available place.
                </p>
              )}
              <div className="sc-story-list">
                {loadingStories ? (
                  <p role="status">Loading stories...</p>
                ) : !stories?.length ? (
                  <div className="sc-story-empty">
                    <p>You haven't compiled any stories yet.</p>
                    <Button
                      disabled={!canCreate}
                      onClick={handleNewStory}
                      variant="outline"
                    >
                      Compose your first Story
                    </Button>
                  </div>
                ) : (
                  stories.map((story) => {
                    const known = !!entitlement?.stories.some(
                      (item) => item.id === story.id,
                    );
                    const writable =
                      known &&
                      !!entitlement?.writable_story_ids.includes(story.id);
                    return (
                      <StoryCard
                        key={story.id}
                        data={story}
                        readOnly={known && !writable}
                        editingDisabled={!writable}
                        onClick={() => {
                          if (writable && story.status === "draft") {
                            navigate(`/stories/${story.id}/compose`);
                          } else {
                            // Correct: Bound/Compiled stories go to overview or play if compiled
                            // User requirement: "Primary Action: 'Manage' -> Navigates to /stories/[id]"
                            navigate(`/stories/${story.id}`);
                          }
                        }}
                        onEdit={() => navigate(`/stories/${story.id}/compose`)}
                        onDelete={() =>
                          handleDeleteStory(story.id, story.display_name)
                        }
                      />
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Worlds Tab */}
            <TabsContent value="worlds" className="space-y-6">
              <SectionHeader
                title="My Worlds"
                actionLabel="Create World"
                onAction={handleCreateWorld}
              />

              <ResourceGrid
                isEmpty={!loadingWorlds && (!worlds || worlds.length === 0)}
                emptyState={
                  <div className="text-center">
                    <p className="text-stone-400 mb-4">
                      You haven't created any worlds yet.
                    </p>
                    <Button onClick={handleCreateWorld} variant="outline">
                      Create your first World
                    </Button>
                  </div>
                }
              >
                {loadingWorlds ? (
                  <div className="text-stone-500">Loading worlds...</div>
                ) : (
                  worlds?.map((world) => (
                    <WorldCard
                      key={world.id}
                      data={world}
                      onEdit={() => handleEditWorld(world.id)}
                    />
                  ))
                )}
              </ResourceGrid>
            </TabsContent>

            {/* Entities Tab */}
            <TabsContent value="entities" className="space-y-6">
              <SectionHeader
                title="My Entities"
                actionLabel="Create Entity"
                onAction={handleCreateEntity}
              />

              <ResourceGrid
                isEmpty={
                  !loadingEntities && (!entities || entities.length === 0)
                }
                emptyState={
                  <div className="text-center">
                    <p className="text-stone-400 mb-4">
                      You haven't created any entities yet.
                    </p>
                    <Button onClick={handleCreateEntity} variant="outline">
                      Create your first Entity
                    </Button>
                  </div>
                }
              >
                {loadingEntities ? (
                  <div className="text-stone-500">Loading entities...</div>
                ) : (
                  entities?.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      data={entity}
                      onEdit={() => handleEditEntity(entity.id)}
                      onDelete={() =>
                        handleDeleteEntity(entity.id, entity.display_name)
                      }
                    />
                  ))
                )}
              </ResourceGrid>
            </TabsContent>
          </Tabs>
          <EntitlementPanel key={account.ownerId} account={account} />
        </div>

        {/* Modals */}
        <WorldEditorModal
          open={worldEditorOpen}
          onOpenChange={setWorldEditorOpen}
          worldId={selectedWorldId}
        />
        <EntityEditorModal
          open={entityEditorOpen}
          onOpenChange={setEntityEditorOpen}
          entityId={selectedEntityId}
        />
      </div>
    </div>
  );
}
