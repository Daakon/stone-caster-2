import React, { useState } from 'react';
import { useMyAssets } from '@/services/chimera-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
    preferredCategory?: string;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ isOpen, onClose, onSelect, preferredCategory = 'all' }) => {
    const { data: assets, isLoading } = useMyAssets();
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    const [category, setCategory] = useState<string>(preferredCategory === 'all' ? 'all' : preferredCategory);

    const filteredAssets = assets?.filter(a => category === 'all' || a.category === category) || [];

    const handleConfirm = () => {
        if (selectedUrl) {
            onSelect(selectedUrl);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Select Asset</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    <Tabs value={category} onValueChange={setCategory} className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="cover">Covers</TabsTrigger>
                            <TabsTrigger value="portrait">Portraits</TabsTrigger>
                            <TabsTrigger value="map">Maps</TabsTrigger>
                            <TabsTrigger value="token">Tokens</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <ScrollArea className="flex-1 pr-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>No assets found in this category.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
                                {filteredAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        className={cn(
                                            "relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:border-primary/50",
                                            selectedUrl === asset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent bg-muted/20"
                                        )}
                                        onClick={() => setSelectedUrl(asset.url)}
                                    >
                                        <img
                                            src={asset.url}
                                            alt={asset.meta?.originalName || 'Asset'}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Optional: Add selection checkmark */}
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selectedUrl}>Select Asset</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
