/**
 * Story List Section
 * Displays user's stories (drafts and published) with tabs
 * 
 * Features:
 * - Tabs for Drafts vs Published
 * - Story cards with appropriate actions
 * - Progress indicators for drafts
 * - Stats for published stories
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, Play, Share2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

export interface StoryItem {
  id: string;
  title: string;
  status: 'draft' | 'published';
  lastEdited?: string;
  publishedAt?: string;
  step?: number; // For drafts: current step (0-4)
  turnCount?: number; // For published: current turn count
  plays?: number; // For published: total plays
}

interface StoryListSectionProps {
  stories: StoryItem[];
}

export function StoryListSection({ stories }: StoryListSectionProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'drafts' | 'published'>('drafts');

  const drafts = stories.filter((s) => s.status === 'draft');
  const published = stories.filter((s) => s.status === 'published');

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleResumeDraft = (draftId: string) => {
    navigate(`/create-story?draftId=${draftId}`);
  };

  const handlePlayStory = (storyId: string) => {
    navigate(`/stories/${storyId}`);
  };

  const handleShareStory = (storyId: string) => {
    // TODO: Implement share functionality
    console.log(`[StoryListSection] Share story:`, storyId);
  };

  const renderDraftCard = (story: StoryItem) => {
    const progress = story.step !== undefined ? ((story.step + 1) / 5) * 100 : 0;

    return (
      <Card key={story.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {story.title}
              </CardTitle>
              {story.lastEdited && (
                <CardDescription className="mt-1 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Last edited {formatTime(story.lastEdited)}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Indicator */}
          {story.step !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <Badge variant="outline" className="text-xs">
                  Step {story.step + 1} of 5
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={() => handleResumeDraft(story.id)}
            className="w-full min-h-[44px]"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Resume Casting
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderPublishedCard = (story: StoryItem) => {
    return (
      <Card key={story.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                {story.title}
              </CardTitle>
              {story.publishedAt && (
                <CardDescription className="mt-1">
                  Published {formatTime(story.publishedAt)}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {story.turnCount !== undefined && (
              <span>Turn {story.turnCount}</span>
            )}
            {story.plays !== undefined && (
              <span>{story.plays} plays</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => handlePlayStory(story.id)}
              className="flex-1 min-h-[44px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Play
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShareStory(story.id)}
              className="min-h-[44px] px-4"
              aria-label="Share story"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">My Stories</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'drafts' | 'published')}>
        <TabsList>
          <TabsTrigger value="drafts" className="min-h-[44px]">
            Drafts {drafts.length > 0 && `(${drafts.length})`}
          </TabsTrigger>
          <TabsTrigger value="published" className="min-h-[44px]">
            Published {published.length > 0 && `(${published.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Drafts Tab */}
        <TabsContent value="drafts" className="mt-4">
          {drafts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No active drafts. Start a new story above.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map(renderDraftCard)}
            </div>
          )}
        </TabsContent>

        {/* Published Tab */}
        <TabsContent value="published" className="mt-4">
          {published.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No published stories yet. Complete a draft to publish it.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {published.map(renderPublishedCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
