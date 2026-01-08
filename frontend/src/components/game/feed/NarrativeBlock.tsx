import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useActiveGameStore } from '@/stores/useActiveGameStore';

interface NarrativeBlockProps {
    text: string;
    role?: 'narrator' | 'player' | 'system';
    className?: string;
}

export function NarrativeBlock({ text, role = 'narrator', className }: NarrativeBlockProps) {
    const { entities, setSelectedEntity } = useActiveGameStore();
    const isPlayer = role === 'player';

    // Safety: Explicitly disallowed elements to prevent potential rendering issues
    // even though we trust the source.
    const disallowedElements = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];

    // Entity Linker Logic
    const processedText = useMemo(() => {
        if (!text || isPlayer || !entities) return text;

        let enriched = text;
        const validEntities = Object.values(entities).filter((e: any) => e.name || e.display_name);

        // Sort by length desc to handle overlapping names (e.g. "Guard Captain" before "Guard")
        validEntities.sort((a: any, b: any) => {
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

    // Conditional Styling based on role
    const roleStyles = useMemo(() => {
        switch (role) {
            case 'player':
                return "text-right italic text-muted-foreground";
            case 'system':
                return "font-mono text-xs text-muted-foreground bg-muted/30 p-2 rounded";
            case 'narrator':
            default:
                // "prose" from tailwind typography plugin handles most internals
                // We add specifics for color and fonts
                return "font-serif text-foreground/90 prose-p:my-2 prose-strong:text-brand-primary prose-strong:font-bold prose-em:text-muted-foreground prose-em:italic";
        }
    }, [role]);

    return (
        <div className={cn(
            "prose dark:prose-invert max-w-none leading-relaxed transition-all",
            roleStyles,
            className
        )}>
            <ReactMarkdown
                disallowedElements={disallowedElements}
                components={{
                    // Override Paragraph to ensure consistent spacing
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-loose text-gray-100">{children}</p>,
                    // Style blockquotes for "Recall" or "Flashbacks"
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground/80">{children}</blockquote>,
                    // Code for "System Messages"
                    code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded font-mono text-sm">{children}</code>,
                    // Entity Links
                    a: ({ href, children, ...props }) => {
                        if (href?.startsWith('entity:')) {
                            const id = href.split(':')[1];
                            return (
                                <span
                                    onClick={() => setSelectedEntity(id)}
                                    className="cursor-pointer text-brand-primary font-bold hover:text-brand-primary/80 hover:underline decoration-brand-primary/30 underline-offset-4 transition-all"
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
