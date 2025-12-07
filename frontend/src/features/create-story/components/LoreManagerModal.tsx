/**
 * Lore Manager Modal
 * Dialog for selecting or creating lore fragments
 * 
 * Features:
 * - Library tab: Browse and select existing lore
 * - Scribe tab: Create new lore fragments
 */

import React, { useState, useMemo } from 'react';
import { Search, Plus, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_USER_LORE, type LoreFragment } from '../data/mock-library';

interface LoreManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lore: LoreFragment) => void;
  onCreate: (lore: LoreFragment) => void;
}

export function LoreManagerModal({
  isOpen,
  onClose,
  onSelect,
  onCreate,
}: LoreManagerModalProps) {
  // Library tab state
  const [searchQuery, setSearchQuery] = useState('');

  // Scribe tab state
  const [loreTitle, setLoreTitle] = useState('');
  const [loreContent, setLoreContent] = useState('');

  // Filter lore by search query
  const filteredLore = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_USER_LORE;
    const query = searchQuery.toLowerCase();
    return MOCK_USER_LORE.filter(
      (lore) =>
        lore.title.toLowerCase().includes(query) ||
        lore.content.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle lore creation
  const handleCreate = () => {
    if (!loreTitle.trim() || !loreContent.trim()) return;

    const newLore: LoreFragment = {
      id: `lore-${Date.now()}`,
      title: loreTitle.trim(),
      content: loreContent.trim(),
    };

    onCreate(newLore);

    // Reset form
    setLoreTitle('');
    setLoreContent('');
    onClose();
  };

  // Handle lore selection
  const handleSelect = (lore: LoreFragment) => {
    onSelect(lore);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Add Lore</DialogTitle>
          <DialogDescription>
            Select an existing lore fragment from your library or scribe a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library" className="min-h-[44px]">
              Library
            </TabsTrigger>
            <TabsTrigger value="scribe" className="min-h-[44px]">
              Scribe
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search lore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-[44px]"
                aria-label="Search lore"
              />
            </div>

            {filteredLore.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No lore found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
                {filteredLore.map((lore) => (
                  <Card
                    key={lore.id}
                    className="cursor-pointer hover:shadow-md transition-shadow min-h-[120px]"
                    onClick={() => handleSelect(lore)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(lore);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        {lore.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="line-clamp-3">
                        {lore.content}
                      </CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Scribe Tab */}
          <TabsContent value="scribe" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="lore-title">Title</Label>
                <Input
                  id="lore-title"
                  type="text"
                  placeholder="Enter lore title..."
                  value={loreTitle}
                  onChange={(e) => setLoreTitle(e.target.value)}
                  className="min-h-[44px]"
                  aria-label="Lore title"
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="lore-content">Body</Label>
                <Textarea
                  id="lore-content"
                  placeholder="Write the lore fragment content..."
                  value={loreContent}
                  onChange={(e) => setLoreContent(e.target.value)}
                  className="min-h-[200px] resize-y"
                  aria-label="Lore content"
                />
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreate}
                disabled={!loreTitle.trim() || !loreContent.trim()}
                className="w-full min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Story
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
