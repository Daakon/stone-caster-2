import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface KeywordInputProps {
    value: string[];
    onChange: (keywords: string[]) => void;
    placeholder?: string;
    maxKeywords?: number;
    className?: string;
}

export function KeywordInput({
    value = [],
    onChange,
    placeholder = "Add keyword...",
    maxKeywords = 10,
    className
}: KeywordInputProps) {
    const [inputValue, setInputValue] = useState("");

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
            // Remove last keyword if input is empty
            const newValue = [...value];
            newValue.pop();
            onChange(newValue);
        }
    };

    const addKeyword = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        if (value.includes(trimmed)) {
            setInputValue("");
            return;
        }

        if (value.length >= maxKeywords) return;

        onChange([...value, trimmed]);
        setInputValue("");
    };

    const removeKeyword = (keywordToRemove: string) => {
        onChange(value.filter(k => k !== keywordToRemove));
    };

    return (
        <div className={className}>
            <div className="flex flex-wrap gap-2 mb-2">
                {value.map((keyword, index) => (
                    <Badge
                        key={`${keyword}-${index}`}
                        variant="secondary"
                        className="bg-stone-800 text-stone-300 hover:bg-stone-700 h-6 px-2 text-xs flex items-center gap-1"
                    >
                        {keyword}
                        <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="text-stone-500 hover:text-stone-300 focus:outline-none"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addKeyword}
                placeholder={value.length >= maxKeywords ? "Max keywords reached" : placeholder}
                disabled={value.length >= maxKeywords}
                className="bg-stone-900 border-stone-800 focus:border-primary/50"
            />
            {value.length > 0 && (
                <p className="text-xs text-stone-500 mt-1">
                    Press Enter to add, Backspace to remove last.
                </p>
            )}
        </div>
    );
}
