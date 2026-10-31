import { record, text as readText } from "../../utils/value";
import { cn } from "@/lib/utils";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { useActiveGameStore } from "@/stores/useActiveGameStore";
import { useMemo } from "react";
import { resolveEntityDisplay } from "../../utils/entity-utils";

interface StoryBlockProps {
  text: string;
  role: "narrator" | "player";
  className?: string;
  timestamp?: Date;
}

export function StoryBlock({ text, role, className }: StoryBlockProps) {
  const isPlayer = role === "player";
  const { entities, setSelectedEntity } = useActiveGameStore();

  // Entity Linker Logic
  const processedText = useMemo(() => {
    if (!text || isPlayer) return text;

    let enriched = text;
    // Resolve names across all known shapes (top-level, properties,
    // raw_data.identity) and skip placeholder names
    const validEntities = Object.values(entities)
      .map((e) => ({ entity: e, display: resolveEntityDisplay(e) }))
      .filter(({ display }) => !display.isUnknown);

    // Sort by length desc to handle overlapping names (e.g. "Guard Captain" before "Guard")
    validEntities.sort((a, b) => b.display.name.length - a.display.name.length);

    validEntities.forEach(({ entity, display }) => {
      const name = display.name;
      const id = readText(record(entity).id);
      if (!name || !id) return;

      try {
        // Determine if we should link (prevent double linking if logic was complex, but simple replace here)
        // Use word boundary to match names; escape regex metacharacters
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b(${escapedName})\\b`, "g");
        enriched = enriched.replace(regex, `[$1](entity:${id})`);
      } catch {
        // Ignore regex errors
      }
    });

    return enriched;
  }, [text, entities, isPlayer]);

  return (
    <div
      className={cn(
        "py-4 max-w-none animate-in fade-in duration-500 prose dark:prose-invert leading-relaxed text-lg",
        "prose-p:my-2 prose-strong:font-bold prose-em:italic",
        isPlayer
          ? "text-right italic text-muted-foreground"
          : "font-serif text-foreground/90",
        className,
      )}
    >
      {/* Rich Text Rendering */}
      <ReactMarkdown
        // react-markdown strips unknown URL schemes by default, which
        // silently killed entity: links — allow them through explicitly
        urlTransform={(url) =>
          url.startsWith("entity:") ? url : defaultUrlTransform(url)
        }
        components={{
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 leading-loose">{children}</p>
          ),
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("entity:")) {
              const id = href.slice("entity:".length);
              return (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntity(id);
                  }}
                  className="cursor-pointer text-primary font-bold hover:text-primary/80 hover:underline decoration-primary/30 underline-offset-4 transition-all"
                  title="View details"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                {...props}
                className="text-blue-500 hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
