import * as React from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTags } from "@/services/chimera-api";

interface TagSelectorProps {
    value?: string[];
    onChange: (tags: string[]) => void;
    mode?: 'user' | 'admin';
    scope?: string;
    placeholder?: string;
    maxTags?: number;
    className?: string;
}

export function TagSelector({
    value = [],
    onChange,
    mode = 'user',
    scope = 'global',
    placeholder = "Filter tags...",
    maxTags = 10,
    className
}: TagSelectorProps) {
    const [inputValue, setInputValue] = React.useState("");
    const { data: availableTags, isLoading } = useTags();

    // Derived state for filtering
    const filteredTags = React.useMemo(() => {
        if (!availableTags) return [];
        if (!inputValue) return availableTags;
        const lower = inputValue.toLowerCase();
        return availableTags.filter(t => t.tag_name.toLowerCase().includes(lower));
    }, [availableTags, inputValue]);

    const handleToggle = (tagName: string) => {
        const isSelected = value.includes(tagName);

        if (isSelected) {
            onChange(value.filter(t => t !== tagName));
        } else {
            if (value.length >= maxTags) return;
            onChange([...value, tagName]);
        }
    };

    const handleCreate = () => {
        if (!inputValue) return;
        const newTagName = inputValue.trim();
        // Prevent duplicates
        if (value.includes(newTagName)) return;
        // Basic local "create" - in a real app might verify or POST first
        // For now, since `value` is string[], we just add it.
        // We probably also want to verify it's not in `availableTags` too, 
        // effectively selecting it if it exists.

        const existing = availableTags?.find(t => t.tag_name.toLowerCase() === newTagName.toLowerCase());
        if (existing) {
            handleToggle(existing.tag_name);
        } else {
            if (value.length >= maxTags) return;
            onChange([...value, newTagName]);
        }
        setInputValue("");
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Search / Create Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
                    <Input
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="pl-9 bg-stone-900 border-stone-800 focus:border-stone-700"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreate();
                            }
                        }}
                    />
                </div>
                {mode === 'user' && inputValue && !filteredTags.find(t => t.tag_name.toLowerCase() === inputValue.toLowerCase()) && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCreate}
                        className="shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add "{inputValue}"
                    </Button>
                )}
            </div>

            {/* Selection Summary (Optional, but user asked for list view, selected status is clear via styling) 
                However, keeping a "Selected" count or list might be nice if the list is huge. 
                For now, we'll just show the grid.
            */}

            {/* Tags Grid */}
            <div className="min-h-[100px] max-h-[300px] overflow-y-auto p-4 rounded-lg border border-stone-800 bg-stone-900/50">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8 text-stone-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading filters...
                    </div>
                ) : filteredTags.length === 0 && !inputValue ? (
                    <div className="text-center text-stone-500 p-4 font-mono text-sm">
                        No tags found.
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {/* 1. Show Selected from 'value' first if they aren't in filtered list? 
                            Or just mix everything?
                            User wants "multiple columns of them that are clickable to add".
                            Let's map filtered tags.
                            Also need to ensure 'value' items (custom ones) are shown even if not in API list yet?
                        */}

                        {/* Layout: We show matches from API. */}
                        {filteredTags.map(tag => {
                            const isSelected = value.includes(tag.tag_name);
                            return (
                                <Badge
                                    key={tag.id}
                                    variant={isSelected ? "default" : "outline"}
                                    onClick={() => handleToggle(tag.tag_name)}
                                    className={cn(
                                        "cursor-pointer px-3 py-1.5 text-sm transition-all select-none",
                                        isSelected
                                            ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                                            : "bg-stone-900/50 text-stone-400 border-stone-700 hover:border-stone-500 hover:text-stone-200"
                                    )}
                                >
                                    {tag.tag_name}
                                </Badge>
                            );
                        })}

                        {/* Also show any selected tags that are NOT in the available list (custom tags) 
                            only if they match search? Or always?
                            Usually "selected" should always be visible.
                            Let's append them if they don't exist in filteredTags to ensure visibility.
                        */}
                        {value.map(val => {
                            const existsInFiltered = filteredTags.find(t => t.tag_name === val);
                            // If it exists in filtered, we already rendered it.
                            if (existsInFiltered) return null;

                            // Check if matches filter at least (optional, but good for focus)
                            if (inputValue && !val.toLowerCase().includes(inputValue.toLowerCase())) return null;

                            return (
                                <Badge
                                    key={`custom-${val}`}
                                    variant="default"
                                    onClick={() => handleToggle(val)}
                                    className="cursor-pointer px-3 py-1.5 text-sm transition-all select-none bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                                >
                                    {val}
                                </Badge>
                            );
                        })}
                    </div>
                )}
            </div>

            <p className="text-xs text-stone-500 px-1">
                {value.length} / {maxTags} tags selected. Click to toggle.
            </p>
        </div>
    );
}
