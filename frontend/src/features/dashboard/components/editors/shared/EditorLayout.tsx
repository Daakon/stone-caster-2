import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EditorLayoutProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    status: string;
    tabs: { id: string; label: string; icon?: ReactNode }[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    onSave: () => void;
    isSaving: boolean;
    children: ReactNode;
}

export function EditorLayout({
    open,
    onOpenChange,
    title,
    status,
    tabs,
    activeTab,
    onTabChange,
    onSave,
    isSaving,
    children
}: EditorLayoutProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 bg-stone-950 border-stone-800">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/50">
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl font-bold text-white">{title}</DialogTitle>
                        <Badge variant="outline" className="uppercase text-[10px] tracking-wider border-stone-700 text-stone-400">
                            {status}
                        </Badge>
                    </div>
                    {/* Close button provided by DialogContent usually, but we can customize or hide standard one */}
                    {/* The standard X is there, but let's leave it or remove standard close via CSS if needed. 
                        Usually DialogContent has a X. To avoid double X, check shadcn implementation.
                        Shadcn DialogContent includes Close. We can suppress it or just let it be. 
                        We won't add another X here.
                    */}
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-stone-800 bg-stone-900/30">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-stone-400 hover:text-stone-200 hover:border-stone-700"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-stone-950/50">
                    {children}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-800 bg-stone-900/50">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                        className="text-stone-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={isSaving}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Draft
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
