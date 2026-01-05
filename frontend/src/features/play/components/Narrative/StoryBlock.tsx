import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { useMemo } from 'react';

interface StoryBlockProps {
    text: string;
    role: 'narrator' | 'player';
    className?: string;
    timestamp?: Date;
}

export function StoryBlock({ text, role, className, timestamp }: StoryBlockProps) {
    const isPlayer = role === 'player';
    const { entities, setSelectedEntity } = useActiveGameStore();

    // Entity Linker Logic
    const processedText = useMemo(() => {
        if (!text || isPlayer || !entities) return text;

        let enriched = text;
        const validEntities = Object.values(entities).filter((e: any) => e.name || e.display_name);

        // Sort by length desc to handle overlapping names (e.g. "Guard Captain" before "Guard")
        validEntities.sort((a, b) => {
            const nameA = a.display_name || a.name || "";
            const nameB = b.display_name || b.name || "";
            return nameB.length - nameA.length;
        });

        validEntities.forEach((entity: any) => {
            const name = entity.display_name || entity.name;
            if (!name) return;

            try {
                // Determine if we should link (prevent double linking if logic was complex, but simple replace here)
                // Use word boundary to match names
                const regex = new RegExp(`\\b(${name})\\b`, 'g');
                enriched = enriched.replace(regex, `[$1](entity:${entity.id})`);
            } catch (e) {
                // Ignore regex errors
            }
        });

        return enriched;
    }, [text, entities, isPlayer]);

    return (
        <div
            className={cn(
                "py-4 max-w-none animate-in fade-in duration-500 prose dark:prose-invert leading-relaxed text-lg",
                isPlayer ? "text-right italic text-muted-foreground" : "font-serif text-foreground/90",
                className
            )}
        >
            {/* Rich Text Rendering */}
            <ReactMarkdown
                components={{
                    a: ({ node, href, children, ...props }) => {
                        if (href?.startsWith('entity:')) {
                            const id = href.split(':')[1];
                            return (
                                <span
                                    onClick={() => setSelectedEntity(id)}
                                    className="cursor-pointer text-primary font-medium hover:underline decoration-primary/50 underline-offset-4 transition-all"
                                    title="View details"
                                >
                                    {children}
                                </span>
                            );
                        }
                        return <a href={href} {...props} className="text-blue-500 hover:underline">{children}</a>;
                    }
                }}
            >
                {processedText}
            </ReactMarkdown>
        </div>
    );
}
